import { formatTime } from '@yuants/data-model';
import { diffPosition, mergePositions } from '@yuants/kernel';
import {
  IAccountInfo,
  IOrder,
  IPosition,
  IProduct,
  OrderDirection,
  OrderType,
  PositionVariant,
  PromRegistry,
  Terminal,
  mapPositionVariantToNetPositionCoef,
} from '@yuants/protocol';
import { roundToStep } from '@yuants/utils';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { randomUUID } from 'crypto';
import { JSONSchema7 } from 'json-schema';
import {
  EMPTY,
  Observable,
  TimeoutError,
  catchError,
  combineLatest,
  combineLatestWith,
  concatMap,
  defer,
  delay,
  distinct,
  filter,
  first,
  from,
  generate,
  groupBy,
  map,
  mergeMap,
  of,
  pairwise,
  reduce,
  repeat,
  shareReplay,
  tap,
  throwError,
  timeout,
  toArray,
} from 'rxjs';

const HV_URL = process.env.HV_URL || 'ws://localhost:8888';
const TERMINAL_ID = process.env.TERMINAL_ID || `TradeCopier`;
const terminal = new Terminal(HV_URL, { terminal_id: TERMINAL_ID, name: 'Trade Copier' });
const STORAGE_TERMINAL_ID = process.env.STORAGE_TERMINAL_ID!;

interface ITradeCopyRelation {
  source_account_id: string;
  source_product_id: string;
  target_account_id: string;
  target_product_id: string;
  multiple: number;
  /** 根据正则表达式匹配头寸的备注 (黑名单) */
  exclusive_comment_pattern?: string;
}

interface ITradeCopierConfig {
  multiple?: number;
  tasks: ITradeCopyRelation[];
  account_product_risks?: Array<{
    account_id: string;
    product_id: string;
    multiple: number;
    max_position: number;
  }>;
}

interface ITradeCopierTWAPConfig {
  account_id: string;
  product_id: string;
  max_duration: number;
  min_volume: number;
  interval: number;
}

const configSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'source_account_id',
          'source_product_id',
          'target_account_id',
          'target_product_id',
          'multiple',
        ],
        properties: {
          source_account_id: {
            type: 'string',
          },
          source_product_id: {
            type: 'string',
          },
          target_account_id: {
            type: 'string',
          },
          target_product_id: {
            type: 'string',
          },
          multiple: {
            type: 'number',
          },
          exclusive_comment_pattern: {
            type: 'string',
            format: 'regex',
          },
        },
      },
    },
  },
};

const twapConfigSchema: JSONSchema7 = {
  type: 'object',
  required: ['account_id', 'max_duration', 'minimum_volume'],
  properties: {
    account_id: {
      type: 'string',
    },
    product_id: {
      type: 'string',
    },
    max_duration: {
      type: 'number',
    },
    min_volume: {
      type: 'number',
    },
    interval: {
      type: 'number',
    },
  },
};

const ajv = new Ajv();
addFormats(ajv);

const twapValidate = ajv.compile(twapConfigSchema);

const useProducts = (() => {
  const hub: Record<string, Observable<Record<string, IProduct>>> = {};
  return (account_id: string) =>
    (hub[account_id] ??= defer(() =>
      terminal.queryProducts({ datasource_id: account_id }, STORAGE_TERMINAL_ID),
    ).pipe(
      map((products) => Object.fromEntries(products.map((product) => [product.product_id, product]))),
      shareReplay(1),
    ));
})();

const twapConfig$ = defer(() =>
  terminal.queryDataRecords<ITradeCopierTWAPConfig>(
    {
      type: 'trade_copier_twap_config',
    },
    STORAGE_TERMINAL_ID,
  ),
).pipe(
  //
  map((record) => {
    const config = record.origin;
    if (!twapValidate(config)) {
      throw new Error(`Invalid TWAP config: ${ajv.errorsText(twapValidate.errors)}`);
    }
    return config;
  }),
  toArray(),
  repeat({ delay: 5_000 }),
  shareReplay(1),
);

