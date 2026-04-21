import { encodePath } from '@yuants/utils';

jest.mock('../../api/private-api', () => ({
  getSpotOpenOrders: jest.fn(),
  getUnifiedUmOpenOrders: jest.fn(),
  postSpotOrder: jest.fn(),
  postUmOrder: jest.fn(),
}));

jest.mock('../../api/client', () => ({
  isApiError: jest.fn(() => false),
}));

jest.mock('../trade-history', () => ({
  fetchTradeHistory: jest.fn(),
}));

import { getSpotOpenOrders, getUnifiedUmOpenOrders, postSpotOrder, postUmOrder } from '../../api/private-api';
import { mapBinanceOrderTypeToYuants, mapOrderTypeToOrdType, mapOrderTypeToTimeInForce } from './order-utils';
import { listSpotOrders, listUnifiedUmOrders } from './listOrders';
import { submitOrder } from './submitOrder';

const mockedGetSpotOpenOrders = jest.mocked(getSpotOpenOrders);
const mockedGetUnifiedUmOpenOrders = jest.mocked(getUnifiedUmOpenOrders);
const mockedPostSpotOrder = jest.mocked(postSpotOrder);
const mockedPostUmOrder = jest.mocked(postUmOrder);

describe('Binance order type mappings', () => {
  beforeEach(() => {
    jest.resetAllMocks();

    mockedPostSpotOrder.mockResolvedValue({
      symbol: 'BTCUSDT',
      orderId: 1,
      clientOrderId: 'spot-order',
      transactTime: 1,
    });

    mockedPostUmOrder.mockResolvedValue({
      orderId: 2,
      symbol: 'BTCUSDT',
      status: 'NEW',
      clientOrderId: 'um-order',
      price: '12345',
      avgPrice: '0',
      origQty: '1',
      executedQty: '0',
      cumQty: '0',
      cumQuote: '0',
      timeInForce: 'GTC',
      type: 'LIMIT',
      reduceOnly: false,
      side: 'BUY',
      positionSide: 'LONG',
      selfTradePreventionMode: 'NONE',
      goodTillDate: 0,
      updateTime: 1,
    });
  });

  test('maps IOC and FOK order types to Binance LIMIT orders', () => {
    expect(mapOrderTypeToOrdType('IOC')).toBe('LIMIT');
    expect(mapOrderTypeToOrdType('FOK')).toBe('LIMIT');
  });

  test('maps Yuan order types to Binance timeInForce values', () => {
    expect(mapOrderTypeToTimeInForce('LIMIT')).toBe('GTC');
    expect(mapOrderTypeToTimeInForce('MAKER')).toBe('GTX');
    expect(mapOrderTypeToTimeInForce('IOC')).toBe('IOC');
    expect(mapOrderTypeToTimeInForce('FOK')).toBe('FOK');
    expect(mapOrderTypeToTimeInForce('MARKET')).toBeUndefined();
  });

  test('maps Binance type and timeInForce back to Yuan order types', () => {
    expect(mapBinanceOrderTypeToYuants('MARKET')).toBe('MARKET');
    expect(mapBinanceOrderTypeToYuants('LIMIT', 'GTC')).toBe('LIMIT');
    expect(mapBinanceOrderTypeToYuants('LIMIT', 'GTX')).toBe('MAKER');
    expect(mapBinanceOrderTypeToYuants('LIMIT', 'IOC')).toBe('IOC');
    expect(mapBinanceOrderTypeToYuants('LIMIT', 'FOK')).toBe('FOK');
  });

  test.each([
    ['SPOT', 'IOC', 'IOC'],
    ['SPOT', 'FOK', 'FOK'],
    ['USDT-FUTURE', 'IOC', 'IOC'],
    ['USDT-FUTURE', 'FOK', 'FOK'],
  ])('submitOrder sends %s %s orders with timeInForce=%s', async (marketType, orderType, tif) => {
    const productId = encodePath('BINANCE', marketType, 'BTCUSDT');

    await expect(
      submitOrder(
        { access_key: 'ak', secret_key: 'sk' },
        {
          account_id: 'BINANCE/test',
          product_id: productId,
          order_type: orderType as 'IOC' | 'FOK',
          order_direction: 'OPEN_LONG',
          volume: 1,
          price: 12345,
        },
      ),
    ).resolves.toEqual({ order_id: marketType === 'SPOT' ? '1' : '2' });

    if (marketType === 'SPOT') {
      expect(mockedPostSpotOrder).toHaveBeenCalledWith(
        { access_key: 'ak', secret_key: 'sk' },
        expect.objectContaining({ symbol: 'BTCUSDT', type: 'LIMIT', timeInForce: tif, price: 12345 }),
      );
      return;
    }

    expect(mockedPostUmOrder).toHaveBeenCalledWith(
      { access_key: 'ak', secret_key: 'sk' },
      expect.objectContaining({ symbol: 'BTCUSDT', type: 'LIMIT', timeInForce: tif, price: 12345 }),
    );
  });

  test('listOrders maps LIMIT+IOC/FOK/GTX readback values correctly', async () => {
    mockedGetSpotOpenOrders.mockResolvedValue([
      {
        symbol: 'BTCUSDT',
        orderId: 11,
        orderListId: -1,
        clientOrderId: 'spot-maker',
        price: '12345',
        origQty: '1',
        executedQty: '0',
        origQuoteOrderQty: '0',
        cummulativeQuoteQty: '0',
        status: 'NEW',
        timeInForce: 'GTX',
        type: 'LIMIT',
        side: 'BUY',
        stopPrice: '0',
        icebergQty: '0',
        time: 1,
        updateTime: 2,
        isWorking: true,
      },
      {
        symbol: 'ETHUSDT',
        orderId: 12,
        orderListId: -1,
        clientOrderId: 'spot-ioc',
        price: '2345',
        origQty: '2',
        executedQty: '0',
        origQuoteOrderQty: '0',
        cummulativeQuoteQty: '0',
        status: 'NEW',
        timeInForce: 'IOC',
        type: 'LIMIT',
        side: 'BUY',
        stopPrice: '0',
        icebergQty: '0',
        time: 3,
        updateTime: 4,
        isWorking: true,
      },
    ]);

    mockedGetUnifiedUmOpenOrders.mockResolvedValue([
      {
        avgPrice: '0',
        clientOrderId: 'um-fok',
        cumQuote: '0',
        executedQty: '0',
        orderId: 21,
        origQty: '3',
        origType: 'LIMIT',
        price: '3456',
        reduceOnly: false,
        side: 'SELL',
        positionSide: 'SHORT',
        status: 'NEW',
        symbol: 'BTCUSDT',
        time: 5,
        timeInForce: 'FOK',
        type: 'LIMIT',
        updateTime: 6,
        selfTradePreventionMode: 'NONE',
        goodTillDate: 0,
      },
    ]);

    await expect(listSpotOrders({ access_key: 'ak', secret_key: 'sk' })).resolves.toMatchObject([
      { order_id: '11', order_type: 'MAKER' },
      { order_id: '12', order_type: 'IOC' },
    ]);

    await expect(listUnifiedUmOrders({ access_key: 'ak', secret_key: 'sk' })).resolves.toMatchObject([
      { order_id: '21', order_type: 'FOK' },
    ]);
  });
});
