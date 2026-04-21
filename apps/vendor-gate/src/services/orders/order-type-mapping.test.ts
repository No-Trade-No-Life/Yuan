import { mapGateOrderToOrderType } from './mapGateOrderToOrderType';
import { mapOrderTypeToTif } from './mapOrderTypeToTif';

jest.mock('../../api/private-api', () => ({
  getFuturesOrders: jest.fn(async () => []),
  postFutureOrders: jest.fn(async (_credential, _settle, payload) => ({
    id: 'mock-order-id',
    ...payload,
  })),
}));

const { getFuturesOrders, postFutureOrders } = jest.requireMock('../../api/private-api') as {
  getFuturesOrders: jest.Mock;
  postFutureOrders: jest.Mock;
};

const { listOrders } = require('./listOrders') as typeof import('./listOrders');
const { submitOrder } = require('./submitOrder') as typeof import('./submitOrder');

const baseOrder = {
  account_id: 'gate/test/future/USDT',
  product_id: 'GATE/FUTURE/BTC_USDT',
  order_direction: 'OPEN_LONG' as const,
  volume: 1,
};

describe('mapOrderTypeToTif', () => {
  test('maps IOC and FOK to Gate tif values', () => {
    expect(mapOrderTypeToTif('IOC')).toBe('ioc');
    expect(mapOrderTypeToTif('FOK')).toBe('fok');
  });
});

describe('mapGateOrderToOrderType', () => {
  test('maps Gate tif and price to Yuan order types', () => {
    expect(mapGateOrderToOrderType({ tif: 'ioc', price: '0' })).toBe('MARKET');
    expect(mapGateOrderToOrderType({ tif: 'ioc', price: '12345' })).toBe('IOC');
    expect(mapGateOrderToOrderType({ tif: 'fok', price: '12345' })).toBe('FOK');
  });

  test('returns undefined when Gate tif cannot be mapped reliably', () => {
    expect(mapGateOrderToOrderType({ tif: 'gtc', price: '12345' })).toBeUndefined();
    expect(mapGateOrderToOrderType({ tif: 'poc', price: '12345' })).toBeUndefined();
  });
});

describe('submitOrder order type mapping', () => {
  beforeEach(() => {
    postFutureOrders.mockClear();
  });

  test('forwards IOC with tif=ioc and keeps the real price', async () => {
    await submitOrder({} as never, {
      ...baseOrder,
      order_type: 'IOC',
      price: 12345,
    });

    expect(postFutureOrders).toHaveBeenCalledWith(
      expect.anything(),
      'usdt',
      expect.objectContaining({
        tif: 'ioc',
        price: '12345',
      }),
    );
  });

  test('forwards FOK with tif=fok and keeps the real price', async () => {
    await submitOrder({} as never, {
      ...baseOrder,
      order_type: 'FOK',
      price: 12345,
    });

    expect(postFutureOrders).toHaveBeenCalledWith(
      expect.anything(),
      'usdt',
      expect.objectContaining({
        tif: 'fok',
        price: '12345',
      }),
    );
  });

  test('still sends market orders with price=0', async () => {
    await submitOrder({} as never, {
      ...baseOrder,
      order_type: 'MARKET',
    });

    expect(postFutureOrders).toHaveBeenCalledWith(
      expect.anything(),
      'usdt',
      expect.objectContaining({
        tif: 'ioc',
        price: '0',
      }),
    );
  });
});

describe('listOrders order type mapping', () => {
  beforeEach(() => {
    getFuturesOrders.mockClear();
  });

  test('reads back order_type from Gate tif and price', async () => {
    getFuturesOrders.mockResolvedValueOnce([
      {
        id: 'market-order',
        contract: 'GATE/FUTURE/BTC_USDT',
        size: 1,
        left: 1,
        price: '0',
        fill_price: '0',
        tif: 'ioc',
        is_close: false,
        create_time: 1,
        status: 'open',
      },
      {
        id: 'ioc-order',
        contract: 'GATE/FUTURE/BTC_USDT',
        size: 1,
        left: 1,
        price: '12345',
        fill_price: '0',
        tif: 'ioc',
        is_close: false,
        create_time: 2,
        status: 'open',
      },
      {
        id: 'fok-order',
        contract: 'GATE/FUTURE/BTC_USDT',
        size: 1,
        left: 1,
        price: '12345',
        fill_price: '0',
        tif: 'fok',
        is_close: false,
        create_time: 3,
        status: 'open',
      },
    ]);

    const orders = await listOrders({} as never);

    expect(orders.map((order) => order.order_type)).toEqual(['MARKET', 'IOC', 'FOK']);
  });
});
