import { encodePath } from '@yuants/utils';
import { getTradeOrdersPending, ICredential } from '../api/private-api';
import { getTradingAccountId } from '../accountInfos/uid';

export const listOrders = async (credential: ICredential) => {
  const account_id = await getTradingAccountId(credential);
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
};
