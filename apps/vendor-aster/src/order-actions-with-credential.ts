import { IOrder } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { formatTime, roundToStep } from '@yuants/utils';
import { getApiV1TickerPrice } from './api/public-api';
import { deleteFApiV1Order, postApiV1Order, postFApiV1Order } from './api/private-api';
import { IAsterCredential } from './api/types';
import {
  buildPerpetualOrderParams,
  buildSpotOrderParams,
  isPerpetualAccount,
  isSpotAccount,
  requiresSpotQuoteOrderQty,
  resolveSymbolFromProduct,
} from './order-utils';

const terminal = Terminal.fromNodeEnv();

const credentialSchema = {
  type: 'object',
  required: ['access_key', 'secret_key'],
  properties: {
    access_key: { type: 'string' },
    secret_key: { type: 'string' },
  },
};

type OrderWithCredential = IOrder & { credential: IAsterCredential };

terminal.server.provideService<OrderWithCredential, { order_id?: string }>(
  'SubmitOrder',
  {
    required: ['account_id', 'credential'],
    properties: {
      account_id: { type: 'string', pattern: '^aster/' },
      credential: credentialSchema,
    },
  },
  async (msg) => {
    console.info(formatTime(Date.now()), 'AsterSubmitWithCredential', JSON.stringify(msg.req));
    if (isPerpetualAccount(msg.req.account_id)) {
      const params = buildPerpetualOrderParams(msg.req);
      console.info(formatTime(Date.now()), 'AsterPerpSubmitParams', JSON.stringify(params));
      const res = await postFApiV1Order(msg.req.credential, params);
      const orderId =
        (res as any)?.orderId ?? (res as any)?.order_id ?? (res as any)?.data?.orderId ?? (res as any)?.data?.order_id;
      return { res: { code: 0, message: 'OK', data: orderId ? { order_id: `${orderId}` } : undefined } };
    }
    if (isSpotAccount(msg.req.account_id)) {
      const params = buildSpotOrderParams(msg.req);
      if (requiresSpotQuoteOrderQty(msg.req)) {
        const tickers = await getApiV1TickerPrice();
        const ticker = tickers.find((x) => x.symbol === params.symbol);
        if (!ticker) {
          throw new Error(`Cannot resolve ticker for ${params.symbol}`);
        }
        params.quantity = undefined;
        params.quoteOrderQty = roundToStep((msg.req.volume ?? 0) * +ticker.price, 0.01);
      }
      console.info(formatTime(Date.now()), 'AsterSpotSubmitParams', JSON.stringify(params));
      await postApiV1Order(msg.req.credential, params);
      return { res: { code: 0, message: 'OK' } };
    }
    throw new Error(`Unsupported account scope for ${msg.req.account_id}`);
  },
);

terminal.server.provideService<OrderWithCredential>(
  'CancelOrder',
  {
    required: ['account_id', 'credential', 'order_id'],
    properties: {
      account_id: { type: 'string', pattern: '^aster/' },
      credential: credentialSchema,
    },
  },
  async (msg) => {
    if (!isPerpetualAccount(msg.req.account_id)) {
      throw new Error('CancelOrder is only supported for perpetual accounts');
    }
    await deleteFApiV1Order(msg.req.credential, {
      symbol: resolveSymbolFromProduct(msg.req.product_id),
      orderId: msg.req.order_id,
    });
    return { res: { code: 0, message: 'OK' } };
  },
);
