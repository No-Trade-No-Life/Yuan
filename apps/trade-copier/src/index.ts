import {
  IOrder,
  IPosition,
  IProduct,
  mapPositionVariantToNetPositionCoef,
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
  catchError,
  combineLatest,
  combineLatestWith,
  defer,
  distinct,
  EMPTY,
  filter,
  first,
  from,
  groupBy,
  map,
  merge,
  mergeMap,
  Observable,
  of,
  pairwise,
  reduce,
  repeat,
  share,
  shareReplay,
  skip,
  tap,
  throwError,
  timeout,
  timer,
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
  tap((config) => console.info(new Date(), '读取配置', JSON.stringify(config))),
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

// 建议当 Lag 过高时进行报警
const MetricTimeLag = PromRegistry.create(
  'histogram',
  'trade_copier_account_info_time_lag_ms',
  'the time lag from info itself to copier received',
  [500, 1000, 1500, 2000, 10000],
);

// 建议长期高于 1 时报警
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

// 所有涉及的账户
const allAccountIds$ = config$.pipe(
  mergeMap((x) => x.tasks),
  mergeMap((task) => of(task.source_account_id, task.target_account_id)),
  distinct(),
  toArray(),
  shareReplay(1),
);

// 检查所有账户的订阅是否成功
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
    console.info(new Date(), `成功订阅所有相关的 ${x.length} 个账户`);
    terminal.terminalInfo.status = 'OK';
  });

