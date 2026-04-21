import { mapGateOrderToOrderType } from './mapGateOrderToOrderType';
import { mapOrderTypeToTif } from './mapOrderTypeToTif';

jest.mock('../../api/private-api', () => ({
  postFutureOrders: jest.fn(async (_credential, _settle, payload) => ({
    id: 'mock-order-id',
    ...payload,
  })),
}));

const { postFutureOrders } = jest.requireMock('../../api/private-api') as {
  postFutureOrders: jest.Mock;
};

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
