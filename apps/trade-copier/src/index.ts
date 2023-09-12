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
  catchError,
  combineLatest,
  defer,
  distinct,
  filter,
  first,
  from,
  groupBy,
  map,
  mergeAll,
  mergeMap,
  of,
  pairwise,
  reduce,
  repeat,
  shareReplay,
  tap,
  throwError,
  toArray,
} from 'rxjs';
import { ITradeCopyRelation } from './utils';

const HV_URL = process.env.HV_URL || 'ws://localhost:8888';
const TERMINAL_ID = process.env.TERMINAL_ID || `TradeCopier`;
const terminal = new Terminal(HV_URL, { terminal_id: TERMINAL_ID, name: 'Trade Copier' });
const STORAGE_TERMINAL_ID = process.env.STORAGE_TERMINAL_ID!;

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

const ajv = new Ajv();
addFormats(ajv);
const validate = ajv.compile(configSchema);

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
  tap((config) => console.info(formatTime(Date.now()), '读取配置', JSON.stringify(config))),
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
    terminal.terminalInfo.status = '错误的配置格式';
    throw err;
  }),
  shareReplay(1),
);

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
    map((account_id) =>
      terminal.useAccountInfo(account_id).pipe(
        //
        first(),
      ),
    ),
    toArray(),
    mergeMap((x) => combineLatest(x)),
  )
  .subscribe((x) => {
    console.info(new Date(), `SubscribeSuccess`, `total ${x.length} accounts`);
    terminal.terminalInfo.status = 'OK';
  });

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
        '设置跟单账户',
        groupWithSameTarget.key,
        JSON.stringify(groupWithSameTarget.tasks),
      );

      return defer(() => of(0)).pipe(
        // Log
        tap(() => console.info(formatTime(Date.now()), 'LoopStart', groupWithSameTarget.key)),
        mergeMap(() => {
          const t = Date.now();

          // 重置残差率
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
                                console.error(new Date(), e);
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

            mergeMap((positionDiffList) =>
              from(positionDiffList).pipe(
                //
                filter((positionDiff) => positionDiff.error_volume !== 0),
                map(
                  (item): IOrder => ({
                    client_order_id: randomUUID(),
                    account_id: groupWithSameTarget.key,
                    type: OrderType.MARKET,
                    product_id: item.product_id,
                    // ISSUE: 必须使用 Math.floor，避免震荡下单 ("千分之五手问题")
                    volume: roundToStep(
                      Math.abs(item.error_volume),
                      products[item.product_id]?.volume_step ?? 1,
                      Math.floor,
                    ),
                    direction:
                      item.variant === PositionVariant.LONG
                        ? item.error_volume > 0
                          ? OrderDirection.OPEN_LONG
                          : OrderDirection.CLOSE_LONG
                        : item.error_volume > 0
                        ? OrderDirection.OPEN_SHORT
                        : OrderDirection.CLOSE_SHORT,
                  }),
                ),
                filter((v) => v.volume > 0),
                toArray(),
              ),
            ),
            // NOTE: here goes the algorithm trading
            mergeMap((orders) =>
              of(orders).pipe(
                //
                tap((orders) => {
                  console.info(new Date(), `OrdersToSubmit`, groupWithSameTarget.key, JSON.stringify(orders));
                }),
                mergeAll(),
                mergeMap((order) =>
                  terminal.submitOrder(order).pipe(
                    catchError((e) => {
                      console.error(new Date(), 'FailedToSubmitOrder', groupWithSameTarget.key, order, e);
                      return EMPTY;
                    }),
                  ),
                ),
              ),
            ),
          );
        }),
        catchError((e) => {
          console.error(formatTime(Date.now()), 'LoopError', groupWithSameTarget.key, `${e}`);
          return EMPTY;
        }),
        repeat({ delay: 2000 }),
      );
    }),
  )
  .subscribe();
