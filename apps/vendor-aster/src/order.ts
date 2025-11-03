import { Terminal } from '@yuants/protocol';
import { IOrder } from '@yuants/data-order';
import { decodePath } from '@yuants/utils';
import { ACCOUNT_ID } from './account';
import { deleteFApiV1Order, postFApiV1Order } from './api';

const terminal = Terminal.fromNodeEnv();

terminal.server.provideService<IOrder>(
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

    const timeInForce =
      order.order_type === 'MAKER' ? 'GTX' : order.order_type === 'LIMIT' ? 'GTC' : undefined;

    await postFApiV1Order({
      symbol,
      side,
      type,
      quantity,
      price,
      timeInForce,
    });

    return { res: { code: 0, message: 'OK' } };
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
