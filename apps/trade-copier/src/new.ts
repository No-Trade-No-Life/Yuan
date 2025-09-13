import { useAccountInfo } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { requestSQL } from '@yuants/sql';
import { listWatch } from '@yuants/utils';
import { defer, firstValueFrom, map, repeat, retry, tap, timeout } from 'rxjs';
import { ITradeCopierConfig } from './interface';
import './migration';

const terminal = Terminal.fromNodeEnv();

const runContext = async (config: ITradeCopierConfig, product_id: string) => {
  const expected_account_id = `TradeCopier/Expected/${config.account_id}`;
  const strategy = Object.assign(
    {},
    config.strategy.global,
    config.strategy.product_id_overrides?.[product_id],
  );
  const [actualAccountInfo, expectedAccountInfo] = await Promise.all([
    //
    firstValueFrom(useAccountInfo(terminal, config.account_id)),
    firstValueFrom(useAccountInfo(terminal, expected_account_id)),
  ]);

  // 默认市价追入
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
  const diff = expectedNetVolume - actualNetVolume;

  if (diff === 0) {
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

  volume = Math.min(volume, strategy.max_volume ?? Infinity);

  const order: IOrder = {
    order_type: 'MARKET',
    account_id: config.account_id,
    product_id: product_id,
    order_direction: order_direction,
    volume: volume,
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
          map((x) => [...new Set(x.positions.map((p) => p.product_id))]),
          listWatch(
            (x) => x,
            (product_id) =>
              // runContext 是简短执行一步的函数，负责拉取所需的数据并且下单/撤单一次
              defer(() => runContext(config, product_id)).pipe(
                timeout(60_000),
                tap({
                  error: (err) => {
                    console.info(
                      `Error in context for account ${config.account_id}, product ${product_id}:`,
                      err,
                    );
                  },
                }),
                retry({ delay: 1000 }),
                repeat({ delay: 1000 }),
                tap({
                  subscribe: () => {
                    console.log(`Setting up context for account ${config.account_id}, product ${product_id}`);
                  },
                  finalize: () => {
                    console.log(
                      `Tearing down context for account ${config.account_id}, product ${product_id}`,
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
