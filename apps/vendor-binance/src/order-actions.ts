import { IOrder } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { decodePath, formatTime } from '@yuants/utils';
import { defer } from 'rxjs';
import { getUnifiedAccountId } from './account';
import { getDefaultCredential } from './api/client';
import { deleteUmOrder, postUmOrder } from './api/private-api';
import { isBinanceErrorResponse } from './api/types';
import { deriveClientOrderId, mapOrderDirectionToPosSide, mapOrderDirectionToSide, mapOrderTypeToOrdType } from './order-utils';

const terminal = Terminal.fromNodeEnv();
const credential = getDefaultCredential();

defer(async () => {
  const accountId = await getUnifiedAccountId();

  terminal.server.provideService<IOrder, { order_id: string }>(
    'SubmitOrder',
    {
      required: ['account_id'],
      properties: {
        account_id: { const: accountId },
      },
    },
    (msg) =>
      defer(async () => {
        console.info(formatTime(Date.now()), 'SubmitOrder', msg.req);
        const [instType, symbol] = decodePath(msg.req.product_id);
        if (instType !== 'usdt-future') {
          return { res: { code: 400, message: `unsupported type: ${instType}` } };
        }
        const params = {
          symbol,
          side: mapOrderDirectionToSide(msg.req.order_direction),
          positionSide: mapOrderDirectionToPosSide(msg.req.order_direction),
          type: mapOrderTypeToOrdType(msg.req.order_type),
          timeInForce:
            msg.req.order_type === 'MAKER' ? 'GTX' : msg.req.order_type === 'LIMIT' ? 'GTC' : undefined,
          quantity: msg.req.volume,
          price: msg.req.price,
          newClientOrderId: deriveClientOrderId(msg.req),
        };
        console.info(formatTime(Date.now()), 'SubmitOrder', 'params', JSON.stringify(params));
        const res = await postUmOrder(credential, params);
        if (isBinanceErrorResponse(res)) {
          return { res: { code: res.code, message: res.msg } };
        }
        return { res: { code: 0, message: 'OK', data: { order_id: res.orderId } } };
      }),
  );

  terminal.server.provideService<IOrder>(
    'CancelOrder',
    {
      required: ['account_id', 'order_id', 'product_id'],
      properties: {
        account_id: { const: accountId },
      },
    },
    (msg) =>
      defer(async () => {
        const [instType, symbol] = decodePath(msg.req.product_id);
        if (instType !== 'usdt-future') {
          return { res: { code: 400, message: `unsupported type: ${instType}` } };
        }
        const res = await deleteUmOrder(credential, { symbol, orderId: msg.req.order_id });
        if (isBinanceErrorResponse(res)) {
          return { res: { code: res.code, message: res.msg } };
        }
        return { res: { code: 0, message: 'OK' } };
      }),
  );
}).subscribe();
