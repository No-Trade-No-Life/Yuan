import { IActionHandlerOfCancelOrder } from '@yuants/data-order';
import { decodePath } from '@yuants/utils';
import { deleteApiV1Order, deleteFApiV1Order, ICredential } from '../../api/private-api';

const parseProductId = (productId?: string) => {
  if (!productId) {
    return { category: undefined as string | undefined, symbol: undefined as string | undefined };
  }
  const parts = decodePath(productId);
  if (parts.length >= 2) {
    return { category: parts[0], symbol: parts.slice(1).join('/') };
  }
  return { category: undefined, symbol: parts[0] };
};

export const handleCancelOrder: IActionHandlerOfCancelOrder<ICredential> = async (credential, order) => {
  if (!order.order_id) {
    throw new Error('order_id is required for CancelOrder');
  }
  const [_, instType, symbol] = decodePath(order.product_id); // BITGET/USDT-FUTURES/BTCUSDT
  if (!symbol) {
    throw new Error('product_id is required to resolve symbol for CancelOrder');
  }
  if (instType === 'SPOT') {
    await deleteApiV1Order(credential, {
      symbol,
      orderId: order.order_id,
    });
    return;
  }
  if (instType === 'PERP') {
    await deleteFApiV1Order(credential, {
      symbol: decodePath(order.product_id).slice(2).join('/'),
      orderId: order.order_id,
    });
    return;
  }

  throw new Error(`Unsupported account_id/product for CancelOrder: ${order.account_id}`);
};
