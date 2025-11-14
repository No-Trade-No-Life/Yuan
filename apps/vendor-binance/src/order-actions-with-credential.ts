import { IOrder } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { decodePath } from '@yuants/utils';
import { deleteUmOrder, postUmOrder } from './api/private-api';
import { IBinanceCredential, isBinanceErrorResponse } from './api/types';
import { deriveClientOrderId, mapOrderDirectionToPosSide, mapOrderDirectionToSide, mapOrderTypeToOrdType } from './order-utils';

const terminal = Terminal.fromNodeEnv();

const buildOrderParams = (order: IOrder) => {
  const [instType, symbol] = decodePath(order.product_id);
  if (instType !== 'usdt-future') {
    throw new Error(`unsupported type: ${instType}`);
  }
  return {
    symbol,
    side: mapOrderDirectionToSide(order.order_direction),
    positionSide: mapOrderDirectionToPosSide(order.order_direction),
    type: mapOrderTypeToOrdType(order.order_type),
    timeInForce: order.order_type === 'MAKER' ? 'GTX' : order.order_type === 'LIMIT' ? 'GTC' : undefined,
    quantity: order.volume,
    price: order.price,
    newClientOrderId: deriveClientOrderId(order),
  };
};

terminal.server.provideService<IOrder & { credential: IBinanceCredential }, { order_id?: string }>(
  'SubmitOrder',
  {
    required: ['account_id', 'credential'],
    properties: {
      account_id: {
        type: 'string',
        pattern: '^binance/',
      },
      credential: {
        type: 'object',
        required: ['access_key', 'secret_key'],
        properties: {
          access_key: { type: 'string' },
          secret_key: { type: 'string' },
        },
      },
    },
  },
  async (msg) => {
    const params = buildOrderParams(msg.req);
    const res = await postUmOrder(msg.req.credential, params);
    if (isBinanceErrorResponse(res)) {
      return { res: { code: res.code, message: res.msg } };
    }
    return { res: { code: 0, message: 'OK', data: { order_id: res.orderId } } };
  },
);

terminal.server.provideService<IOrder & { credential: IBinanceCredential }>(
  'CancelOrder',
  {
    required: ['account_id', 'credential', 'order_id', 'product_id'],
    properties: {
      account_id: {
        type: 'string',
        pattern: '^binance/',
      },
      credential: {
        type: 'object',
        required: ['access_key', 'secret_key'],
        properties: {
          access_key: { type: 'string' },
          secret_key: { type: 'string' },
        },
      },
    },
  },
  async (msg) => {
    const [instType, symbol] = decodePath(msg.req.product_id);
    if (instType !== 'usdt-future') {
      return { res: { code: 400, message: `unsupported type: ${instType}` } };
    }
    const res = await deleteUmOrder(msg.req.credential, { symbol, orderId: msg.req.order_id });
    if (isBinanceErrorResponse(res)) {
      return { res: { code: res.code, message: res.msg } };
    }
    return { res: { code: 0, message: 'OK' } };
  },
);
