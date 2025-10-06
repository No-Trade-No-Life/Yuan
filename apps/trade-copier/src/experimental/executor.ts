import { useAccountInfo } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { requestSQL } from '@yuants/sql';
import { encodePath, formatTime, listWatch } from '@yuants/utils';
import { defer, map, repeat, retry, tap, timeout } from 'rxjs';
import { ITradeCopierConfig } from '../interface';
import { getContext } from './context';
import './strategies'; // 引入所有策略以注册到 strategyRegistry
import { reconcileOrders } from './reconcile-orders';
import { strategyRegistry } from './strategy-registry';
import { StrategyAction } from './types';

const terminal = Terminal.fromNodeEnv();

const executeAction = async (action: StrategyAction): Promise<void> => {
  try {
    if (action.type === 'SubmitOrder') {
      await terminal.client.requestForResponse('SubmitOrder', action.payload);
    } else if (action.type === 'CancelOrder') {
      await terminal.client.requestForResponse('CancelOrder', action.payload);
    }
  } catch (error) {
    console.error(`执行动作失败: ${action.type}`, action.payload, error);
    throw error;
  }
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
              defer(async () => {
                const accountId = config.account_id;
                const strategyConfig = Object.assign(
                  {},
                  config.strategy.global,
                  config.strategy.product_overrides?.[productKey],
                );
                const strategyFn = strategyConfig.type
                  ? strategyRegistry.get(strategyConfig.type)
                  : undefined;
                if (!strategyFn) {
                  console.info(
                    formatTime(Date.now()),
                    `StrategyFunctionNotFound`,
                    `account=${accountId}, product=${productKey}, type=${strategyConfig.type}`,
                  );
                  throw 'StrategyFunctionNotFound';
                }
                // 1. 获取策略上下文
                const context = await getContext(accountId, productKey, strategyConfig);
                console.info(
                  formatTime(Date.now()),
                  'StrategyContext',
                  `account=${accountId}, product=${productKey}`,
                  JSON.stringify(context),
                );
                const currentOrders = structuredClone(context.pendingOrders); // 深拷贝当前挂单 (防止被错误修改)

                // 2. 调用策略获取目标订单列表
                const targetOrders = strategyFn(context);
                currentOrders.forEach((order) =>
                  console.info(
                    formatTime(Date.now()),
                    'CurrentOrder',
                    `account=${accountId}, product=${productKey}`,
                    JSON.stringify(order),
                  ),
                );
                targetOrders.forEach((order) =>
                  console.info(
                    formatTime(Date.now()),
                    'TargetOrder',
                    `account=${accountId}, product=${productKey}`,
                    JSON.stringify(order),
                  ),
                );

                // 3. 使用 reconcileOrders 协调当前挂单和目标订单，生成动作列表
                const actions = reconcileOrders(currentOrders, targetOrders);

                console.info(
                  formatTime(Date.now()),
                  'StrategyOrders',
                  `account=${accountId}, product=${productKey}, targetOrders=${targetOrders.length}, actions=${actions.length}`,
                );

                actions.forEach((action) =>
                  console.info(
                    formatTime(Date.now()),
                    'Action',
                    `account=${accountId}, product=${productKey}, type=${action.type}`,
                    JSON.stringify(action.payload),
                  ),
                );

                // 4. 并发执行所有动作
                if (process.env.MODE === 'ACT') {
                  await Promise.all(actions.map((action) => executeAction(action)));
                } else {
                  console.info('模拟模式，不执行任何动作');
                }
              }).pipe(
                timeout({
                  each: 60_000,
                  meta: { account_id: config.account_id, product: productKey, reason: 'runStrategyTimeout' },
                }),
                tap({
                  complete: () => {},
                  error: (err) => {
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
