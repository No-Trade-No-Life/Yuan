import { addAccountMarket, provideAccountInfoService } from '@yuants/data-account';
import { IOrder, providePendingOrdersService } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { getAddressFromCredential, getDefaultCredential } from '../api/types';
import { getPerpAccountInfo } from './accounts/perp';
import { getSpotAccountInfo } from './accounts/spot';
import { cancelOrderAction } from './orders/cancelOrder';
import { listOrders } from './orders/listOrders';
import { submitOrder } from './orders/submitOrder';

const terminal = Terminal.fromNodeEnv();
const credential = getDefaultCredential();
const walletAddress = getAddressFromCredential(credential).toLowerCase();
const defaultPerpAccountId = `hyperliquid/${walletAddress}/perp`;
const defaultSpotAccountId = `hyperliquid/${walletAddress}/spot`;

addAccountMarket(terminal, { account_id: defaultPerpAccountId, market_id: 'HYPERLIQUID/PERP' });
addAccountMarket(terminal, { account_id: defaultSpotAccountId, market_id: 'HYPERLIQUID/SPOT' });

provideAccountInfoService(
  terminal,
  defaultPerpAccountId,
  async () => {
    const info = await getPerpAccountInfo(credential, defaultPerpAccountId);
    return info;
  },
  { auto_refresh_interval: 1000 },
);

providePendingOrdersService(
  terminal,
  defaultPerpAccountId,
  async () => listOrders(credential, defaultPerpAccountId),
  { auto_refresh_interval: 2000 },
);

provideAccountInfoService(
  terminal,
  defaultSpotAccountId,
  async () => getSpotAccountInfo(credential, defaultSpotAccountId),
  { auto_refresh_interval: 5000 },
);

terminal.server.provideService<IOrder, { order_id?: string }>(
  'SubmitOrder',
  {
    required: ['account_id', 'product_id', 'order_type', 'order_direction', 'volume'],
    properties: {
      account_id: { const: defaultPerpAccountId },
    },
  },
  async (msg) => {
    return {
      res: {
        code: 0,
        message: 'OK',
        data: await submitOrder(credential, msg.req),
      },
    };
  },
);

terminal.server.provideService<IOrder>(
  'CancelOrder',
  {
    required: ['account_id', 'order_id', 'product_id'],
    properties: {
      account_id: { const: defaultPerpAccountId },
    },
  },
  async (msg) => {
    await cancelOrderAction(credential, msg.req);
    return {
      res: {
        code: 0,
        message: 'OK',
      },
    };
  },
);
