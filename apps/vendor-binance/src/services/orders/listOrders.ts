import { IActionHandlerOfListOrders, IOrder } from '@yuants/data-order';
import { decodePath, encodePath, formatTime } from '@yuants/utils';
import { isApiError } from '../../api/client';
import { getSpotOpenOrders, getUnifiedUmOpenOrders, ICredential } from '../../api/private-api';
import {
  mapBinanceOrderStatus,
  mapBinanceOrderTypeToYuants,
  mapBinanceSideToYuantsDirection,
  mapSpotSideToOrderDirection,
} from './order-utils';

export const listUnifiedUmOrders = async (credential: ICredential): Promise<IOrder[]> => {
  const res = await getUnifiedUmOpenOrders(credential);
  if (isApiError(res)) {
    throw new Error(res.msg);
  }
  return res.map(
    (order): IOrder => ({
      order_id: `${order.orderId}`,
      account_id: '',
      product_id: encodePath('BINANCE', 'USDT-FUTURE', order.symbol),
      order_type: mapBinanceOrderTypeToYuants(order.type),
      order_direction:
        mapBinanceSideToYuantsDirection(order.side, order.positionSide) ??
        (order.side === 'BUY' ? 'OPEN_LONG' : 'OPEN_SHORT'),
      volume: +order.origQty,
      traded_volume: +order.executedQty,
      price: order.price === undefined ? undefined : +order.price,
      submit_at: order.time,
      updated_at: formatTime(order.updateTime),
      order_status: mapBinanceOrderStatus(order.status),
    }),
  );
};

export const listSpotOrders = async (credential: ICredential): Promise<IOrder[]> => {
  const res = await getSpotOpenOrders(credential);
  if (isApiError(res)) {
    throw new Error(res.msg);
  }
  return res.map(
    (order): IOrder => ({
      order_id: `${order.orderId}`,
      account_id: '',
      product_id: encodePath('BINANCE', 'SPOT', order.symbol),
      order_type: mapBinanceOrderTypeToYuants(order.type),
      order_direction: mapSpotSideToOrderDirection(order.side),
      volume: +order.origQty,
      traded_volume: +order.executedQty,
      price: order.price === undefined ? undefined : +order.price,
      submit_at: order.time,
      updated_at: formatTime(order.updateTime),
      order_status: mapBinanceOrderStatus(order.status),
    }),
  );
};

export const getOrdersByProductId = async function (
  credential: ICredential,
  product_id: string,
): Promise<IOrder[]> {
  const [_, instType] = decodePath(product_id); // BINANCE/USDT-FUTURE/ADAUSDT
  if (instType === 'SPOT') {
    const orders = await listSpotOrders(credential);
    return orders.filter((order) => order.product_id === product_id);
  }
  if (instType === 'USDT-FUTURE') {
    const orders = await listUnifiedUmOrders(credential);
    return orders.filter((order) => order.product_id === product_id);
  }
  throw new Error(`Unsupported instType: ${instType}`);
};
