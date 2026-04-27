import { encodePath } from '@yuants/utils';

jest.mock('../../api/private-api', () => ({
  postPlaceOrder: jest.fn(),
  getUnfilledOrders: jest.fn(),
}));

import { getUnfilledOrders, postPlaceOrder } from '../../api/private-api';
import { mapBitgetOrderToOrderType } from './mapBitgetOrderToOrderType';
import { listFuturesOrders, listSpotOrders } from './listOrders';
import { mapOrderTypeToBitgetOrderParams } from './mapOrderTypeToBitgetOrderParams';
import { submitOrder } from './submitOrder';

const mockedPostPlaceOrder = jest.mocked(postPlaceOrder);
const mockedGetUnfilledOrders = jest.mocked(getUnfilledOrders);

describe('mapOrderTypeToBitgetOrderParams', () => {
  test('maps MARKET LIMIT MAKER IOC and FOK to Bitget order params', () => {
    expect(mapOrderTypeToBitgetOrderParams('MARKET')).toEqual({ orderType: 'market' });
    expect(mapOrderTypeToBitgetOrderParams('LIMIT')).toEqual({ orderType: 'limit' });
    expect(mapOrderTypeToBitgetOrderParams('MAKER')).toEqual({
      orderType: 'limit',
      timeInForce: 'post_only',
    });
    expect(mapOrderTypeToBitgetOrderParams('IOC')).toEqual({ orderType: 'limit', timeInForce: 'ioc' });
    expect(mapOrderTypeToBitgetOrderParams('FOK')).toEqual({ orderType: 'limit', timeInForce: 'fok' });
  });
});

describe('mapBitgetOrderToOrderType', () => {
  test('maps Bitget orderType and timeInForce back to Yuan order types', () => {
    expect(mapBitgetOrderToOrderType({ timeInForce: 'post_only' })).toBe('MAKER');
    expect(mapBitgetOrderToOrderType({ timeInForce: 'ioc' })).toBe('IOC');
    expect(mapBitgetOrderToOrderType({ timeInForce: 'fok' })).toBe('FOK');
    expect(mapBitgetOrderToOrderType({ orderType: 'market' })).toBe('MARKET');
    expect(mapBitgetOrderToOrderType({ orderType: 'market', timeInForce: 'ioc' })).toBe('MARKET');
    expect(mapBitgetOrderToOrderType({ orderType: 'limit' })).toBe('LIMIT');
    expect(mapBitgetOrderToOrderType({ orderType: 'unknown', timeInForce: 'gtc' })).toBe('UNKNOWN');
  });
});

describe('submitOrder', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedPostPlaceOrder.mockImplementation(async (_credential, params) => ({
      code: '00000',
      msg: 'success',
      requestTime: Date.now(),
      data: { orderId: params.symbol, clientOid: '' },
    }));
  });

  test.each([
    ['IOC', encodePath('BITGET', 'USDT-FUTURES', 'BTCUSDT'), 'limit', 'ioc', '12345'],
    ['FOK', encodePath('BITGET', 'SPOT', 'ETHUSDT'), 'limit', 'fok', '23456'],
  ])(
    'maps %s orders to Bitget order params',
    async (orderType, productId, mappedOrderType, timeInForce, price) => {
      await expect(
        submitOrder(
          { access_key: 'ak', secret_key: 'sk', passphrase: 'pp' },
          {
            account_id: 'bitget/test',
            product_id: productId,
            order_type: orderType,
            order_direction: 'OPEN_LONG',
            volume: 1,
            price: Number(price),
          },
        ),
      ).resolves.toEqual({ order_id: expect.any(String) });

      expect(mockedPostPlaceOrder).toHaveBeenLastCalledWith(
        { access_key: 'ak', secret_key: 'sk', passphrase: 'pp' },
        expect.objectContaining({ orderType: mappedOrderType, timeInForce, price }),
      );
    },
  );

  test('preserves legacy defaults when order_type is omitted', async () => {
    await submitOrder(
      { access_key: 'ak', secret_key: 'sk', passphrase: 'pp' },
      {
        account_id: 'bitget/test/futures',
        product_id: encodePath('BITGET', 'USDT-FUTURES', 'BTCUSDT'),
        order_direction: 'OPEN_LONG',
        volume: 1,
        price: 12345,
      },
    );

    await submitOrder(
      { access_key: 'ak', secret_key: 'sk', passphrase: 'pp' },
      {
        account_id: 'bitget/test/spot',
        product_id: encodePath('BITGET', 'SPOT', 'ETHUSDT'),
        order_direction: 'OPEN_LONG',
        volume: 1,
        price: 23456,
      },
    );

    expect(mockedPostPlaceOrder).toHaveBeenNthCalledWith(
      1,
      { access_key: 'ak', secret_key: 'sk', passphrase: 'pp' },
      expect.objectContaining({ orderType: 'market', timeInForce: undefined }),
    );
    expect(mockedPostPlaceOrder).toHaveBeenNthCalledWith(
      2,
      { access_key: 'ak', secret_key: 'sk', passphrase: 'pp' },
      expect.objectContaining({ orderType: 'limit', timeInForce: undefined }),
    );
  });
});

