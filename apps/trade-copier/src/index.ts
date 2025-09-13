import { IAccountInfo, IPosition, useAccountInfo } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { IProduct } from '@yuants/data-product';
import { IPositionDiff, diffPosition, mergePositions } from '@yuants/kernel';
import { limitOrderController } from '@yuants/order';
import { PromRegistry, Terminal } from '@yuants/protocol';
import { requestSQL } from '@yuants/sql';
import { UUID, formatTime, roundToStep } from '@yuants/utils';
import {
  EMPTY,
  Observable,
  Subject,
  TimeoutError,
  catchError,
  combineLatest,
  combineLatestWith,
  concatMap,
  defaultIfEmpty,
  defer,
  distinct,
  filter,
  first,
  from,
  generate,
  groupBy,
  last,
  lastValueFrom,
  map,
  mergeMap,
  of,
  pairwise,
  reduce,
  repeat,
  retry,
  shareReplay,
  tap,
  timeout,
  toArray,
} from 'rxjs';
import { ITradeCopierTradeConfig, ITradeCopyRelation } from './interface';
import './migration';
import './new';

const terminal = Terminal.fromNodeEnv();

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

interface IPositionTarget {
  account_id: string;
  product_id: string;
  direction: string;
  volume: number;
}

const tradeConfig$ = defer(() =>
  requestSQL<ITradeCopierTradeConfig[]>(terminal, `select * from trade_copier_trade_config`),
).pipe(
  //
  retry({ delay: 1000 }),
  shareReplay(1),
);

const config$ = defer(() =>
  requestSQL<ITradeCopyRelation[]>(terminal, `select * from trade_copy_relation where disabled = false`),
)
  .pipe(
    //
    retry({ delay: 1000 }),
    map((data): ITradeCopierConfig => ({ tasks: data })),
  )
  .pipe(
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
    // init the status to 0
    tap((account_id) => {
      MetricsAccountSubscribeStatus.set(0, {
        account_id,
        terminal_id: terminal.terminal_id,
      });
    }),
    mergeMap((account_id) =>
      defer(() => useAccountInfo(terminal, account_id))
        .pipe(
          //
          first(),
        )
        .pipe(
          tap((accountInfo) => {
            MetricsAccountSubscribeStatus.set(1, {
              account_id: accountInfo.account_id,
              terminal_id: terminal.terminal_id,
            });
          }),
          timeout({ each: 60_000, meta: `SubscribeAccountInfoTimeout, account_id: ${account_id}` }),
          catchError((e) => {
            MetricsAccountSubscribeStatus.set(0, {
              account_id,
              terminal_id: terminal.terminal_id,
            });
            console.error(
              formatTime(Date.now()),
              `SubscribeAccountInfoError`,
              account_id,
              `${e instanceof TimeoutError ? `${e}: ${e.info?.meta}` : e}`,
            );
            return EMPTY;
          }),
          retry({ delay: 10_000 }),
          repeat({ delay: 10_000 }),
        ),
    ),
  )
  .subscribe();

// Observe the time lag between two account info
allAccountIds$
  .pipe(
    mergeMap((x) => x),
    mergeMap((account_id) =>
      from(useAccountInfo(terminal, account_id)).pipe(
        pairwise(),
        tap(([info1, info2]) => {
          const lag = info2.updated_at! - info1.updated_at!;
          MetricTimeLag.observe(lag, { account_id, terminal_id: terminal.terminal_id });
        }),
      ),
    ),
  )
  .subscribe();

const mapKeyToTaskGroup: Record<
  string,
  {
    target_account_id: string;
    target_product_id: string;
    products: Record<string, IProduct>;
    tasks: ITradeCopyRelation[];
  }
> = {};

const mapKeyToStartAction: Record<string, Subject<void>> = {};
const mapKeyToCompleteAction: Record<string, Subject<void>> = {};
const mapKeyToAccountInfoAggregateAction: Record<string, Subject<number>> = {};
const mapKeyToCalcPositionDiffAction: Record<
  string,
  Subject<{
    targetAccountInfo: IAccountInfo;
    sourceAccountInfoTaskList: Array<{ info: IAccountInfo; task: ITradeCopyRelation }>;
  }>
