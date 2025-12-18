import { useAccountInfo } from '@yuants/data-account';
import { queryPendingOrders } from '@yuants/data-order';
import { IProduct } from '@yuants/data-product';
import { IQuote, queryQuotes } from '@yuants/data-quote';
import { Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { decodePath, formatTime } from '@yuants/utils';
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

  const updated_at = Date.now();

  const [[product], actualAccountInfo, expectedAccountInfo, pendingOrders, quoteRecord] = await Promise.all([
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
    queryQuotes(terminal, [product_id], ['bid_price', 'ask_price', 'last_price'], updated_at),
  ]);

  const quote = quoteRecord[product_id];

  return {
    accountId,
    productKey,
    actualAccountInfo,
    expectedAccountInfo,
    product: product,
    quote: {
      datasource_id,
      product_id,
      updated_at: formatTime(updated_at),
      last_price: quote.last_price ?? '',
      ask_price: quote.ask_price ?? '',
      ask_volume: '',
      bid_price: quote.bid_price ?? '',
      bid_volume: '',
      open_interest: '',
      interest_rate_long: '',
      interest_rate_short: '',
      interest_rate_prev_settled_at: '',
      interest_rate_next_settled_at: '',
    } as IQuote,
    pendingOrders: pendingOrders.filter((o) => o.product_id === product_id),
    strategy: strategyConfig,
  };
};
