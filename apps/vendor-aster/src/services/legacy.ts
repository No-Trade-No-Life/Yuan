import { provideAccountInfoService } from '@yuants/data-account';
import { IOrder, providePendingOrdersService } from '@yuants/data-order';
import { Terminal } from '@yuants/protocol';
import { ICredential } from '../api/private-api';
import { getPerpAccountInfo } from '../services/accounts/perp';
import { getSpotAccountInfo } from '../services/accounts/spot';
import { handleCancelOrder } from '../services/orders/cancelOrder';
import { handleSubmitOrder } from '../services/orders/submitOrder';
import { listOrders } from './orders/listOrders';

const getDefaultCredential = (): ICredential => {
  return {
    address: process.env.API_ADDRESS || '',
    api_key: process.env.API_KEY || '',
    secret_key: process.env.SECRET_KEY || '',
  };
};

const ADDRESS = process.env.ADDRESS!;
const credential = getDefaultCredential();
const terminal = Terminal.fromNodeEnv();

const SPOT_ACCOUNT_ID = `ASTER/${ADDRESS}/SPOT`;
const PERP_ACCOUNT_ID = `ASTER/${ADDRESS}`;

provideAccountInfoService(
  Terminal.fromNodeEnv(),
  SPOT_ACCOUNT_ID,
  async () => getSpotAccountInfo(credential, SPOT_ACCOUNT_ID),
  { auto_refresh_interval: 1000 },
);

provideAccountInfoService(
  Terminal.fromNodeEnv(),
  PERP_ACCOUNT_ID,
  async () => getPerpAccountInfo(credential, PERP_ACCOUNT_ID),
  { auto_refresh_interval: 1000 },
);

providePendingOrdersService(terminal, PERP_ACCOUNT_ID, async () => listOrders(credential, PERP_ACCOUNT_ID), {
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
  { required: ['account_id'], properties: { account_id: { type: 'string', const: PERP_ACCOUNT_ID } } },
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
      account_id: { type: 'string', const: PERP_ACCOUNT_ID },
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