> = {};
const mapKeyToCyberTradeOrderDispatchAction: Record<string, Subject<IPositionDiff[]>> = {};
const mapKeyToSerialOrderPlaceAction: Record<string, Subject<IOrder[]>> = {};
const mapKeyToConcurrentOrderPlaceAction: Record<string, Subject<IOrder[]>> = {};
const mapKeyToLimitOrderPlaceAction: Record<string, Subject<IPositionTarget[]>> = {};

const products$ = defer(() => requestSQL<IProduct[]>(terminal, `select * from product`)).pipe(
  //
  timeout(10000),
  retry({ delay: 1000 }),
  repeat({ delay: 86400_000 }),
  shareReplay(1),
);

async function setup() {
  const groups = await lastValueFrom(
    config$.pipe(
      //
      mergeMap((x) => x.tasks),
      groupBy((task) => task.target_account_id),
      mergeMap((group) =>
        group.pipe(
          groupBy((task) => task.target_product_id),
          mergeMap((subGroup) =>
            subGroup.pipe(
              //
              toArray(),
              combineLatestWith(products$.pipe(first())),
              map(([tasks, products]) => ({
                target_account_id: group.key,
                target_product_id: subGroup.key,
                products: Object.fromEntries(products.map((v) => [v.product_id, v])),
                tasks,
              })),
            ),
          ),
        ),
      ),
      toArray(),
    ),
  );

  for (const group of groups) {
    const key = `${group.target_account_id}-${group.target_product_id}`;

    mapKeyToTaskGroup[key] = group;

    // setup StartAction
    const StartAction$ = new Subject<void>();
    mapKeyToStartAction[key] = StartAction$;
    StartAction$.subscribe(() => {
      console.debug(formatTime(Date.now()), 'StartActionTriggered', key);
    });
    StartAction$.subscribe(() => {
      // Reset residual error volume
      const product_ids = group.tasks
        .filter((task) => task.target_account_id === group.target_account_id)
        .map((v) => v.target_product_id);
      for (const product_id of product_ids) {
        MetricErrorVolumeRatio.reset({
          account_id: group.target_account_id,
          product_id,
          variant: 'LONG',
        });
        MetricErrorVolumeRatio.reset({
          account_id: group.target_account_id,
          product_id,
          variant: 'SHORT',
        });
      }
    });
    StartAction$.pipe(
      //
      map(() => Date.now()),
    ).subscribe((t) => {
      mapKeyToAccountInfoAggregateAction[key].next(t);
    });

    // setup CompleteAction
    const CompleteAction$ = new Subject<void>();
    mapKeyToCompleteAction[key] = CompleteAction$;
    CompleteAction$.subscribe(() => {
      console.debug(formatTime(Date.now()), 'CompleteActionTriggered', key);
    });
    CompleteAction$.subscribe(() => {
      mapKeyToStartAction[key].next();
    });

    // setup AccountInfoAggregateAction
    const AccountInfoAggregateAction$ = new Subject<number>();
    mapKeyToAccountInfoAggregateAction[key] = AccountInfoAggregateAction$;
    AccountInfoAggregateAction$.subscribe(() => {
      console.debug(formatTime(Date.now()), 'AccountInfoAggregateActionTriggered', key);
    });
    AccountInfoAggregateAction$.pipe(
      //
      mergeMap((t) =>
        combineLatest([
          from(useAccountInfo(terminal, group.target_account_id)).pipe(
            //
            filter((info) => info.updated_at! > t),
          ),
          ...group.tasks.map((task) =>
            from(useAccountInfo(terminal, task.source_account_id)).pipe(
              //
              filter((info) => info.updated_at! > t),
              map((info) => ({
                info,
                task,
              })),
            ),
          ),
        ]).pipe(
          //
          first(),
          timeout({
            each: 30_000,
            meta: `AccountInfoTimeout, target_account_id: ${
              group.target_account_id
            }, source_account_id: ${group.tasks.map((v) => v.source_account_id)}`,
          }),
          catchError((e) => {
            console.error(
              formatTime(Date.now()),
              `AccountInfoError`,
              key,
              `${e instanceof TimeoutError ? `${e}: ${e.info?.meta}` : e}`,
            );
            throw e;
          }),
          retry(),
          map(([targetAccountInfo, ...sourceAccountInfoTaskList]) => ({
            targetAccountInfo,
            sourceAccountInfoTaskList,
          })),
        ),
      ),
    ).subscribe((result) => {
      mapKeyToCalcPositionDiffAction[key].next(result);
    });

    // setup CalcPositionDiffAction
    const CalcPositionDiffAction$ = new Subject<{
      targetAccountInfo: IAccountInfo;
      sourceAccountInfoTaskList: Array<{ info: IAccountInfo; task: ITradeCopyRelation }>;
    }>();
    mapKeyToCalcPositionDiffAction[key] = CalcPositionDiffAction$;
    CalcPositionDiffAction$.subscribe(({ targetAccountInfo, sourceAccountInfoTaskList }) => {
      console.debug(
        formatTime(Date.now()),
        'CalcPositionDiffActionTriggered',
        key,
        JSON.stringify(targetAccountInfo),
        JSON.stringify(sourceAccountInfoTaskList),
      );
    });
    CalcPositionDiffAction$.pipe(
      mergeMap(({ targetAccountInfo, sourceAccountInfoTaskList }) => {
        const targetPositions = mergePositions(targetAccountInfo.positions).filter(
          (position) => position.product_id === group.target_product_id,
        );
        const desiredTargetPositions$ = from(sourceAccountInfoTaskList).pipe(
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
                    console.error(formatTime(Date.now()), key, e);
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
                  (position.direction === 'LONG' ? 1 : position.direction === 'SHORT' ? -1 : 0) *
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
              product_id: group.target_product_id,
              direction: netVolume > 0 ? 'LONG' : 'SHORT',
              volume: Math.abs(netVolume),
              free_volume: Math.abs(netVolume),
              position_price: 0,
              floating_profit: 0,
              closable_price: 0,
              position_id: '',
              valuation: 0,
            }),
          ),
          toArray(),
        );

        return desiredTargetPositions$.pipe(
          //
          map((desiredTargetPositions) => diffPosition(desiredTargetPositions, targetPositions)),
          tap((positionDiffList) => {
            for (const positionDiff of positionDiffList) {
              const volume_step = group.products[positionDiff.product_id]?.volume_step ?? 1;
              const error_ratio = positionDiff.error_volume / volume_step;
              console.info(
                formatTime(Date.now()),
                `ErrorVolumeRatio`,
                key,
                `error_ratio = ${error_ratio.toFixed(4)}`,
                JSON.stringify(positionDiff),
              );
              MetricErrorVolumeRatio.set(error_ratio, {
                account_id: group.target_account_id,
                product_id: positionDiff.product_id,
                variant: positionDiff.direction,
              });
            }
          }),
        );
      }),
    ).subscribe((positionDiffList) => {
      mapKeyToCyberTradeOrderDispatchAction[key].next(positionDiffList);
    });

    // setup CyberTradeOrderDispatchAction
    const CyberTradeOrderDispatchAction$ = new Subject<IPositionDiff[]>();
    mapKeyToCyberTradeOrderDispatchAction[key] = CyberTradeOrderDispatchAction$;
    CyberTradeOrderDispatchAction$.subscribe((positionDiffList) => {
      console.debug(
        formatTime(Date.now()),
        'CyberTradeOrderDispatchActionTriggered',
        key,
        JSON.stringify(positionDiffList),
      );
    });
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
          mergeMap(
            (
              positionDiff,
            ): Observable<{ orders: IOrder[]; positionTargets: IPositionTarget[]; strategy: string }> => {
              const volume = Math.abs(positionDiff.error_volume);
              const config = mapKeyToTradeConfig[key];

              // ISSUE: to prevent position oscillation, we should not place order when the volume is too small,
              //        the threshold could be any number in (0.5, 1), we take a magic number 0.618.
              if (volume < 0.618 * (group.products[positionDiff.product_id]?.volume_step ?? 1)) {
                console.info(formatTime(Date.now()), `VolumeTooSmall`, key);
                return of({ orders: [], positionTargets: [], strategy: 'none' });
              }

              // if the config is not set or the volume is too small, no need to use Trade Algorithm
              if (config === undefined || volume < config.max_volume_per_order) {
                console.info(formatTime(Date.now()), `TradeConfigNotSetOrVolumeTooSmall`, key);
                const rounded_volume = roundToStep(
                  volume,
                  group.products[positionDiff.product_id]?.volume_step ?? 1,
                );
                if (rounded_volume === 0) {
                  return of({ orders: [], positionTargets: [], strategy: 'none' });
                }
                return of({
                  orders: [
                    {
                      order_id: UUID(),
                      account_id: group.target_account_id,
                      order_type: 'MARKET',
                      product_id: positionDiff.product_id,
                      volume: rounded_volume,
                      order_direction:
                        positionDiff.direction === 'LONG'
                          ? positionDiff.error_volume > 0
                            ? 'OPEN_LONG'
                            : 'CLOSE_LONG'
                          : positionDiff.error_volume > 0
                          ? 'OPEN_SHORT'
                          : 'CLOSE_SHORT',
                    },
                  ],
                  positionTargets: [
                    {
                      account_id: group.target_account_id,
                      datasource_id: group.products[positionDiff.product_id]?.datasource_id ?? '',
                      product_id: positionDiff.product_id,
                      volume: positionDiff.volume_in_source,
                      direction: positionDiff.direction,
                    },
                  ],
                  strategy: config?.limit_order_control ? 'serial-limit' : 'concurrent',
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
                key,
              );
              if (config.limit_order_control) {
                return generate({
                  initialState: 0,
                  condition: (i) => i < order_count,
                  iterate: (i) => i + 1,
                  resultSelector: (i: number): IPositionTarget => ({
                    account_id: group.target_account_id,
                    product_id: positionDiff.product_id,
                    volume: i < order_count - 1 ? config.max_volume_per_order * i : volume,
                    direction: positionDiff.direction,
                  }),
                }).pipe(
                  //
                  toArray(),
                  map((positionTargets) => ({ positionTargets, orders: [], strategy: 'serial-limit' })),
                );
              } else {
                return generate({
                  initialState: 0,
                  condition: (i) => i < order_count,
                  iterate: (i) => i + 1,
                  resultSelector: (i: number): IOrder => ({
                    order_id: UUID(),
                    account_id: group.target_account_id,
                    order_type: 'MARKET',
                    product_id: positionDiff.product_id,
                    volume:
                      i < order_count - 1
                        ? config.max_volume_per_order
                        : roundToStep(
                            volume - config.max_volume_per_order * (order_count - 1),
                            group.products[positionDiff.product_id]?.volume_step ?? 1,
                          ),
                    order_direction:
                      positionDiff.direction === 'LONG'
                        ? positionDiff.error_volume > 0
                          ? 'OPEN_LONG'
                          : 'CLOSE_LONG'
                        : positionDiff.error_volume > 0
                        ? 'OPEN_SHORT'
                        : 'CLOSE_SHORT',
                  }),
                }).pipe(
                  //
                  toArray(),
                  map((orders) => ({ positionTargets: [], orders, strategy: 'serial' })),
                );
              }
            },
          ),
          toArray(),
          map((orderPackList) => {
            if (orderPackList.some((pack) => pack.strategy === 'serial')) {
              return {
                orders: orderPackList.flatMap((pack) => pack.orders),
                positionTargets: [],
                strategy: 'serial',
              };
            }
            if (orderPackList.some((pack) => pack.strategy === 'serial-limit')) {
              return {
                positionTargets: orderPackList.flatMap((pack) => pack.positionTargets),
                orders: [],
                strategy: 'serial-limit',
              };
            }
            return {
              orders: orderPackList.flatMap((pack) => pack.orders),
              positionTargets: [],
              strategy: 'concurrent',
            };
          }),
          filter(({ orders, positionTargets }) => orders.length > 0 || positionTargets.length > 0),
          defaultIfEmpty({
            orders: [] as IOrder[],
            positionTargets: [] as IPositionTarget[],
            strategy: 'none',
          }),
        );
      }),
    ).subscribe(({ orders, positionTargets, strategy }) => {
      if (orders.length === 0 && positionTargets.length === 0) {
        // ISSUE: FOR HIGH FREQUENCY TRADING, WAIT 1s UNTIL NEXT LOOP MAY CAUSE LAG
        mapKeyToCompleteAction[key].next();
        return;
      }
      if (strategy === 'serial') {
        mapKeyToSerialOrderPlaceAction[key].next(orders);
      } else if (strategy === 'concurrent') {
        mapKeyToConcurrentOrderPlaceAction[key].next(orders);
      } else if (strategy === 'serial-limit') {
        mapKeyToLimitOrderPlaceAction[key].next(positionTargets);
      } else {
        mapKeyToCompleteAction[key].next();
      }
    });

    const LimitOrderPlaceAction$ = new Subject<IPositionTarget[]>();
    mapKeyToLimitOrderPlaceAction[key] = LimitOrderPlaceAction$;
    LimitOrderPlaceAction$.subscribe((positionTargets) => {
      console.debug(
        formatTime(Date.now()),
        'LimitOrderPlaceActionTriggered',
        key,
        `total ${positionTargets.length} positions`,
        JSON.stringify(positionTargets),
      );
    });
    LimitOrderPlaceAction$.pipe(
      mergeMap((positionTargets) =>
        from(positionTargets).pipe(
          concatMap((positionTarget) => {
            const theProduct = group.products[positionTarget.product_id];
            if (!theProduct) {
              console.error(formatTime(Date.now()), `ProductNotFound`, JSON.stringify(positionTarget));
              return of(void 0);
            }
            return defer(() => limitOrderController(terminal, theProduct, positionTarget)).pipe(
              // No cancel for now.
              last(),
            );
          }),
          toArray(),
        ),
      ),
    ).subscribe(() => {
      mapKeyToCompleteAction[key].next();
    });

    // setup SerialOrderPlaceAction
    const SerialOrderPlaceAction$ = new Subject<IOrder[]>();
    mapKeyToSerialOrderPlaceAction[key] = SerialOrderPlaceAction$;
    SerialOrderPlaceAction$.subscribe((orders) => {
      console.debug(
        formatTime(Date.now()),
        'SerialOrderPlaceActionTriggered',
        key,
        `total ${orders.length} orders`,
        JSON.stringify(orders),
      );
    });
    SerialOrderPlaceAction$.pipe(
      mergeMap((orders) =>
        from(orders).pipe(
          filter((order) => order.volume > 0),
          concatMap((order) =>
            from(terminal.client.requestForResponse('SubmitOrder', order)).pipe(
              tap(() => {
                console.info(formatTime(Date.now()), `SucceedToSubmitOrder`, key, JSON.stringify(order));
              }),
              timeout({
                each: 30_000,
                meta: `SerialOrderPlaceAction, target_account_id: ${group.target_account_id}, target_product_id: ${group.target_product_id}`,
              }),
              catchError((e) => {
                console.error(formatTime(Date.now()), 'FailedToSubmitOrder', key, JSON.stringify(order), e);
                return EMPTY;
              }),
            ),
          ),
          toArray(),
        ),
      ),
    ).subscribe(() => {
      mapKeyToCompleteAction[key].next();
    });

    // setup ConcurrentOrderPlaceAction
    const ConcurrentOrderPlaceAction$ = new Subject<IOrder[]>();
    mapKeyToConcurrentOrderPlaceAction[key] = ConcurrentOrderPlaceAction$;
    ConcurrentOrderPlaceAction$.subscribe((orders) => {
      console.debug(
        formatTime(Date.now()),
        'ConcurrentOrderPlaceActionTriggered',
        key,
        `total ${orders.length} orders`,
        JSON.stringify(orders),
      );
    });
    ConcurrentOrderPlaceAction$.pipe(
      mergeMap((orders) =>
        from(orders).pipe(
          filter((order) => order.volume > 0),
          mergeMap((order) =>
            from(terminal.client.requestForResponse('SubmitOrder', order)).pipe(
              tap(() => {
                console.info(formatTime(Date.now()), `SucceedToSubmitOrder`, key, JSON.stringify(order));
              }),
              timeout({
                each: 30_000,
                meta: `ConcurrentOrderPlaceAction, target_account_id: ${group.target_account_id}, target_product_id: ${group.target_product_id}`,
              }),
              catchError((e) => {
                console.error(formatTime(Date.now()), 'FailedToSubmitOrder', key, JSON.stringify(order), e);
                return EMPTY;
              }),
            ),
          ),
          toArray(),
        ),
      ),
    ).subscribe(() => {
      mapKeyToCompleteAction[key].next();
    });
  }

  // first driving force of GOD.
  for (const startAction of Object.values(mapKeyToStartAction)) {
    startAction.next();
  }
}

setup();