describe('listOrders', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('maps Bitget futures open orders back to MAKER IOC and FOK', async () => {
    mockedGetUnfilledOrders.mockResolvedValue({
      code: '00000',
      msg: 'success',
      requestTime: Date.now(),
      data: {
        list: [
          {
            orderId: 'maker-order',
            symbol: 'BTCUSDT',
            orderType: 'limit',
            timeInForce: 'post_only',
            side: 'buy',
            posSide: 'long',
            price: '100',
            qty: '1',
            cumExecQty: '0',
            createdTime: '1',
          },
          {
            orderId: 'ioc-order',
            symbol: 'BTCUSDT',
            orderType: 'limit',
            timeInForce: 'ioc',
            side: 'buy',
            posSide: 'long',
            price: '101',
            qty: '2',
            cumExecQty: '1',
            createdTime: '2',
          },
          {
            orderId: 'fok-order',
            symbol: 'BTCUSDT',
            orderType: 'limit',
            timeInForce: 'fok',
            side: 'sell',
            posSide: 'short',
            price: '102',
            qty: '3',
            cumExecQty: '0',
            createdTime: '3',
          },
        ],
      },
    } as never);

    await expect(
      listFuturesOrders({ access_key: 'ak', secret_key: 'sk', passphrase: 'pp' }),
    ).resolves.toMatchObject([
      { order_id: 'maker-order', order_type: 'MAKER' },
      { order_id: 'ioc-order', order_type: 'IOC' },
      { order_id: 'fok-order', order_type: 'FOK' },
    ]);
  });

  test('maps Bitget spot open orders back to MARKET and LIMIT', async () => {
    mockedGetUnfilledOrders.mockResolvedValue({
      code: '00000',
      msg: 'success',
      requestTime: Date.now(),
      data: {
        list: [
          {
            orderId: 'market-order',
            symbol: 'ETHUSDT',
            orderType: 'market',
            timeInForce: 'gtc',
            side: 'buy',
            price: '0',
            qty: '4',
            cumExecQty: '4',
            createdTime: '4',
          },
          {
            orderId: 'limit-order',
            symbol: 'ETHUSDT',
            orderType: 'limit',
            timeInForce: 'gtc',
            side: 'sell',
            price: '103',
            qty: '5',
            cumExecQty: '2',
            createdTime: '5',
          },
        ],
      },
    } as never);

    await expect(
      listSpotOrders({ access_key: 'ak', secret_key: 'sk', passphrase: 'pp' }),
    ).resolves.toMatchObject([
      { order_id: 'market-order', order_type: 'MARKET' },
      { order_id: 'limit-order', order_type: 'LIMIT' },
    ]);
  });
});
