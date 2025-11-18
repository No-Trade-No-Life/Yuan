import { addAccountMarket, provideAccountInfoService } from '@yuants/data-account';
import { IOrder, providePendingOrdersService } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';
import { resolveAccountProfile } from './accounts/profile';
import { getFutureAccountInfo } from './accounts/future';
import { getUnifiedAccountInfo } from './accounts/unified';
import { getSpotAccountInfo } from './accounts/spot';
import { listOrders } from './orders/listOrders';
import { submitOrder } from './orders/submitOrder';
import { cancelOrder } from './orders/cancelOrder';
import { getDefaultCredential } from './default-credential';

const credential = getDefaultCredential();

if (credential) {
  (async () => {
    const terminal = Terminal.fromNodeEnv();
    const accountIds = await resolveAccountProfile(credential);

    provideAccountInfoService(
      terminal,
      accountIds.future,
      () => getFutureAccountInfo(credential, accountIds.future),
      { auto_refresh_interval: 1000 },
    );
    addAccountMarket(terminal, { account_id: accountIds.future, market_id: 'GATE/USDT-FUTURE' });

    provideAccountInfoService(
      terminal,
      accountIds.unified,
      () => getUnifiedAccountInfo(credential, accountIds.unified),
      { auto_refresh_interval: 1000 },
    );
    addAccountMarket(terminal, { account_id: accountIds.unified, market_id: 'GATE/UNIFIED' });

    provideAccountInfoService(
      terminal,
      accountIds.spot,
      () => getSpotAccountInfo(credential, accountIds.spot),
      { auto_refresh_interval: 1000 },
    );
    addAccountMarket(terminal, { account_id: accountIds.spot, market_id: 'GATE/SPOT' });

    providePendingOrdersService(
      terminal,
      accountIds.future,
      () => listOrders(credential, accountIds.future),
      { auto_refresh_interval: 2000 },
    );

    terminal.server.provideService<IOrder, { order_id: string }>(
      'SubmitOrder',
      {
        required: ['account_id'],
        properties: { account_id: { const: accountIds.future } },
      },
      async (msg) => {
        try {
          const data = await submitOrder(credential, msg.req);
          return { res: { code: 0, message: 'OK', data } };
        } catch (error) {
          return { res: { code: 500, message: `${error}` } };
        }
      },
    );

    terminal.server.provideService<IOrder>(
      'CancelOrder',
      {
        required: ['account_id'],
        properties: { account_id: { const: accountIds.future } },
      },
      async (msg) => {
        try {
          await cancelOrder(credential, msg.req);
          return { res: { code: 0, message: 'OK' } };
        } catch (error) {
          return { res: { code: 500, message: `${error}` } };
        }
      },
    );
  })().catch((error) => {
    console.error(formatTime(Date.now()), 'GateLegacyInitFailed', error);
  });
}
