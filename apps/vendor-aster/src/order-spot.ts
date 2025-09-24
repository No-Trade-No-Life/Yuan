import { IOrder } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { roundToStep } from '@yuants/utils';
import { SPOT_ACCOUNT_ID } from './account-spot';
import { getApiV1TickerPrice, postApiV1Order } from './sapi';

Terminal.fromNodeEnv().server.provideService<IOrder>(
  'SubmitOrder',
  { required: ['account_id'], properties: { account_id: { type: 'string', const: SPOT_ACCOUNT_ID } } },
  async (msg) => {
    const order = msg.req;
    const symbol = order.product_id;

    const type = ({ MARKET: 'MARKET', LIMIT: 'LIMIT', MAKER: 'LIMIT' } as const)[order.order_type!];
    if (!type) throw new Error(`Unsupported order_type: ${order.order_type}`);

    const side = ({ OPEN_LONG: 'BUY', OPEN_SHORT: 'SELL', CLOSE_LONG: 'SELL', CLOSE_SHORT: 'BUY' } as const)[
      order.order_direction!
    ];
    if (!side) throw new Error(`Unsupported order_direction: ${order.order_direction}`);

    const timeInForce =
      order.order_type === 'MAKER' ? 'GTX' : order.order_type === 'LIMIT' ? 'GTC' : undefined;

    const price = order.price;

    let quantity: number | undefined = order.volume;
    let quoteOrderQty: number | undefined;

    if (type === 'MARKET' && side === 'BUY') {
      const spotPrice = await getApiV1TickerPrice({});
      const thePrice = spotPrice.find((x) => x.symbol === symbol)?.price;
      if (!thePrice) throw new Error(`Cannot get price for symbol ${symbol}`);
      quantity = undefined;
      quoteOrderQty = roundToStep(order.volume * +thePrice, 0.01);
    }

    await postApiV1Order({
      symbol,
      type,
      side,
      timeInForce,
      price,
      quantity,
      quoteOrderQty,
    });

    return { res: { code: 0, message: 'OK' } };
  },
);
