import { makeSpotPosition } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { encodePath } from '@yuants/utils';
import { getAccountFundingAssets, getUnfilledOrders } from '../../api/private-api';
import { ICredential } from '../../api/types';

const mapSpotOrders = (data: any): any[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.orderList)) return data.orderList;
  if (Array.isArray(data.orders)) return data.orders;
  if (Array.isArray(data.resultList)) return data.resultList;
  return [];
};

const mapSpotOrderDirection = (side?: string) => (side === 'sell' ? 'OPEN_SHORT' : 'OPEN_LONG');

export const getSpotAccountInfo = async (credential: ICredential) => {
  const res = await getAccountFundingAssets(credential);
  if (res.msg !== 'success') {
    throw new Error(res.msg);
  }
  return res.data.map((v: any) => {
    return makeSpotPosition({
      position_id: v.coin,
      product_id: encodePath('BITGET', 'SPOT', `${v.coin}-USDT`),
      volume: +v.available,
      free_volume: +v.available,
      closable_price: 1, // TODO: use real price
    });
  });
};

export const listSpotPendingOrders = async (credential: ICredential): Promise<IOrder[]> => {
  const res = await getUnfilledOrders(credential, { category: 'SPOT' });
  if (res.msg !== 'success') {
    throw new Error(res.msg);
  }
  const list = mapSpotOrders(res.data);
  return list
    .map((order) => {
      const symbol = order.symbol;
      if (!symbol) return null;
      return {
        order_id: order.orderId ?? order.clientOid,
        account_id: '',
        product_id: encodePath('BITGET', 'SPOT', symbol),
        order_type: order.orderType === 'market' ? 'MARKET' : 'LIMIT',
        order_direction: mapSpotOrderDirection(order.side),
        volume: +(order.size ?? order.quantity ?? order.baseSz ?? order.baseAmount ?? 0),
        traded_volume: +(order.fillSz ?? order.filledQty ?? order.baseFilled ?? 0),
        price: order.price ? +order.price : undefined,
        submit_at: +(order.cTime ?? order.createTime ?? order.createdTime ?? Date.now()),
      };
    })
    .filter((order): order is NonNullable<typeof order> => Boolean(order));
};
