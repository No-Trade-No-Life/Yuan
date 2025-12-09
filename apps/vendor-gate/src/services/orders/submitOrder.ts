import { IActionHandlerOfSubmitOrder } from '@yuants/data-order';
import { ICredential, postFutureOrders } from '../../api/private-api';
import { decodePath } from '@yuants/utils';

const resolveSizeSign = (order_direction?: string): number => {
  switch (order_direction) {
    case 'OPEN_LONG':
    case 'CLOSE_SHORT':
      return 1;
    case 'OPEN_SHORT':
    case 'CLOSE_LONG':
      return -1;
    default:
      throw new Error(`Unsupported order_direction: ${order_direction}`);
  }
};

const resolveTif = (order_type?: string): string => {
  if (order_type === 'MARKET') return 'ioc';
  if (order_type === 'LIMIT' || order_type === 'MAKER') return 'gtc';
  throw new Error(`Unsupported order_type: ${order_type}`);
};

export const submitOrder: IActionHandlerOfSubmitOrder<ICredential> = async (credential, order) => {
  if (!order.product_id) {
    throw new Error('Missing product_id');
  }
  if (!order.volume || order.volume <= 0) {
    throw new Error('Invalid order volume');
  }

  const size = order.volume * resolveSizeSign(order.order_direction);
  const tif = resolveTif(order.order_type);
  const reduce_only = order.order_direction === 'CLOSE_LONG' || order.order_direction === 'CLOSE_SHORT';
  const price =
    order.order_type === 'MARKET' ? '0' : order.price !== undefined ? `${order.price}` : undefined;
  if (price === undefined) {
    throw new Error('Limit/Maker order requires price');
  }
  const [, TYPE, contract] = decodePath(order.product_id);
  if (TYPE === 'FUTURE') {
    const res = await postFutureOrders(credential, 'usdt', {
      contract,
      size,
      price,
      tif,
      reduce_only,
    });

    if (res.label) {
      const detail = [res.label, res.message, res.detail].filter((v) => !!v).join(': ');
      throw new Error(detail);
    }
    return {
      order_id: `${res.id}`,
    };
  }
  throw new Error('Product type not support');
};
