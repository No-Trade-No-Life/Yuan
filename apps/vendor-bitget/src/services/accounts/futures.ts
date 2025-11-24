import { IActionHandlerOfGetAccountInfo, IPosition } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { encodePath } from '@yuants/utils';
import {
  getAllPositions,
  getFutureAccounts,
  getFutureOrdersPending,
  type ICredential,
} from '../../api/private-api';

const mapPosition = (position: any): IPosition => ({
  position_id: `${position.symbol}-${position.holdSide}`,
  datasource_id: 'BITGET',
  product_id: encodePath('USDT-FUTURES', position.symbol),
  direction: position.holdSide === 'long' ? 'LONG' : 'SHORT',
  volume: +position.total,
  free_volume: +position.available,
  position_price: +position.openPriceAvg,
  closable_price: +position.markPrice,
  floating_profit: +position.unrealizedPL,
  valuation: +position.total * +position.markPrice,
});

const mapOrderDirection = (order: any) => {
  const side = order.side;
  const tradeSide = order.tradeSide ?? order.posSide;
  if (tradeSide === 'open') {
    return side === 'buy' ? 'OPEN_LONG' : 'OPEN_SHORT';
  }
  if (tradeSide === 'close') {
    return side === 'buy' ? 'CLOSE_SHORT' : 'CLOSE_LONG';
  }
  if (tradeSide === 'long') {
    return side === 'buy' ? 'OPEN_LONG' : 'CLOSE_LONG';
  }
  if (tradeSide === 'short') {
    return side === 'buy' ? 'CLOSE_SHORT' : 'OPEN_SHORT';
  }
  return side === 'buy' ? 'OPEN_LONG' : 'OPEN_SHORT';
};

export const getFuturesAccountInfo: IActionHandlerOfGetAccountInfo<ICredential> = async (
  credential,
  _accountId,
) => {
  const [balanceRes, positionsRes] = await Promise.all([
    getFutureAccounts(credential, { productType: 'USDT-FUTURES' }),
    getAllPositions(credential, { productType: 'USDT-FUTURES', marginCoin: 'USDT' }),
  ]);
  if (balanceRes.msg !== 'success') {
    throw new Error(balanceRes.msg);
  }
  if (positionsRes.msg !== 'success') {
    throw new Error(positionsRes.msg);
  }
  return positionsRes.data.map(mapPosition);
};

export const listFuturePendingOrders = async (
  credential: ICredential,
  accountId: string,
): Promise<IOrder[]> => {
  const res = await getFutureOrdersPending(credential, { productType: 'USDT-FUTURES', marginCoin: 'USDT' });
  if (res.msg !== 'success') {
    throw new Error(res.msg);
  }
  const list = res.data?.orderList ?? [];
  return list.map((order: any) => ({
    order_id: order.orderId,
    account_id: accountId,
    product_id: encodePath(order.productType ?? 'USDT-FUTURES', order.symbol),
    submit_at: +(order.cTime ?? order.createdTime ?? order.uTime ?? Date.now()),
    order_type: order.orderType === 'limit' ? 'LIMIT' : order.orderType === 'market' ? 'MARKET' : 'UNKNOWN',
    order_direction: mapOrderDirection(order),
    volume: +order.size,
    traded_volume: +(order.filledQty ?? 0),
    price: order.price ? +order.price : undefined,
    traded_price: order.priceAvg ? +order.priceAvg : undefined,
  }));
};
