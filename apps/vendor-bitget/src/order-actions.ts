import { IOrder } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { JSONSchema7 } from 'json-schema';
import { decodePath, formatTime } from '@yuants/utils';
import { defer } from 'rxjs';
import { getFuturesAccountId } from './account';
import { getDefaultCredential, postFutureCancelOrder, postFuturePlaceOrder } from './api/private-api';
import { buildFutureOrderParams } from './order-utils';

const terminal = Terminal.fromNodeEnv();
const credential = getDefaultCredential();

defer(async () => {
  const accountId = await getFuturesAccountId();
  const submitSchema: JSONSchema7 = {
    required: ['account_id'],
    properties: {
      account_id: { const: accountId },
    },
  };

  terminal.server.provideService<IOrder, { order_id: string }>('SubmitOrder', submitSchema, (msg) =>
    defer(async () => {
      console.info(formatTime(Date.now()), 'SubmitOrder', msg);
      const params = buildFutureOrderParams(msg.req);
      console.info(formatTime(Date.now()), 'SubmitOrder', 'params', JSON.stringify(params));
      const res = await postFuturePlaceOrder(credential, params);
      if (res.msg !== 'success') {
        return { res: { code: +res.code, message: '' + res.msg } };
      }
      return { res: { code: 0, message: 'OK', data: { order_id: res.data.orderId } } };
    }),
  );

  terminal.server.provideService<IOrder>(
    'CancelOrder',
    {
      required: ['account_id'],
      properties: {
        account_id: { const: accountId },
      },
    },
    (msg) =>
      defer(async () => {
        console.info(formatTime(Date.now()), 'CancelOrder', msg);
        const [instType, instId] = decodePath(msg.req.product_id);
        const res = await postFutureCancelOrder(credential, {
          symbol: instId,
          productType: instType,
          orderId: msg.req.order_id,
        });
        if (res.msg !== 'success') {
          return { res: { code: +res.code, message: '' + res.msg } };
        }
        return { res: { code: 0, message: 'OK' } };
      }),
  );
}).subscribe();
