import type { IAsterFutureOpenOrder, IAsterSpotOpenOrder } from '../../api/private-api';

jest.mock('../../api/private-api', () => ({
  getApiV1TickerPrice: jest.fn(),
  postApiV1Order: jest.fn(),
  postFApiV1Order: jest.fn(),
}));

jest.mock('../trade-history', () => ({
  fetchTradeHistory: jest.fn(),
}));

import { postApiV1Order, postFApiV1Order } from '../../api/private-api';
import { mapPerpOrder, mapSpotOrder } from './listOrders';
import { handleSubmitOrder } from './submitOrder';

const mockedPostApiV1Order = jest.mocked(postApiV1Order);
const mockedPostFApiV1Order = jest.mocked(postFApiV1Order);

const baseSpotOrder: IAsterSpotOpenOrder = {
  symbol: 'BTCUSDT',
  orderId: 11,
  clientOrderId: 'spot-order',
  price: '12345',
  origQty: '1',
  executedQty: '0',
  status: 'NEW',
  timeInForce: 'GTC',
  type: 'LIMIT',
  side: 'BUY',
  time: 1,
  updateTime: 2,
};

const basePerpOrder: IAsterFutureOpenOrder = {
  symbol: 'BTCUSDT',
  orderId: 21,
  clientOrderId: 'perp-order',
  price: '23456',
  origQty: '2',
  executedQty: '0',
  status: 'NEW',
  timeInForce: 'GTC',
  type: 'LIMIT',
  side: 'BUY',
  updateTime: 3,
  avgPrice: '0',
};

describe('Aster order type mappings', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedPostApiV1Order.mockResolvedValue({ orderId: 1 });
    mockedPostFApiV1Order.mockResolvedValue({ orderId: 2 } as never);
  });

  test.each([
    ['ASTER/SPOT/BTCUSDT', 'IOC', 'IOC'],
    ['ASTER/SPOT/BTCUSDT', 'FOK', 'FOK'],
    ['ASTER/PERP/BTCUSDT', 'IOC', 'IOC'],
    ['ASTER/PERP/BTCUSDT', 'FOK', 'FOK'],
  ] as const)('submitOrder sends %s %s with timeInForce=%s', async (product_id, order_type, tif) => {
    const result = await handleSubmitOrder(
      { address: 'addr', api_key: 'ak', secret_key: 'sk' },
      {
        account_id: 'ASTER/test',
        product_id,
        order_type,
        order_direction: 'OPEN_LONG',
        volume: 1,
        price: 12345,
      },
    );

    expect(result).toEqual({ order_id: product_id.includes('/SPOT/') ? '1' : '2' });

    if (product_id.includes('/SPOT/')) {
      expect(mockedPostApiV1Order).toHaveBeenCalledWith(
        { address: 'addr', api_key: 'ak', secret_key: 'sk' },
        expect.objectContaining({ symbol: 'BTCUSDT', type: 'LIMIT', timeInForce: tif, price: 12345 }),
      );
      return;
    }

    expect(mockedPostFApiV1Order).toHaveBeenCalledWith(
      { address: 'addr', api_key: 'ak', secret_key: 'sk' },
      expect.objectContaining({ symbol: 'BTCUSDT', type: 'LIMIT', timeInForce: tif, price: 12345 }),
    );
  });

  test('mapSpotOrder restores LIMIT plus timeInForce variants', () => {
    expect(mapSpotOrder({ ...baseSpotOrder, timeInForce: 'GTC' }, '')).toMatchObject({ order_type: 'LIMIT' });
    expect(mapSpotOrder({ ...baseSpotOrder, timeInForce: 'GTX' }, '')).toMatchObject({ order_type: 'MAKER' });
    expect(mapSpotOrder({ ...baseSpotOrder, timeInForce: 'IOC' }, '')).toMatchObject({ order_type: 'IOC' });
    expect(mapSpotOrder({ ...baseSpotOrder, timeInForce: 'FOK' }, '')).toMatchObject({ order_type: 'FOK' });
  });

  test('mapPerpOrder restores LIMIT plus timeInForce variants', () => {
    expect(mapPerpOrder({ ...basePerpOrder, timeInForce: 'GTC' }, '')).toMatchObject({ order_type: 'LIMIT' });
    expect(mapPerpOrder({ ...basePerpOrder, timeInForce: 'GTX' }, '')).toMatchObject({ order_type: 'MAKER' });
    expect(mapPerpOrder({ ...basePerpOrder, timeInForce: 'IOC' }, '')).toMatchObject({ order_type: 'IOC' });
    expect(mapPerpOrder({ ...basePerpOrder, timeInForce: 'FOK' }, '')).toMatchObject({ order_type: 'FOK' });
  });
});
