import { Terminal } from '@yuants/protocol';
import { IOrder } from '@yuants/data-order';
import { decodePath } from '@yuants/utils';
import { ACCOUNT_ID } from './account';
import { postFApiV1Order } from './api';

const terminal = Terminal.fromNodeEnv();

terminal.server.provideService<IOrder>(
  'SubmitOrder',
  { required: ['account_id'], properties: { account_id: { type: 'string', const: ACCOUNT_ID } } },
  async (msg) => {
    const order = msg.req;

    const [, decodedSymbol] = decodePath(order.product_id ?? '');
    const symbol = decodedSymbol ?? order.product_id;

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
