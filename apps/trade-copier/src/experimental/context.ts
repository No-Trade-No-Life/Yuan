import { useAccountInfo } from '@yuants/data-account';
import { IOrder, queryPendingOrders } from '@yuants/data-order';
import { IProduct } from '@yuants/data-product';
import { IQuote } from '@yuants/data-quote';
import { Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { decodePath } from '@yuants/utils';
import { firstValueFrom, skip } from 'rxjs';
import { ITradeCopierStrategyBase } from '../interface';
import { StrategyContext } from './types';

const terminal = Terminal.fromNodeEnv();

/**
 * 获取策略上下文
 */
export const getContext = async (
  accountId: string,
  productKey: string,
  strategyConfig: ITradeCopierStrategyBase,
): Promise<StrategyContext> => {
  const [datasource_id, product_id] = decodePath(productKey);
  const expected_account_id = `TradeCopier/Expected/${accountId}`;

  const [[product], actualAccountInfo, expectedAccountInfo, pendingOrders, [quote]] = await Promise.all([
    // 获取产品信息
    requestSQL<IProduct[]>(
      terminal,
      `select * from product where product_id = ${escapeSQL(product_id)} and datasource_id = ${escapeSQL(
        datasource_id,
      )}`,
    ),
    // 获取实际账户信息（跳过第一个确保最新）
    firstValueFrom(useAccountInfo(terminal, accountId).pipe(skip(1))),
    // 获取预期账户信息
    firstValueFrom(useAccountInfo(terminal, expected_account_id)),
    // 获取挂单信息
    queryPendingOrders(terminal, accountId, true),
    // 获取行情数据
    requestSQL<IQuote[]>(
      terminal,
      `select * from quote where product_id = ${escapeSQL(product_id)} and datasource_id = ${escapeSQL(
        datasource_id,
      )}`,
    ),
  ]);

  return {
    accountId,
    productKey,
    actualAccountInfo,
    expectedAccountInfo,
    product: product,
    quote: quote,
    pendingOrders: pendingOrders.filter((o) => o.product_id === product_id),
    strategy: strategyConfig,
  };
};
