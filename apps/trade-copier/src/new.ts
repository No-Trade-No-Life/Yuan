import { useAccountInfo } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { IProduct } from '@yuants/data-product';
import { PromRegistry, Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { decodePath, encodePath, formatTime, listWatch, roundToStep } from '@yuants/utils';
import { defer, firstValueFrom, map, repeat, retry, skip, tap, timeout } from 'rxjs';
import { ITradeCopierConfig, ITradeCopierStrategyBase } from './interface';

const terminal = Terminal.fromNodeEnv();

const MetricRunStrategyResultCounter = PromRegistry.create('counter', 'trade_copier_run_strategy_result');

const MetricRunStrategyContextGauge = PromRegistry.create('gauge', 'trade_copier_run_strategy_context');

const runStrategy = async (account_id: string, productKey: string, strategy: ITradeCopierStrategyBase) => {
  const expected_account_id = `TradeCopier/Expected/${account_id}`;
  const [datasource_id, product_id] = decodePath(productKey);
  // 一次性将所需的数据拉取完毕 (考虑性能优化可以使用 cache 机制)
  // 不同的下单策略所需的策略不同，这里先简单实现市价追入所需的数据
  const [[theProduct], actualAccountInfo, expectedAccountInfo] = await Promise.all([
    requestSQL<IProduct[]>(
      terminal,
      `select * from product where product_id = ${escapeSQL(product_id)} and datasource_id = ${escapeSQL(
        datasource_id,
      )}`,
    ),
    // ISSUE: useAccountInfo 可能会拉到上一次没更新的数据，需要跳过一个来保证数据是最新的
    firstValueFrom(useAccountInfo(terminal, account_id).pipe(skip(1))),
    firstValueFrom(useAccountInfo(terminal, expected_account_id)),
  ]);

  // 计算实际账户和预期账户的持仓差异
  const actualPositions = actualAccountInfo.positions.filter((p) => p.product_id === product_id);
  const actualLongVolume = actualPositions
    .filter((p) => p.direction === 'LONG')
    .reduce((a, b) => a + b.volume, 0);
  const actualShortVolume = actualPositions
    .filter((p) => p.direction === 'SHORT')
    .reduce((a, b) => a + b.volume, 0);
  const actualNetVolume = actualLongVolume - actualShortVolume;
  const expectedPositions = expectedAccountInfo.positions.filter((p) => p.product_id === product_id);
  const expectedLongVolume = expectedPositions
    .filter((p) => p.direction === 'LONG')
    .reduce((a, b) => a + b.volume, 0);
  const expectedShortVolume = expectedPositions
    .filter((p) => p.direction === 'SHORT')
    .reduce((a, b) => a + b.volume, 0);
  const expectedNetVolume = expectedLongVolume - expectedShortVolume;
  const lowerBound = roundToStep(expectedNetVolume, theProduct.volume_step, Math.floor);
  const upperBound = roundToStep(expectedNetVolume, theProduct.volume_step, Math.ceil);
  const delta_volume =
    actualNetVolume < lowerBound
      ? lowerBound - actualNetVolume
      : actualNetVolume > upperBound
      ? upperBound - actualNetVolume
      : 0;

  console.info(
    formatTime(Date.now()),
    'EchoContext',
    `account ${account_id}, product ${productKey}: actualNetVolume=${actualNetVolume}, expectedNetVolume=${expectedNetVolume}, bounds=[${lowerBound}, ${upperBound}], delta_volume=${delta_volume}`,
  );

  MetricRunStrategyContextGauge.set(actualNetVolume, {
    type: 'actual_net_volume',
    account_id,
    product: productKey,
  });
  MetricRunStrategyContextGauge.set(expectedNetVolume, {
    type: 'expected_net_volume',
    account_id,
    product: productKey,
  });
  MetricRunStrategyContextGauge.set(lowerBound, {
    type: 'lower_bound',
    account_id,
    product: productKey,
  });
  MetricRunStrategyContextGauge.set(upperBound, {
    type: 'upper_bound',
    account_id,
    product: productKey,
  });
  MetricRunStrategyContextGauge.set(delta_volume, {
    type: 'delta_volume',
    account_id,
    product: productKey,
  });

  // 实际值在容忍区间之间，不需要下单 (但是某些策略可能需要撤单)
  if (lowerBound <= actualNetVolume && actualNetVolume <= upperBound) {
    console.info(formatTime(Date.now()), `NoActionNeeded`, `account=${account_id}, product=${productKey}`);
    return;
  }

  let order_direction: string;
  let volume: number;

  if (delta_volume > 0) {
    if (actualShortVolume > 0) {
      // 先平空
      order_direction = 'CLOSE_SHORT';
      volume = Math.min(delta_volume, actualShortVolume);
    } else {
      order_direction = 'OPEN_LONG';
      volume = delta_volume;
    }
  } else {
    if (actualLongVolume > 0) {
      // 先平多
      order_direction = 'CLOSE_LONG';
      volume = Math.min(-delta_volume, actualLongVolume);
    } else {
      order_direction = 'OPEN_SHORT';
      volume = -delta_volume;
    }
  }

  const order: IOrder = {
    order_type: 'MARKET',
    account_id: account_id,
    product_id: product_id,
    order_direction: order_direction,
    volume: roundToStep(Math.min(volume, strategy.max_volume ?? Infinity), theProduct.volume_step),
  };
  await terminal.client.requestForResponse('SubmitOrder', order);
  console.info(formatTime(Date.now()), `OrderSubmitted`, JSON.stringify(order));
};

defer(() =>
  requestSQL<ITradeCopierConfig[]>(terminal, `select * from trade_copier_config where enabled = true`),
)
  .pipe(retry({ delay: 1000 }), repeat({ delay: 1000 }))
  .pipe(
    listWatch(
      (x) => x.account_id,
      (config) => {
        const expectedAccountId = `TradeCopier/Expected/${config.account_id}`;
        const expectedAccountInfo$ = useAccountInfo(terminal, expectedAccountId);

        return expectedAccountInfo$.pipe(
          map((x) => [...new Set(x.positions.map((p) => encodePath(p.datasource_id, p.product_id)))]),
          listWatch(
            (x) => x,
            (productKey) =>
              // runContext 是简短执行一步的函数，负责拉取所需的数据并且下单/撤单一次
              defer(() =>
                runStrategy(
                  config.account_id,
                  productKey,
                  Object.assign({}, config.strategy.global, config.strategy.product_overrides?.[productKey]),
                ),
              ).pipe(
                timeout(60_000),
                tap({
                  complete: () => {
                    MetricRunStrategyResultCounter.add(1, {
                      result: 'complete',
                      account_id: config.account_id,
                      product: productKey,
                    });
                  },
                  error: (err) => {
                    MetricRunStrategyResultCounter.add(1, {
                      result: 'error',
                      account_id: config.account_id,
                      product: productKey,
                    });
                    console.info(
                      formatTime(Date.now()),
                      'RunStrategyError',
                      `account=${config.account_id}, product=${productKey}`,
                      err,
                    );
                  },
                }),
                retry({ delay: 1000 }),
                repeat({ delay: 1000 }),
                tap({
                  subscribe: () => {
                    console.info(
                      formatTime(Date.now()),
                      `StrategyStart`,
                      `account=${config.account_id}, product=${productKey}`,
                    );
                  },
                  finalize: () => {
                    console.info(
                      formatTime(Date.now()),
                      `StrategyEnd`,
                      `account=${config.account_id}, product=${productKey}`,
                    );

                    MetricRunStrategyResultCounter.clear({
                      result: 'complete',
                      account_id: config.account_id,
                      product: productKey,
                    });
                    MetricRunStrategyResultCounter.clear({
                      result: 'error',
                      account_id: config.account_id,
                      product: productKey,
                    });
                    MetricRunStrategyContextGauge.clear({
                      type: 'actual_net_volume',
                      account_id: config.account_id,
                      product: productKey,
                    });
                    MetricRunStrategyContextGauge.clear({
                      type: 'expected_net_volume',
                      account_id: config.account_id,
                      product: productKey,
                    });
                    MetricRunStrategyContextGauge.clear({
                      type: 'lower_bound',
                      account_id: config.account_id,
                      product: productKey,
                    });
                    MetricRunStrategyContextGauge.clear({
                      type: 'upper_bound',
                      account_id: config.account_id,
                      product: productKey,
                    });
                    MetricRunStrategyContextGauge.clear({
                      type: 'delta_volume',
                      account_id: config.account_id,
                      product: productKey,
                    });
                  },
                }),
              ),
            () => true,
          ),
        );
      },
      (a, b) => a.updated_at === b.updated_at,
    ),
  )
  .subscribe();
