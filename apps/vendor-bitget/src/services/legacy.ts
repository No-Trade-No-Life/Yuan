import { addAccountMarket, provideAccountInfoService } from '@yuants/data-account';
import { IOrder, providePendingOrdersService } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { decodePath, formatTime } from '@yuants/utils';
import { defer } from 'rxjs';
import { getDefaultCredential, postFutureCancelOrder, postFuturePlaceOrder } from '../api/private-api';
import { getFuturesAccountInfo, listFuturePendingOrders } from './accounts/futures';
import { getSpotAccountInfo, listSpotPendingOrders } from './accounts/spot';
import { getFuturesAccountId, getSpotAccountId } from './accounts/profile';
import { buildFutureOrderParams } from './orders/order-utils';

const terminal = Terminal.fromNodeEnv();
const credential = getDefaultCredential();

defer(async () => {
  const accountId = await getFuturesAccountId();
  addAccountMarket(terminal, { account_id: accountId, market_id: 'BITGET/USDT-FUTURE' });

  provideAccountInfoService(terminal, accountId, async () => getFuturesAccountInfo(credential, accountId), {
    auto_refresh_interval: 1000,
  });

  providePendingOrdersService(
    terminal,
    accountId,
    async () => listFuturePendingOrders(credential, accountId),
    { auto_refresh_interval: 5000 },
  );

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

defer(async () => {
  const accountId = await getSpotAccountId();
  addAccountMarket(terminal, { account_id: accountId, market_id: 'BITGET/SPOT' });

  provideAccountInfoService(terminal, accountId, async () => getSpotAccountInfo(credential, accountId), {
    auto_refresh_interval: 1000,
  });

  providePendingOrdersService(terminal, accountId, async () => listSpotPendingOrders(credential, accountId), {
    auto_refresh_interval: 5000,
  });
}).subscribe();
