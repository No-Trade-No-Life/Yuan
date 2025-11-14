import { IOrder } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { formatTime, roundToStep } from '@yuants/utils';
import { defer } from 'rxjs';
import { getDefaultCredential } from './api/client';
import { deleteFApiV1Order, postApiV1Order, postFApiV1Order } from './api/private-api';
import { getApiV1TickerPrice } from './api/public-api';
import { getPerpetualAccountId, getSpotAccountId } from './account-profile';
import {
  buildPerpetualOrderParams,
  buildSpotOrderParams,
  requiresSpotQuoteOrderQty,
  resolveSymbolFromProduct,
} from './order-utils';

const terminal = Terminal.fromNodeEnv();
const credential = getDefaultCredential();

const registerPerpetualOrders = () =>
  defer(async () => {
    const accountId = await getPerpetualAccountId();

    terminal.server.provideService<IOrder, { order_id?: string }>(
      'SubmitOrder',
      { required: ['account_id'], properties: { account_id: { type: 'string', const: accountId } } },
      async (msg) => {
        console.info(formatTime(Date.now()), 'AsterPerpSubmit', JSON.stringify(msg.req));
        const params = buildPerpetualOrderParams(msg.req);
        console.info(formatTime(Date.now()), 'AsterPerpSubmitParams', JSON.stringify(params));
        const res = await postFApiV1Order(credential, params);
        const orderId =
          (res as any)?.orderId ??
          (res as any)?.order_id ??
          (res as any)?.data?.orderId ??
          (res as any)?.data?.order_id;
        return {
          res: { code: 0, message: 'OK', data: orderId ? { order_id: `${orderId}` } : undefined },
        };
      },
    );

    terminal.server.provideService<IOrder>(
      'CancelOrder',
      {
        required: ['account_id', 'order_id', 'product_id'],
        properties: {
          account_id: { type: 'string', const: accountId },
          order_id: { type: ['string', 'number'] },
          product_id: { type: 'string' },
        },
      },
      async (msg) => {
        console.info(formatTime(Date.now()), 'AsterPerpCancel', JSON.stringify(msg.req));
        await deleteFApiV1Order(credential, {
          symbol: resolveSymbolFromProduct(msg.req.product_id),
          orderId: msg.req.order_id,
        });
        return { res: { code: 0, message: 'OK' } };
      },
    );
  }).subscribe();

const registerSpotOrders = () =>
  defer(async () => {
    const accountId = await getSpotAccountId();

    terminal.server.provideService<IOrder>(
      'SubmitOrder',
      { required: ['account_id'], properties: { account_id: { type: 'string', const: accountId } } },
      async (msg) => {
        console.info(formatTime(Date.now()), 'AsterSpotSubmit', JSON.stringify(msg.req));
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
        await postApiV1Order(credential, params);
        return { res: { code: 0, message: 'OK' } };
      },
    );
  }).subscribe();

registerPerpetualOrders();
registerSpotOrders();
