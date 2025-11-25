import { IActionHandlerOfListOrders, IOrder } from '@yuants/data-order';
import { encodePath, formatTime } from '@yuants/utils';
import { isApiError } from '../../api/client';
import { getSpotOpenOrders, getUnifiedUmOpenOrders, ICredential } from '../../api/private-api';
import {
  mapBinanceOrderStatus,
  mapBinanceOrderTypeToYuants,
  mapBinanceSideToYuantsDirection,
  mapSpotSideToOrderDirection,
} from './order-utils';

export const listOrders: IActionHandlerOfListOrders<ICredential> = async (credential, account_id) => {
  if (account_id.includes('/unified/')) {
    const res = await getUnifiedUmOpenOrders(credential);
    if (isApiError(res)) {
      throw new Error(res.msg);
    }
    return res.map(
      (order): IOrder => ({
        order_id: `${order.orderId}`,
        account_id,
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
  }
  if (account_id.includes('/spot/')) {
    const res = await getSpotOpenOrders(credential);
    if (isApiError(res)) {
      throw new Error(res.msg);
    }
    return res.map(
      (order): IOrder => ({
        order_id: `${order.orderId}`,
        account_id,
        product_id: encodePath('BINANCE', 'SPOT', order.symbol),
        order_type: mapBinanceOrderTypeToYuants(order.type),
        order_direction: mapSpotSideToOrderDirection(order.side),
        volume: +order.origQty,
        traded_volume: +order.executedQty,
        price: order.price ? +order.price : undefined,
        submit_at: order.time,
        updated_at: formatTime(order.updateTime),
        order_status: mapBinanceOrderStatus(order.status),
      }),
    );
  }
  throw new Error(`Unsupported account_id for listOrders: ${account_id}`);
};
