import { Terminal } from '@yuants/protocol';
import { IOrder } from '@yuants/data-order';
import { decodePath } from '@yuants/utils';
import { ACCOUNT_ID } from './account';
import { deleteFApiV1Order, postFApiV1Order } from './api';

const terminal = Terminal.fromNodeEnv();

terminal.server.provideService<IOrder, { order_id?: string }>(
  'SubmitOrder',
  { required: ['account_id'], properties: { account_id: { type: 'string', const: ACCOUNT_ID } } },
  async (msg) => {
    const order = msg.req;

    const [, decodedSymbol] = decodePath(order.product_id);
    if (!decodedSymbol) {
      throw new Error(`Invalid product_id: unable to decode symbol from "${order.product_id}"`);
    }
    const symbol = decodedSymbol;

    const side = ({ OPEN_LONG: 'BUY', OPEN_SHORT: 'SELL', CLOSE_LONG: 'SELL', CLOSE_SHORT: 'BUY' } as const)[
      order.order_direction!
    ];
    if (!side) throw new Error(`Unsupported order_direction: ${order.order_direction}`);

    const type = ({ MARKET: 'MARKET', LIMIT: 'LIMIT', MAKER: 'LIMIT' } as const)[order.order_type!];
    if (!type) throw new Error(`Unsupported order_type: ${order.order_type}`);

    const quantity = order.volume;
    const price = order.price;

    const positionSide =
      order.order_direction === 'OPEN_LONG' || order.order_direction === 'CLOSE_LONG'
        ? 'LONG'
        : order.order_direction === 'OPEN_SHORT' || order.order_direction === 'CLOSE_SHORT'
        ? 'SHORT'
        : undefined;

    const reduceOnly =
      order.order_direction === 'CLOSE_LONG' || order.order_direction === 'CLOSE_SHORT' ? 'true' : undefined;

    const timeInForce =
      order.order_type === 'MAKER' ? 'GTX' : order.order_type === 'LIMIT' ? 'GTC' : undefined;

    const res = await postFApiV1Order({
      symbol,
      side,
      type,
      quantity,
      price,
      timeInForce,
      positionSide,
      reduceOnly,
    });

    const orderId =
      (res as any)?.orderId ??
      (res as any)?.order_id ??
      (res as any)?.data?.orderId ??
      (res as any)?.data?.order_id;

    return {
      res: {
        code: 0,
        message: 'OK',
        data: orderId ? { order_id: `${orderId}` } : undefined,
      },
    };
  },
);

terminal.server.provideService<IOrder>(
  'CancelOrder',
  {
    required: ['account_id', 'order_id', 'product_id'],
    properties: {
      account_id: { type: 'string', const: ACCOUNT_ID },
      order_id: { type: ['string', 'number'] },
      product_id: { type: 'string' },
    },
  },
  async (msg) => {
    const order = msg.req;
    const [, decodedSymbol] = decodePath(order.product_id);
    if (!decodedSymbol) {
      throw new Error(`Invalid product_id: unable to decode symbol from "${order.product_id}"`);
    }
    if (!order.order_id) {
      throw new Error('order_id is required for CancelOrder');
    }

    await deleteFApiV1Order({
      symbol: decodedSymbol,
      orderId: order.order_id,
    });

    return { res: { code: 0, message: 'OK' } };
  },
);
