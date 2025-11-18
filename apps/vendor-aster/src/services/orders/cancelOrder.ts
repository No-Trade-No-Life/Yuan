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

  const { category, symbol } = parseProductId(order.product_id);
  if (!symbol) {
    throw new Error('product_id is required to resolve symbol for CancelOrder');
  }

  const accountId = order.account_id?.toUpperCase() ?? order.account_id;
  const productType = category?.toUpperCase();

  if (accountId?.includes('/SPOT') || productType === 'SPOT') {
    await deleteApiV1Order(credential, {
      symbol,
      orderId: order.order_id,
    });
    return;
  }

  if (accountId?.includes('/PERP') || productType === 'PERPETUAL') {
    await deleteFApiV1Order(credential, {
      symbol,
      orderId: order.order_id,
    });
    return;
  }

  throw new Error(`Unsupported account_id/product for CancelOrder: ${order.account_id}`);
};
