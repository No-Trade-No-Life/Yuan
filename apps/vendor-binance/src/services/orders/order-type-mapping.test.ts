import { encodePath } from '@yuants/utils';

jest.mock('../../api/private-api', () => ({
  postSpotOrder: jest.fn(),
  postUmOrder: jest.fn(),
}));

jest.mock('../../api/client', () => ({
  isApiError: jest.fn(() => false),
}));

jest.mock('../trade-history', () => ({
  fetchTradeHistory: jest.fn(),
}));

import { postSpotOrder, postUmOrder } from '../../api/private-api';
import { mapBinanceOrderTypeToYuants, mapOrderTypeToOrdType, mapOrderTypeToTimeInForce } from './order-utils';
import { submitOrder } from './submitOrder';

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
});