const validate = ajv.compile(configSchema);

const config$ = defer(() =>
  terminal.queryDataRecords<ITradeCopyRelation>({ type: 'trade_copy_relation' }, STORAGE_TERMINAL_ID),
).pipe(
  //
  map((msg) => msg.origin),
  toArray(),
  map((data): ITradeCopierConfig => ({ tasks: data })),
  mergeMap((data) => {
    const isValid = validate(data);
    if (!isValid) {
      console.error(validate.errors);
      return throwError(() => 'ERROR CONFIG');
    }
    return of(data);
  }),
  tap((config) => console.info(formatTime(Date.now()), 'LoadConfig', JSON.stringify(config))),
  tap((config) => {
    for (const task of config.tasks) {
      const labels = {
        source_account_id: task.source_account_id,
        target_account_id: task.target_account_id,
        source_product_id: task.source_product_id,
        target_product_id: task.target_product_id,
      };
      if (task.multiple === 0) {
        MetricMatrixUp.set(0, labels);
      } else {
        MetricMatrixUp.set(1, labels);
      }
    }
  }),
  catchError((err) => {
    terminal.terminalInfo.status = 'InvalidConfig';
    throw err;
  }),
  shareReplay(1),
);

config$
  .pipe(
    //
    first(),
  )
  .subscribe(() => {
    terminal.terminalInfo.status = 'OK';
  });

// Suggestions: alert when the lag is too high
const MetricTimeLag = PromRegistry.create(
  'histogram',
  'trade_copier_account_info_time_lag_ms',
  'the time lag from info itself to copier received',
  [500, 1000, 1500, 2000, 10000],
);

// Suggestion: alert when the error ratio is above 1 for a while
const MetricErrorVolumeRatio = PromRegistry.create(
  'gauge',
  'trade_copier_error_volume_ratio',
  'the absolute error volume between source and target, divided by volume_step',
);

const MetricMatrixUp = PromRegistry.create(
  'gauge',
  'trade_copier_matrix_up',
  'status of account_id-product_id, when multiple above 0, the value of this metric is 1 otherwise 0',
);

const MetricsAccountSubscribeStatus = PromRegistry.create(
  'gauge',
  'trade_copier_account_subscribe_status',
  'status of account_id, 1 for success, 0 for failure',
);

// All the accounts involved
const allAccountIds$ = config$.pipe(
  mergeMap((x) => x.tasks),
  mergeMap((task) => of(task.source_account_id, task.target_account_id)),
  distinct(),
  toArray(),
  shareReplay(1),
);

// Check if all the accounts are subscribed successfully
allAccountIds$
  .pipe(
    mergeMap((x) => x),
    mergeMap((account_id) =>
      defer(() => terminal.useAccountInfo(account_id))
        .pipe(
          //
          first(),
        )
        .pipe(
          tap((accountInfo) => {
            MetricsAccountSubscribeStatus.set(1, {
              account_id: accountInfo.account_id,
              terminal_id: TERMINAL_ID,
            });
          }),
          timeout({ each: 60_000, meta: `SubscribeAccountInfoTimeout, account_id: ${account_id}` }),
          catchError((e) => {
            MetricsAccountSubscribeStatus.set(0, {
              account_id,
              terminal_id: TERMINAL_ID,
            });
            console.error(
              formatTime(Date.now()),
              `SubscribeAccountInfoError`,
              account_id,
              `${e instanceof TimeoutError ? `${e}: ${e.info?.meta}` : e}`,
            );
            return EMPTY;
          }),
          repeat({ delay: 1000 }),
        ),
    ),
  )
  .subscribe();

