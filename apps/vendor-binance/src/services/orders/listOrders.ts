import { IActionHandlerOfListOrders, IOrder } from '@yuants/data-order';
import { encodePath } from '@yuants/utils';
import { isApiError } from '../../api/client';
import { getUnifiedUmOpenOrders, ICredential } from '../../api/private-api';
import { mapBinanceOrderTypeToYuants, mapBinanceSideToYuantsDirection } from './order-utils';

export const listOrders: IActionHandlerOfListOrders<ICredential> = async (credential, account_id) => {
  const res = await getUnifiedUmOpenOrders(credential);
  if (isApiError(res)) {
    throw new Error(res.msg);
  }
  return res.map(
    (order): IOrder => ({
      order_id: `${order.orderId}`,
      account_id,
      product_id: encodePath('usdt-future', order.symbol),
      order_type: mapBinanceOrderTypeToYuants(order.type),
      order_direction: mapBinanceSideToYuantsDirection(order.side, order.positionSide) ?? 'OPEN_LONG',
      volume: +order.origQty,
      traded_volume: +order.executedQty,
      price: order.price === undefined ? undefined : +order.price,
      submit_at: order.time,
      updated_at: new Date(order.updateTime).toISOString(),
      order_status: order.status,
    }),
  );
};
