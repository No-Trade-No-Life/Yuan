import { IPosition, makeSpotPosition } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { encodePath } from '@yuants/utils';
import { getAccountAssets, getCurrentPosition, getUnfilledOrders } from '../../api/private-api';
import { ICredential } from '../../api/types';

const mapPosition = (position: any): IPosition => ({
  position_id: `${position.symbol}-${position.posSide}`,
  datasource_id: 'BITGET',
  product_id: encodePath('BITGET', 'USDT-FUTURES', position.symbol),
  direction: position.posSide === 'long' ? 'LONG' : 'SHORT',
  volume: +position.total,
  free_volume: +position.available,
  position_price: +position.avgPrice,
  closable_price: +position.markPrice,
  floating_profit: +(position.unrealisedPnl ?? position.unrealizedPL ?? 0),
  valuation: +position.total * +(position.markPrice ?? 0),
});

const mapOrderDirection = (order: any) => {
  const side = order.side;
  const posSide = order.posSide;
  if (posSide === 'long') {
    return side === 'buy' ? 'OPEN_LONG' : 'CLOSE_LONG';
  }
  if (posSide === 'short') {
    return side === 'buy' ? 'CLOSE_SHORT' : 'OPEN_SHORT';
  }
  return side === 'buy' ? 'OPEN_LONG' : 'OPEN_SHORT';
};

export const getFuturesAccountInfo = async (credential: ICredential) => {
  const [positionsRes, assetsRes] = await Promise.all([
    getCurrentPosition(credential, { category: 'USDT-FUTURES' }),
    getAccountAssets(credential),
  ]);
  if (positionsRes.msg !== 'success') {
    throw new Error(positionsRes.msg);
  }
  if (assetsRes.msg !== 'success') {
    throw new Error(assetsRes.msg);
  }
  const positions = (positionsRes.data?.list ?? []).map(mapPosition);
  const balancePositions =
    assetsRes.data?.assets?.map(
      (asset: any): IPosition =>
        makeSpotPosition({
          position_id: asset.coin,
          product_id: encodePath('BITGET', 'SPOT', asset.coin),
          volume: +asset.available,
          free_volume: +asset.available,
          closable_price: 1,
        }),
    ) ?? [];
  return [...positions, ...balancePositions];
};

export const listFuturePendingOrders = async (credential: ICredential): Promise<IOrder[]> => {
  const res = await getUnfilledOrders(credential, { category: 'USDT-FUTURES' });
  if (res.msg !== 'success') {
    throw new Error(res.msg);
  }
  const list = res.data?.list ?? [];
  return list.map((order: any) => ({
    order_id: order.orderId,
    account_id: '',
    product_id: encodePath('BITGET', order.category ?? 'USDT-FUTURES', order.symbol),
    submit_at: +(order.createdTime ?? order.updatedTime ?? Date.now()),
    order_type: order.orderType === 'limit' ? 'LIMIT' : order.orderType === 'market' ? 'MARKET' : 'UNKNOWN',
    order_direction: mapOrderDirection(order),
    volume: +order.qty,
    traded_volume: +(order.cumExecQty ?? 0),
    price: order.price ? +order.price : undefined,
    traded_price: order.priceAvg ? +order.priceAvg : undefined,
  }));
};