// 检查两次账户流信息之间的时间差
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
    // 查询所有跟单账户内的品种信息
    mergeMap((group) =>
      defer(() => useProducts(group.key).pipe(first())).pipe(
        // 打包
        map((products) => ({ products, group })),
      ),
    ),

    mergeMap(({ group: groupWithSameTarget, products }) => {
      console.info(new Date(), '设置跟单账户', groupWithSameTarget.key);

      const sourceAccountInfos$ = from(groupWithSameTarget.tasks).pipe(
        // 组合最新的一批信号源
        map((task) =>
          terminal.useAccountInfo(task.source_account_id).pipe(
            // 打标
            map((info) => ({ info, task })),
          ),
        ),
        toArray(),
        mergeMap((x) => combineLatest(x)),
        shareReplay(1),
      );

      const source$: Observable<IPosition[]> = sourceAccountInfos$
        .pipe(
          tap((x) => console.info(new Date(), '阵列输入', groupWithSameTarget.key, JSON.stringify(x))),
          // foreach position
          mergeMap((x) =>
            from(x).pipe(
              mergeMap(({ task, info }) =>
                from(info.positions).pipe(
                  // 仅需要对应的品种
                  filter((position) => position.product_id === task.source_product_id),
                  // 根据头寸的备注过滤头寸
                  filter((position) => {
                    if (task.exclusive_comment_pattern) {
                      try {
                        return !new RegExp(task.exclusive_comment_pattern).test(position.comment ?? '');
                      } catch (e) {
                        console.error(new Date(), e);
                        return false; // 如果表达式构造出错，认为是严重的错误，直接过滤所有相关头寸，等效于平仓
                      }
                    }
                    // 如果没有配置表达式（包括留空串），认为是一律通过
                    return true;
                  }),
                  // 改名
                  map((position) => ({
                    ...position,
                    product_id: task.target_product_id,
                  })),
                  // 倍数 (允许反向)
                  map((position) => {
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
                  // 过滤为 0 和运算结果非法的头寸
                  filter((position) => position.volume > 0),
                ),
              ),

              // 合并相同性质的头寸
              groupBy((position) => position.product_id),
              mergeMap((groupWithSameProductId) =>
                groupWithSameProductId.pipe(
                  groupBy((position) => position.variant),
                  mergeMap((groupWithSameVariant) =>
                    groupWithSameVariant.pipe(
                      reduce(
                        (acc: IPosition, cur): IPosition => ({
                          ...acc,
                          volume: acc.volume + cur.volume,
                          free_volume: acc.free_volume + cur.free_volume,
                          position_price:
                            (acc.position_price * acc.volume + cur.position_price * cur.volume) /
                            (acc.volume + cur.volume),
                          floating_profit: acc.floating_profit + cur.floating_profit,
                        }),
                      ),
                    ),
                  ),
                ),
              ),
              toArray(),
            ),
          ),
        )
        .pipe(
          //
          share(),
        );

      const target$ = terminal.useAccountInfo(groupWithSameTarget.key);
      // 仅由 target$ 触发;
      // source$ 的更新不应触发后续的重新计算
      const positionDiff$ = target$.pipe(
        //
        combineLatestWith(
          config$.pipe(
            first(),
            map((config) => config.tasks),
          ),
        ),
        tap(([info, tasks]) => {
          // 重置残差率
          const product_ids = tasks
            .filter((task) => task.target_account_id === info.account_id)
            .map((v) => v.target_product_id);
          for (const product_id of product_ids) {
            MetricErrorVolumeRatio.reset({
              account_id: info.account_id,
              product_id,
              variant: PositionVariant.LONG,
            });
            MetricErrorVolumeRatio.reset({
              account_id: info.account_id,
              product_id,
              variant: PositionVariant.SHORT,
            });
          }
        }),
        map(([info]) => info),
        map((info) => info.positions),
        mergeMap((positions) =>
          from(positions).pipe(
            // 合并相同性质的头寸
            groupBy((position) => position.product_id),
            mergeMap((groupWithSameProductId) =>
              groupWithSameProductId.pipe(
                groupBy((position) => position.variant),
                mergeMap((groupWithSameVariant) =>
                  groupWithSameVariant.pipe(
                    reduce(
                      (acc, cur): IPosition => ({
                        ...acc,
                        volume: acc.volume + cur.volume,
                        free_volume: acc.free_volume + cur.free_volume,
                        position_price:
                          (acc.position_price * acc.volume + cur.position_price * cur.volume) /
                          (acc.volume + cur.volume),
                        floating_profit: acc.floating_profit + cur.floating_profit,
                      }),
                    ),
                  ),
                ),
              ),
            ),
            toArray(),
          ),
        ),
        //
        map((targetPositions) =>
          //  取 Replay 的最新值 (但不监听它的更新)
          defer(() => source$.pipe(first())).pipe(
            // 打包
            map((sourcePositions) => ({ targetPositions, sourcePositions })),
            tap((x) => console.info(new Date(), '头寸对比', groupWithSameTarget.key, JSON.stringify(x))),
            mergeMap(({ targetPositions, sourcePositions }) =>
              // Join Positions Table with key product_id and variant
              merge<any>(
                // 列改名
                from(sourcePositions).pipe(
                  map((position) => ({
                    product_id: position.product_id,
                    variant: position.variant,
                    volumeInSource: position.volume,
                  })),
                ),
                from(targetPositions).pipe(
                  map((position) => ({
                    product_id: position.product_id,
                    variant: position.variant,
                    volumeInTarget: position.volume,
                  })),
                ),
              ).pipe(
                groupBy((pos) => pos.product_id),
                mergeMap((group) =>
                  group.pipe(
                    groupBy((pos) => pos.variant),
                    mergeMap((subGroup) =>
                      subGroup.pipe(
                        // Merge
                        reduce(
                          (
                            acc: {
                              product_id: string;
                              variant: PositionVariant;
                              volumeInSource: number;
                              volumeInTarget: number;
                            },
                            cur,
                          ) => ({ ...acc, ...cur }),
                        ),
                      ),
                    ),
                    map((pos) => ({
                      product_id: pos.product_id,
                      variant: pos.variant,
                      volumeInSource: pos.volumeInSource ?? 0,
                      volumeInTarget: pos.volumeInTarget ?? 0,
                      errorVolume: (pos.volumeInSource ?? 0) - (pos.volumeInTarget ?? 0),
                    })),
                    tap((x) => {
                      const error_ratio = x.errorVolume / (products[x.product_id]?.volume_step ?? 1);
                      console.info(
                        new Date(),
                        '头寸残差',
                        groupWithSameTarget.key,
                        `error_ratio=${error_ratio.toFixed(4)}`,
                        JSON.stringify(x),
                      );
                      MetricErrorVolumeRatio.set(error_ratio, {
                        account_id: groupWithSameTarget.key,
                        product_id: x.product_id,
                        variant: x.variant,
                      });
                    }),
                  ),
                ),
                //
              ),
            ),
          ),
        ),
      );

      const ordersToSend$ = positionDiff$.pipe(
        mergeMap((items) =>
          items
            .pipe(
              filter((item) => item.errorVolume !== 0),
              map(
                (item): IOrder => ({
                  client_order_id: randomUUID(),
                  account_id: groupWithSameTarget.key,
                  type: OrderType.MARKET,
                  product_id: item.product_id,
                  // ISSUE: 必须使用 Math.floor，避免震荡下单 ("千分之五手问题")
                  volume: roundToStep(
                    Math.abs(item.errorVolume),
                    products[item.product_id]?.volume_step ?? 1,
                    Math.floor,
                  ),
                  direction:
                    item.variant === PositionVariant.LONG
                      ? item.errorVolume > 0
                        ? OrderDirection.OPEN_LONG
                        : OrderDirection.CLOSE_LONG
                      : item.errorVolume > 0
                      ? OrderDirection.OPEN_SHORT
                      : OrderDirection.CLOSE_SHORT,
                }),
              ),
            )
            .pipe(
              filter((v) => v.volume > 0),
              toArray(),
            ),
        ),
        share(),
      );

      return defer(() => ordersToSend$.pipe(first())).pipe(
        tap((x) => console.info(new Date(), `计划下单`, groupWithSameTarget.key, JSON.stringify(x))),
        mergeMap((v) => v),
        mergeMap((order) =>
          terminal.submitOrder(order).pipe(
            timeout(30000),
            catchError((e) => {
              console.error(new Date(), '下单失败', groupWithSameTarget.key, order, e);
              return EMPTY;
            }),
          ),
        ),

        repeat({
          delay: () =>
            // target$ 可能没有及时更新
            timer(2000).pipe(
              mergeMap(() => target$),
              // 等到下一个 target$ 再进行下一波下单
              skip(1),
            ),
        }),
      );
    }),
  )
  .subscribe();
