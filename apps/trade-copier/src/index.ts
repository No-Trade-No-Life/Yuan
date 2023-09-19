import { formatTime } from '@yuants/data-model';
import { IPositionDiff, diffPosition, mergePositions } from '@yuants/kernel';
import {
  IOrder,
  IPosition,
  IProduct,
  OrderDirection,
  OrderType,
  PositionVariant,
  PromRegistry,
  Terminal,
} from '@yuants/protocol';
import { roundToStep } from '@yuants/utils';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { randomUUID } from 'crypto';
import { JSONSchema7 } from 'json-schema';
import {
  EMPTY,
  Observable,
  Subject,
  TimeoutError,
  catchError,
  combineLatest,
  combineLatestWith,
  concatMap,
  defer,
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

interface ITradeCopierTradeConfig {
  account_id: string;
  product_id: string;
  max_volume_per_order: number;
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

const tradeConfigSchema: JSONSchema7 = {
  type: 'object',
  required: ['account_id', 'product_id', 'max_volume_per_order'],
  properties: {
    account_id: {
      type: 'string',
    },
    product_id: {
      type: 'string',
    },
    max_volume_per_order: {
      type: 'number',
    },
  },
};

const ajv = new Ajv();
addFormats(ajv);

const tradeConfigValidate = ajv.compile(tradeConfigSchema);

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

const tradeConfig$ = defer(() =>
  terminal.queryDataRecords<ITradeCopierTradeConfig>(
    {
      type: 'trade_copier_trade_config',
    },
    STORAGE_TERMINAL_ID,
  ),
).pipe(
  //
  map((record) => {
    const config = record.origin;
    if (!tradeConfigValidate(config)) {
      throw new Error(`Invalid Trade config: ${ajv.errorsText(tradeConfigValidate.errors)}`);
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
    // split tasks into different groups by target_account_id and target_product_id,
    // each group will be processed concurrently
    mergeMap((group) =>
      group.pipe(
        groupBy((task) => task.target_product_id),
        mergeMap((subGroup) =>
          subGroup.pipe(
            //
            toArray(),
            map((tasks) => ({
              target_account_id: group.key,
              target_product_id: subGroup.key,
              tasks,
            })),
          ),
        ),
      ),
    ),
    // query all the products in the target account
    mergeMap((group) =>
      defer(() => useProducts(group.target_account_id).pipe(first())).pipe(
        // package
        map((products) => ({ products, group })),
      ),
    ),
    mergeMap(({ group: groupWithSameTarget, products }) => {
      console.info(
        formatTime(Date.now()),
        'SetupTradeCopyAccount',
        groupWithSameTarget.target_account_id,
        JSON.stringify(groupWithSameTarget.tasks),
      );

      const ConcurrentOrderPlaceAction$ = new Subject<IOrder[]>();

      ConcurrentOrderPlaceAction$.pipe(
        mergeMap((orders) =>
          from(orders).pipe(
            filter((order) => order.volume > 0),
            mergeMap((order) =>
              // TODO(wsy): make this a function
              terminal.submitOrder(order).pipe(
                tap(() => {
                  console.info(
                    formatTime(Date.now()),
                    `SucceedToSubmitOrder`,
                    groupWithSameTarget.target_account_id,
                    JSON.stringify(order),
                  );
                }),
                catchError((e) => {
                  console.error(
                    formatTime(Date.now()),
                    'FailedToSubmitOrder',
                    groupWithSameTarget.target_account_id,
                    JSON.stringify(order),
                    e,
                  );
                  return EMPTY;
                }),
              ),
            ),
            toArray(),
          ),
        ),
        timeout({
          each: 30_000,
          meta: `SimpleOrderTraderTimeout, target_account_id: ${groupWithSameTarget.target_account_id}`,
        }),
      ).subscribe(() => {
        LoopCompleteAction$.next();
      });

      const SerialOrderPlaceAction$ = new Subject<IOrder[]>();

      SerialOrderPlaceAction$.pipe(
        mergeMap((orders) =>
          from(orders).pipe(
            filter((order) => order.volume > 0),
            concatMap((order) =>
              // TODO(wsy): make this a function
              terminal.submitOrder(order).pipe(
                tap(() => {
                  console.info(
                    formatTime(Date.now()),
                    `SucceedToSubmitOrder`,
                    groupWithSameTarget.target_account_id,
                    JSON.stringify(order),
                  );
                }),
                catchError((e) => {
                  console.error(
                    formatTime(Date.now()),
                    'FailedToSubmitOrder',
                    groupWithSameTarget.target_account_id,
                    JSON.stringify(order),
                    e,
                  );
                  return EMPTY;
                }),
              ),
            ),
            toArray(),
          ),
        ),
        timeout({
          each: 30_000,
          meta: `SimpleOrderTraderTimeout, target_account_id: ${groupWithSameTarget.target_account_id}`,
        }),
      ).subscribe(() => {
        LoopCompleteAction$.next();
      });

      const CyberTradeOrderDispatchAction$ = new Subject<IPositionDiff[]>();

      CyberTradeOrderDispatchAction$.pipe(
        //
        combineLatestWith(tradeConfig$.pipe(first())),
        mergeMap(([positionDiffList, tradeConfig]) => {
          const mapKeyToTradeConfig = Object.fromEntries(
            tradeConfig.map((v) => [`${v.account_id}-${v.product_id}`, v]),
          );
          return from(positionDiffList).pipe(
            //
            filter((positionDiff) => positionDiff.error_volume !== 0),
            tap((positionDiff) => {
              console.info(formatTime(Date.now()), `PositionDiff`, JSON.stringify(positionDiff));
            }),
            mergeMap((positionDiff): Observable<{ orders: IOrder[]; strategy: string }> => {
              const volume = Math.abs(positionDiff.error_volume);
              const config =
                mapKeyToTradeConfig[`${groupWithSameTarget.target_account_id}-${positionDiff.product_id}`];
              // if the config is not set or the volume is too small, no need to use Trade Algorithm
              if (config === undefined || volume < config.max_volume_per_order) {
                console.info(
                  formatTime(Date.now()),
                  `TradeConfigNotSetOrVolumeTooSmall`,
                  `${groupWithSameTarget.target_account_id}-${positionDiff.product_id}`,
                );
                return of({
                  orders: [
                    {
                      client_order_id: randomUUID(),
                      account_id: groupWithSameTarget.target_account_id,
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
                    },
                  ],
                  strategy: 'concurrent',
                });
              }
              // perform Trade Algorithm
              const order_count = Math.ceil(volume / config.max_volume_per_order);
              console.info(
                formatTime(Date.now()),
                `TradeConfigInitiated`,
                `with config ${JSON.stringify(config)}, total ${order_count} orders, volume per order ${
                  config.max_volume_per_order
                }`,
                `${groupWithSameTarget.target_account_id}-${positionDiff.product_id}`,
              );
              return generate({
                initialState: 0,
                condition: (i) => i < order_count,
                iterate: (i) => i + 1,
                resultSelector: (i: number): IOrder => ({
                  client_order_id: randomUUID(),
                  account_id: groupWithSameTarget.target_account_id,
                  type: OrderType.MARKET,
                  product_id: positionDiff.product_id,
                  // ISSUE: 必须使用 Math.floor，避免震荡下单 ("千分之五手问题")
                  volume:
                    i < order_count - 1
                      ? config.max_volume_per_order
                      : roundToStep(
                          volume - config.max_volume_per_order * (order_count - 1),
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
                toArray(),
                map((orders) => ({ orders, strategy: 'serial' })),
              );
            }),
          );
        }),
      ).subscribe(({ orders, strategy }) => {
        if (strategy === 'serial') {
          SerialOrderPlaceAction$.next(orders);
        } else {
          ConcurrentOrderPlaceAction$.next(orders);
        }
      });

      const LoopCompleteAction$ = new Subject<void>();

      const LoopStartAction$ = new Subject<void>();
      LoopCompleteAction$.pipe(
        //
        map(() => Date.now()),
      ).subscribe((t) => {
        CalcPositionDiffAction$.next(t);
      });

      const CalcPositionDiffAction$ = new Subject<number>();
      CalcPositionDiffAction$.pipe(
        tap(() => {
          // Reset residual error volume
          const product_ids = groupWithSameTarget.tasks
            .filter((task) => task.target_account_id === groupWithSameTarget.target_account_id)
            .map((v) => v.target_product_id);
          for (const product_id of product_ids) {
            MetricErrorVolumeRatio.reset({
              account_id: groupWithSameTarget.target_account_id,
              product_id,
              variant: PositionVariant.LONG,
            });
            MetricErrorVolumeRatio.reset({
              account_id: groupWithSameTarget.target_account_id,
              product_id,
              variant: PositionVariant.SHORT,
            });
          }
        }),
        mergeMap((t) =>
          combineLatest([
            terminal.useAccountInfo(groupWithSameTarget.target_account_id).pipe(
              //
              filter((info) => info.timestamp_in_us / 1000 > t),
            ),
            ...groupWithSameTarget.tasks.map((task) =>
              terminal.useAccountInfo(task.source_account_id).pipe(
                //
                filter((info) => info.timestamp_in_us / 1000 > t),
                map((info) => ({
                  info,
                  task,
                })),
              ),
            ),
          ]),
        ),
        first(),
        timeout({
          each: 30_000,
          meta: `AccountInfoTimeout, target_account_id: ${
            groupWithSameTarget.target_account_id
          }, source_account_id: ${Array.from(
            new Set(groupWithSameTarget.tasks.map((v) => v.source_account_id)),
          )}`,
        }),
        tap(([targetAccountInfo, ...SourceAccountInfoTaskList]) => {
          console.info(
            formatTime(Date.now()),
            `AccountInfoReady`,
            `targetAccountInfo: `,
            JSON.stringify(targetAccountInfo),
            `SourceAccountInfoTaskList: `,
            JSON.stringify(SourceAccountInfoTaskList),
          );
        }),
        mergeMap(([targetAccountInfo, ...SourceAccountInfoTaskList]) => {
          const targetPositions = mergePositions(targetAccountInfo.positions);
          const desiredTargetPositions$ = from(SourceAccountInfoTaskList).pipe(
            mergeMap(({ info, task }) =>
              from(info.positions).pipe(
                // keep the positions with the same product_id
                filter((position) => position.product_id === task.source_product_id),
                // filter by comment
                filter((position) => {
                  if (task.exclusive_comment_pattern) {
                    try {
                      return !new RegExp(task.exclusive_comment_pattern).test(position.comment ?? '');
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
                map(
                  (position) =>
                    (position.variant === PositionVariant.LONG
                      ? 1
                      : position.variant === PositionVariant.SHORT
                      ? -1
                      : 0) *
                    position.volume *
                    (task.multiple || 0), // Invalid position will fallback to zero.
                ),
              ),
            ),

            // sum up to target volume
            reduce((acc, cur) => acc + cur),
            // recover to target position
            map(
              (netVolume): IPosition => ({
                product_id: groupWithSameTarget.target_product_id,
                variant: netVolume > 0 ? PositionVariant.LONG : PositionVariant.SHORT,
                volume: Math.abs(netVolume),
                free_volume: Math.abs(netVolume),
                position_price: 0,
                floating_profit: 0,
                closable_price: 0,
                position_id: '',
              }),
            ),
            toArray(),
          );

          return desiredTargetPositions$.pipe(
            //
            map((desiredTargetPositions) => diffPosition(desiredTargetPositions, targetPositions)),
            tap((positionDiffList) => {
              for (const positionDiff of positionDiffList) {
                const volume_step = products[positionDiff.product_id]?.volume_step ?? 1;
                const error_ratio = positionDiff.error_volume / volume_step;
                console.info(
                  formatTime(Date.now()),
                  `ErrorVolumeRatio`,
                  groupWithSameTarget.target_account_id,
                  groupWithSameTarget.target_product_id,
                  `error_ratio = ${error_ratio.toFixed(4)}`,
                  JSON.stringify(positionDiff),
                );
                MetricErrorVolumeRatio.set(error_ratio, {
                  account_id: groupWithSameTarget.target_account_id,
                  product_id: positionDiff.product_id,
                  variant: positionDiff.variant,
                });
              }
            }),
          );
        }),
      ).subscribe((positionDiffList) => {
        CyberTradeOrderDispatchAction$.next(positionDiffList);
      });

      return generate({
        initialState: 0,
        iterate: (i) => i + 1,
      }).pipe(
        //
        tap(() => {
          console.info(
            formatTime(Date.now()),
            'LoopStart',
            groupWithSameTarget.target_account_id,
            groupWithSameTarget.target_product_id,
          );
        }),
        tap((i) => {
          LoopStartAction$.next();
        }),
        mergeMap(() => LoopCompleteAction$),
        tap(() => {
          console.info(
            formatTime(Date.now()),
            'LoopComplete',
            groupWithSameTarget.target_account_id,
            groupWithSameTarget.target_product_id,
          );
        }),
        catchError((e) => {
          console.error(
            formatTime(Date.now()),
            'LoopError',
            groupWithSameTarget.target_account_id,
            groupWithSameTarget.target_product_id,
            `${e instanceof TimeoutError ? `${e}: ${e.info?.meta}` : e}`,
          );
          return EMPTY;
        }),
        repeat({ delay: 2000 }),
      );
    }),
  )
  .subscribe();
