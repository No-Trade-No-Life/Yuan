import { useAccountInfo } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { IProduct } from '@yuants/data-product';
import { Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { decodePath, encodePath, listWatch, roundToStep } from '@yuants/utils';
import { defer, firstValueFrom, map, repeat, retry, tap, timeout } from 'rxjs';
import { ITradeCopierConfig } from './interface';
import './migration';

const terminal = Terminal.fromNodeEnv();

const runContext = async (config: ITradeCopierConfig, productKey: string) => {
  const expected_account_id = `TradeCopier/Expected/${config.account_id}`;
  const [datasource_id, product_id] = decodePath(productKey);
  const strategy = Object.assign({}, config.strategy.global, config.strategy.product_overrides?.[productKey]);
  // 一次性将所需的数据拉取完毕 (考虑性能优化可以使用 cache 机制)
  // 不同的下单策略所需的策略不同，这里先简单实现市价追入所需的数据
  const [[theProduct], actualAccountInfo, expectedAccountInfo] = await Promise.all([
    requestSQL<IProduct[]>(
      terminal,
      `select * from product where product_id = ${escapeSQL(product_id)} and datasource_id = ${escapeSQL(
        datasource_id,
      )}`,
    ),
    firstValueFrom(useAccountInfo(terminal, config.account_id)),
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
  const diff = expectedNetVolume - actualNetVolume; // TODO: 对 diff 进行打点

  // 实际值在容忍区间之间，不需要下单 (但是某些策略可能需要撤单)
  if (lowerBound <= actualNetVolume && actualNetVolume <= upperBound) {
    return;
  }

  let order_direction: string;
  let volume: number;

  if (diff > 0) {
    if (actualShortVolume > 0) {
      // 先平空
      order_direction = 'CLOSE_SHORT';
      volume = Math.min(diff, actualShortVolume);
    } else {
      order_direction = 'OPEN_LONG';
      volume = diff;
    }
  } else {
    if (actualLongVolume > 0) {
      // 先平多
      order_direction = 'CLOSE_LONG';
      volume = Math.min(-diff, actualLongVolume);
    } else {
      order_direction = 'OPEN_SHORT';
      volume = -diff;
    }
  }

  const order: IOrder = {
    order_type: 'MARKET',
    account_id: config.account_id,
    product_id: product_id,
    order_direction: order_direction,
    volume: roundToStep(Math.min(volume, strategy.max_volume ?? Infinity), theProduct.volume_step),
  };
  await terminal.client.requestForResponse('SubmitOrder', order);
};

defer(() =>
  requestSQL<ITradeCopierConfig[]>(terminal, `select * from trade_copier_config where enabled = true`),
)
  .pipe(
    tap((configs) => console.log('Loaded Trade Copier Configs:', configs.length, JSON.stringify(configs))),
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
              defer(() => runContext(config, productKey)).pipe(
                timeout(60_000),
                tap({
                  error: (err) => {
                    console.info(
                      `Error in context for account ${config.account_id}, product ${productKey}:`,
                      err,
                    );
                  },
                }),
                retry({ delay: 1000 }),
                repeat({ delay: 1000 }),
                tap({
                  subscribe: () => {
                    console.log(`Setting up context for account ${config.account_id}, product ${productKey}`);
                  },
                  finalize: () => {
                    console.log(
                      `Tearing down context for account ${config.account_id}, product ${productKey}`,
                    );
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
  .pipe(retry({ delay: 1000 }), repeat({ delay: 1000 }))
  .subscribe();
