import { provideAccountInfoService } from '@yuants/data-account';
import { IOrder, providePendingOrdersService } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { getDefaultCredential } from '../api/private-api';
import { getPerpAccountInfo } from '../services/accounts/perp';
import { getSpotAccountInfo } from '../services/accounts/spot';
import { handleCancelOrder } from '../services/orders/cancelOrder';
import { handleSubmitOrder } from '../services/orders/submitOrder';
import { listOrders } from './orders/listOrders';

const ADDRESS = process.env.ADDRESS!;
const credential = getDefaultCredential();
const terminal = Terminal.fromNodeEnv();

export const SPOT_ACCOUNT_ID = `ASTER/${ADDRESS}/SPOT`;
export const ACCOUNT_ID = `ASTER/${ADDRESS}`;

provideAccountInfoService(
  Terminal.fromNodeEnv(),
  SPOT_ACCOUNT_ID,
  async () => getSpotAccountInfo(credential, SPOT_ACCOUNT_ID),
  { auto_refresh_interval: 1000 },
);

provideAccountInfoService(
  Terminal.fromNodeEnv(),
  ACCOUNT_ID,
  async () => getPerpAccountInfo(credential, ACCOUNT_ID),
  { auto_refresh_interval: 1000 },
);

providePendingOrdersService(terminal, ACCOUNT_ID, async () => listOrders(credential, ACCOUNT_ID), {
  auto_refresh_interval: 2000,
});

Terminal.fromNodeEnv().server.provideService<IOrder, { order_id: string }>(
  'SubmitOrder',
  { required: ['account_id'], properties: { account_id: { type: 'string', const: SPOT_ACCOUNT_ID } } },
  async (msg) => {
    const order = msg.req;

    const data = await handleSubmitOrder(credential, order);

    return { res: { code: 0, message: 'OK', data } };
  },
);

terminal.server.provideService<IOrder, { order_id?: string }>(
  'SubmitOrder',
  { required: ['account_id'], properties: { account_id: { type: 'string', const: ACCOUNT_ID } } },
  async (msg) => {
    const order = msg.req;
    const data = await handleSubmitOrder(credential, order);

    return {
      res: {
        code: 0,
        message: 'OK',
        data,
      },
    };
  },
);

terminal.server.provideService<IOrder>(
  'CancelOrder',
  {
    required: ['account_id', 'order_id', 'product_id'],
    properties: {
      account_id: { type: 'string', const: ACCOUNT_ID },
      order_id: { type: ['string', 'number'] },
      product_id: { type: 'string' },
    },
  },
  async (msg) => {
    const order = msg.req;

    await handleCancelOrder(credential, order);

    return { res: { code: 0, message: 'OK' } };
  },
);