// Observe the time lag between two account info
allAccountIds$
  .pipe(
    mergeMap((x) => x),
    mergeMap((account_id) =>
      terminal.useAccountInfo(account_id).pipe(
        pairwise(),
        tap(([info1, info2]) => {
          const lag = (info2.timestamp_in_us - info1.timestamp_in_us) / 1e3;
          MetricTimeLag.observe(lag, { account_id, terminal_id: TERMINAL_ID });
        }),
      ),
    ),
  )
  .subscribe();

config$
  .pipe(
    mergeMap((x) => x.tasks),
    groupBy((task) => task.target_account_id),
    mergeMap((group) =>
      group.pipe(
        toArray(),
        map((tasks) => ({ key: group.key, tasks })),
      ),
    ),
    // query all the products in the target account
    mergeMap((group) =>
      defer(() => useProducts(group.key).pipe(first())).pipe(
        // package
        map((products) => ({ products, group })),
      ),
    ),

    mergeMap(({ group: groupWithSameTarget, products }) => {
      console.info(
        formatTime(Date.now()),
        'SetupTradeCopyAccount',
        groupWithSameTarget.key,
        JSON.stringify(groupWithSameTarget.tasks),
      );

      return defer(() => of(0)).pipe(
        // Log
        tap(() => console.info(formatTime(Date.now()), 'LoopStart', groupWithSameTarget.key)),
        mergeMap(() => {
          const t = Date.now();

          // Reset residual error volume
          const product_ids = groupWithSameTarget.tasks
            .filter((task) => task.target_account_id === groupWithSameTarget.key)
            .map((v) => v.target_product_id);
          for (const product_id of product_ids) {
            MetricErrorVolumeRatio.reset({
              account_id: groupWithSameTarget.key,
              product_id,
              variant: PositionVariant.LONG,
            });
            MetricErrorVolumeRatio.reset({
              account_id: groupWithSameTarget.key,
              product_id,
              variant: PositionVariant.SHORT,
            });
          }

          return defer(() => terminal.useAccountInfo(groupWithSameTarget.key)).pipe(
            //
            filter((info) => info.timestamp_in_us / 1000 > t),
            map((info) => mergePositions(info.positions)),
            first(),
            tap((positions) => {
              console.info(formatTime(Date.now()), `TargetAccountInfo`, JSON.stringify(positions));
            }),
            timeout({
              each: 30_000,
              meta: `TargetAccountInfoTimeout, target_account_id: ${groupWithSameTarget.key}`,
            }),
            mergeMap((positions) => {
              // Target Positions
              const desiredTargetPositions$ = of(0).pipe(
                // Combine the latest source accounts, drop expired ones
                mergeMap(() => {
                  const t = Date.now();
                  return combineLatest(
                    groupWithSameTarget.tasks.map((task) =>
                      terminal.useAccountInfo(task.source_account_id).pipe(
                        // drop the expired account info
                        filter((info) => info.timestamp_in_us / 1000 > t),
                        // bind info and task relation
                        map((info) => ({ info, task })),
                      ),
                    ),
                  ).pipe(
                    // Grab the first one, all the source accounts are ready
                    first(),
                  );
                }),
                tap((list) => {
                  console.info(formatTime(Date.now()), `SourceAccountInfo`, JSON.stringify(list));
                }),
                timeout({
                  each: 30_000,
                  meta: `SourceAccountInfoTimeout, target_account_id: ${
                    groupWithSameTarget.key
                  }, source_account_id: ${Array.from(
                    new Set(groupWithSameTarget.tasks.map((v) => v.source_account_id)),
                  )}`,
                }),
                // Summary the source accounts
                mergeMap((list: { info: IAccountInfo; task: ITradeCopyRelation }[]) =>
                  from(list).pipe(
                    mergeMap(({ task, info }) =>
                      from(info.positions)
                        .pipe(
                          // keep the positions with the same product_id
                          filter((position) => position.product_id === task.source_product_id),
                          // filter by comment
                          filter((position) => {
                            if (task.exclusive_comment_pattern) {
                              try {
                                return !new RegExp(task.exclusive_comment_pattern).test(
                                  position.comment ?? '',
                                );
                              } catch (e) {
                                console.error(formatTime(Date.now()), e);
                                // if the expression is invalid, treat it as a fatal error,
                                // filter all the positions, which is equivalent to close all the positions.
                                return false;
                              }
                            }
                            // if the expression is not set, pass the filter
                            return true;
                          }),
                          groupBy(() => task.target_product_id),
                          mergeMap((groupWithSameTargetProductId) =>
                            groupWithSameTargetProductId.pipe(
                              // Get net position (long for positive, short for negative)
                              map(
                                (position) =>
                                  (position.variant === PositionVariant.LONG
                                    ? 1
                                    : position.variant === PositionVariant.SHORT
                                    ? -1
                                    : 0) *
                                    position.volume *
                                    task.multiple || 0, // Invalid position will fallback to zero.
                              ),
                              // sum up to target volume
                              reduce((acc, cur) => acc + cur),
                              // recover to target position
                              map(
                                (netVolume): IPosition => ({
                                  product_id: groupWithSameTargetProductId.key,
                                  variant: netVolume > 0 ? PositionVariant.LONG : PositionVariant.SHORT,
                                  volume: Math.abs(netVolume),
                                  free_volume: Math.abs(netVolume),
                                  position_price: 0,
                                  floating_profit: 0,
                                  closable_price: 0,
                                  position_id: '',
                                }),
                              ),
                            ),
                          ),
                        )
                        .pipe(
                          // change the product_id to target_product_id
                          map((position) => ({
                            ...position,
                            product_id: task.target_product_id,
                          })),
                          // multiply the volume by multiple (negative for opposite direction)
                          map((position): IPosition => {
                            const netPosition =
                              mapPositionVariantToNetPositionCoef(position.variant) * position.volume;
                            const newNetVolume = netPosition * task.multiple; // HERE
                            const variant = newNetVolume > 0 ? PositionVariant.LONG : PositionVariant.SHORT;
                            const volume = Math.abs(newNetVolume);

                            return {
                              ...position,
                              volume,
                              free_volume: volume,
                              variant,
                            };
                          }),
                          // filter out 0 and invalid positions
                          filter((position) => position.volume > 0),
                        ),
                    ),
                    toArray(),
                    map((positions) => mergePositions(positions)),
                  ),
                ),
              );

              return desiredTargetPositions$.pipe(
                //
                map((desiredTargetPositions) => diffPosition(desiredTargetPositions, positions)),
              );
            }),

            // NOTE: here goes the algorithm trading
            combineLatestWith(twapConfig$.pipe(first())),
            mergeMap(([positionDiffList, twapConfig]) => {
              const mapKeyToTWAPConfig = Object.fromEntries(
                twapConfig.map((v) => [`${v.account_id}-${v.product_id}`, v]),
              );
              return from(positionDiffList).pipe(
                //
                filter((positionDiff) => positionDiff.error_volume !== 0),
                mergeMap((positionDiff) => {
                  const volume = Math.abs(positionDiff.error_volume);
                  const config = mapKeyToTWAPConfig[`${groupWithSameTarget.key}-${positionDiff.product_id}`];
                  // if the config is not set or the volume is too small, no need to use TWAP
                  if (config === undefined || volume < config.min_volume) {
                    return of({
                      client_order_id: randomUUID(),
                      account_id: groupWithSameTarget.key,
                      type: OrderType.MARKET,
                      product_id: positionDiff.product_id,
                      // ISSUE: 必须使用 Math.floor，避免震荡下单 ("千分之五手问题")
                      volume: roundToStep(
                        volume,
                        products[positionDiff.product_id]?.volume_step ?? 1,
                        Math.floor,
                      ),
                      direction:
                        positionDiff.variant === PositionVariant.LONG
                          ? positionDiff.error_volume > 0
                            ? OrderDirection.OPEN_LONG
                            : OrderDirection.CLOSE_LONG
                          : positionDiff.error_volume > 0
                          ? OrderDirection.OPEN_SHORT
                          : OrderDirection.CLOSE_SHORT,
                    }).pipe(
                      //
                      tap((order) => {
                        console.info(
                          formatTime(Date.now()),
                          `OrderToSubmit`,
                          groupWithSameTarget.key,
                          JSON.stringify(order),
                        );
                      }),
                      concatMap((order) =>
                        terminal.submitOrder(order).pipe(
                          tap(() => {
                            console.info(
                              formatTime(Date.now()),
                              `SucceedToSubmitOrder`,
                              groupWithSameTarget.key,
                              JSON.stringify(order),
                            );
                          }),
                          catchError((e) => {
                            console.error(
                              formatTime(Date.now()),
                              'FailedToSubmitOrder',
                              groupWithSameTarget.key,
                              order,
                              e,
                            );
                            return EMPTY;
                          }),
                        ),
                      ),
                    );
                  }

                  // perform TWAP
                  const { order_count, volume_per_order } = calcTWAPOrderVolumes(
                    config,
                    volume,
                    products[positionDiff.product_id],
                  );
                  return generate({
                    initialState: 0,
                    condition: (i) => i < order_count,
                    iterate: (i) => i + 1,
                    resultSelector: (i: number): IOrder => ({
                      client_order_id: randomUUID(),
                      account_id: groupWithSameTarget.key,
                      type: OrderType.MARKET,
                      product_id: positionDiff.product_id,
                      // ISSUE: 必须使用 Math.floor，避免震荡下单 ("千分之五手问题")
                      volume:
                        i < order_count - 1
                          ? volume_per_order
                          : roundToStep(
                              volume - volume_per_order * order_count,
                              products[positionDiff.product_id]?.volume_step ?? 1,
                              Math.floor,
                            ),
                      direction:
                        positionDiff.variant === PositionVariant.LONG
                          ? positionDiff.error_volume > 0
                            ? OrderDirection.OPEN_LONG
                            : OrderDirection.CLOSE_LONG
                          : positionDiff.error_volume > 0
                          ? OrderDirection.OPEN_SHORT
                          : OrderDirection.CLOSE_SHORT,
                    }),
                  }).pipe(
                    //
                    tap((order) => {
                      console.info(
                        formatTime(Date.now()),
                        `OrderToSubmit`,
                        groupWithSameTarget.key,
                        JSON.stringify(order),
                      );
                    }),
                    concatMap((order) =>
                      terminal.submitOrder(order).pipe(
                        tap(() => {
                          console.info(
                            formatTime(Date.now()),
                            `SucceedToSubmitOrder`,
                            groupWithSameTarget.key,
                            JSON.stringify(order),
                          );
                        }),
                        catchError((e) => {
                          console.error(
                            formatTime(Date.now()),
                            'FailedToSubmitOrder',
                            groupWithSameTarget.key,
                            order,
                            e,
                          );
                          return EMPTY;
                        }),
                      ),
                    ),
                    delay(config.interval),
                  );
                }),
                toArray(),
              );
            }),
          );
        }),
        catchError((e) => {
          console.error(
            formatTime(Date.now()),
            'LoopError',
            groupWithSameTarget.key,
            `${e instanceof TimeoutError ? `${e}: ${e.info?.meta}` : e}`,
          );
          return EMPTY;
        }),
        repeat({ delay: 2000 }),
      );
    }),
  )
  .subscribe();

const calcTWAPOrderVolumes = (config: ITradeCopierTWAPConfig, volume: number, product: IProduct) => {
  const order_count = Math.floor(config.max_duration / config.interval);
  const volume_per_order = roundToStep(volume / order_count, product?.volume_step ?? 1, Math.floor);
  if (volume_per_order < config.min_volume) {
    return {
      order_count: Math.ceil(volume / config.min_volume),
      volume_per_order: config.min_volume,
    };
  }
  return {
    order_count,
    volume_per_order,
  };
};
