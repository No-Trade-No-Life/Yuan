import { useAccountInfo } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { requestSQL } from '@yuants/sql';
import { encodePath, formatTime, listWatch } from '@yuants/utils';
import { defer, map, mergeWith, repeat, retry, tap, timeout } from 'rxjs';
import { runStrategyBboMaker } from './BBO_MAKER';
import { runStrategyBboMakerByDirection } from './BBO_MAKER_BY_DIRECTION';
import { runStrategyDefault } from './DEFAULT';
import { ITradeCopierConfig, ITradeCopierStrategyBase } from './interface';
import { MetricRunStrategyContextGauge, MetricRunStrategyResultCounter } from './metrics';

const terminal = Terminal.fromNodeEnv();

const runStrategy = async (account_id: string, productKey: string, strategy: ITradeCopierStrategyBase) => {
  console.info(
    formatTime(Date.now()),
    `RunStrategy`,
    `account=${account_id}, product=${productKey}`,
    JSON.stringify(strategy),
  );
  if (strategy.type === 'BBO_MAKER_BY_DIRECTION') {
    return runStrategyBboMakerByDirection(account_id, productKey, strategy);
  }
  if (strategy.type === 'BBO_MAKER') {
    return runStrategyBboMaker(account_id, productKey, strategy);
  }
  if (strategy.type === 'DEFAULT') {
    return runStrategyDefault(account_id, productKey, strategy);
  }
  throw `UnknownStrategyType: ${strategy.type}`;
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
                mergeWith(defer(() => terminal.channel.subscribeChannel('quote', productKey))),
                timeout({
                  each: 60_000,
                  meta: { account_id: config.account_id, product: productKey, reason: 'runStrategyTimeout' },
                }),
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
                    for (const type of [
                      'actual_volume',
                      'expected_volume',
                      'actual_net_volume',
                      'expected_net_volume',
                      'lower_bound',
                      'upper_bound',
                      'delta_volume',
                    ]) {
                      MetricRunStrategyContextGauge.clear({
                        type,
                        account_id: config.account_id,
                        product: productKey,
                      });
                    }
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
