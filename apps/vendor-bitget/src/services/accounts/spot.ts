import { IActionHandlerOfGetAccountInfo } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { encodePath } from '@yuants/utils';
import { getSpotAssets, getSpotOrdersPending, type ICredential } from '../../api/private-api';

const mapSpotOrders = (data: any): any[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.orderList)) return data.orderList;
  if (Array.isArray(data.orders)) return data.orders;
  if (Array.isArray(data.resultList)) return data.resultList;
  return [];
};

const mapSpotOrderDirection = (side?: string) => (side === 'sell' ? 'OPEN_SHORT' : 'OPEN_LONG');

export const getSpotAccountInfo: IActionHandlerOfGetAccountInfo<ICredential> = async (
  credential,
  _accountId,
) => {
  const res = await getSpotAssets(credential);
  if (res.msg !== 'success') {
    throw new Error(res.msg);
  }
  const equity = +(res.data.find((v: any) => v.coin === 'USDT')?.available ?? 0);
  return {
    money: {
      currency: 'USDT',
      equity,
      free: equity,
    },
    positions: [],
  };
};

export const listSpotPendingOrders = async (
  credential: ICredential,
  accountId: string,
): Promise<IOrder[]> => {
  const res = await getSpotOrdersPending(credential);
  if (res.msg !== 'success') {
    throw new Error(res.msg);
  }
  const list = mapSpotOrders(res.data);
  return list
    .map((order) => {
      const symbol = order.symbol ?? order.instId;
      if (!symbol) return null;
      return {
        order_id: order.orderId ?? order.clientOid,
        account_id: accountId,
        product_id: encodePath('SPOT', symbol),
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
