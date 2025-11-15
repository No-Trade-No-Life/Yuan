import { IOrder } from '@yuants/data-order';
import { encodePath } from '@yuants/utils';
import { getAccountIds, getTradingAccountId } from '../accountInfos/uid';
import { getTradeOrdersPending, ICredential } from '../api/private-api';

export const listOrders = async (credential: ICredential, account_id: string): Promise<IOrder[]> => {
  const accountIds = await getAccountIds(credential);
  if (accountIds?.trading === account_id) {
    const orderRes = await getTradeOrdersPending(credential, {});
    return orderRes.data.map((x) => {
      const order_type = x.ordType === 'market' ? 'MARKET' : x.ordType === 'limit' ? 'LIMIT' : 'UNKNOWN';

      const order_direction =
        x.side === 'buy'
          ? x.posSide === 'long'
            ? 'OPEN_LONG'
            : 'CLOSE_SHORT'
          : x.posSide === 'short'
          ? 'OPEN_SHORT'
          : 'CLOSE_LONG';
      return {
        order_id: x.ordId,
        account_id,
        product_id: encodePath(x.instType, x.instId),
        submit_at: +x.cTime,
        filled_at: +x.fillTime,
        order_type,
        order_direction,
        volume: +x.sz,
        traded_volume: +x.accFillSz,
        price: +x.px,
        traded_price: +x.avgPx,
      };
    });
  }
  throw new Error(`Account ID ${account_id} not found or not a trading account`);
};
