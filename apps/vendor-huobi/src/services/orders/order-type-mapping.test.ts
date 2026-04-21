import { encodePath } from '@yuants/utils';
import { mapSwapOrderTypeToHuobi, mapUnionSwapOrderTypeToHuobi } from './mapSwapOrderTypeToHuobi';
import { mapHuobiSwapOrderToOrderType } from './mapHuobiSwapOrderToOrderType';

jest.mock('../../api/private-api', () => ({
  getCrossMarginLoanInfo: jest.fn(),
  getSpotAccountBalance: jest.fn(),
  getSwapOpenOrders: jest.fn(),
  getSwapCrossPositionInfo: jest.fn(),
  postSwapOrder: jest.fn(),
  postUnionAccountSwapOrder: jest.fn(),
}));

jest.mock('../../api/public-api', () => ({
  getSpotTick: jest.fn(),
}));

jest.mock('../exchange', () => ({
  accountModeCache: {
    query: jest.fn(),
  },
}));

jest.mock('../product', () => ({
  productCache: {
    query: jest.fn(),
  },
}));

jest.mock('../uid', () => ({
  superMarginAccountUidCache: {
    query: jest.fn(),
  },
}));

const { getSwapCrossPositionInfo, getSwapOpenOrders, postSwapOrder, postUnionAccountSwapOrder } =
  require('../../api/private-api') as typeof import('../../api/private-api');
const { accountModeCache } = require('../exchange') as typeof import('../exchange');
const { listSwapOrders } = require('./listOrders') as typeof import('./listOrders');
const { submitOrder } = require('./submitOrder') as typeof import('./submitOrder');

const mockGetSwapCrossPositionInfo = getSwapCrossPositionInfo as jest.MockedFunction<
  typeof getSwapCrossPositionInfo
>;
const mockGetSwapOpenOrders = getSwapOpenOrders as jest.MockedFunction<typeof getSwapOpenOrders>;
const mockPostSwapOrder = postSwapOrder as jest.MockedFunction<typeof postSwapOrder>;
const mockPostUnionAccountSwapOrder = postUnionAccountSwapOrder as jest.MockedFunction<
  typeof postUnionAccountSwapOrder
>;
const mockAccountModeQuery = accountModeCache.query as jest.MockedFunction<typeof accountModeCache.query>;

describe('Huobi swap order type mappings', () => {
  test('maps MARKET LIMIT IOC and FOK for normal swap accounts', () => {
    expect(mapSwapOrderTypeToHuobi('MARKET')).toEqual({ order_price_type: 'market' });
    expect(mapSwapOrderTypeToHuobi('LIMIT')).toEqual({ order_price_type: 'limit' });
    expect(mapSwapOrderTypeToHuobi('IOC')).toEqual({ order_price_type: 'ioc' });
    expect(mapSwapOrderTypeToHuobi('FOK')).toEqual({ order_price_type: 'fok' });
  });

  test('maps MARKET LIMIT IOC and FOK for unified swap accounts', () => {
    expect(mapUnionSwapOrderTypeToHuobi('MARKET')).toEqual({ type: 'market', time_in_force: undefined });
    expect(mapUnionSwapOrderTypeToHuobi('LIMIT')).toEqual({ type: 'limit', time_in_force: undefined });
    expect(mapUnionSwapOrderTypeToHuobi('IOC')).toEqual({ type: 'limit', time_in_force: 'ioc' });
    expect(mapUnionSwapOrderTypeToHuobi('FOK')).toEqual({ type: 'limit', time_in_force: 'fok' });
  });
});

describe('mapHuobiSwapOrderToOrderType', () => {
  test('maps Huobi order_price_type values back to Yuan order types', () => {
    expect(mapHuobiSwapOrderToOrderType('market')).toBe('MARKET');
    expect(mapHuobiSwapOrderToOrderType('lightning')).toBe('MARKET');
    expect(mapHuobiSwapOrderToOrderType('limit')).toBe('LIMIT');
    expect(mapHuobiSwapOrderToOrderType('ioc')).toBe('IOC');
    expect(mapHuobiSwapOrderToOrderType('optimal_20_ioc')).toBe('IOC');
    expect(mapHuobiSwapOrderToOrderType('fok')).toBe('FOK');
    expect(mapHuobiSwapOrderToOrderType('post_only')).toBe('LIMIT');
  });
});

describe('submitOrder normal swap account order type mapping', () => {
  const credential = { access_key: 'ak', secret_key: 'sk' };
  const product_id = encodePath('HUOBI', 'SWAP', 'BTC-USDT');

  beforeEach(() => {
    process.env.BROKER_ID = 'broker-id';
    mockAccountModeQuery.mockResolvedValue(0);
    mockGetSwapCrossPositionInfo.mockResolvedValue({
      status: 'ok',
      ts: 1,
      data: [
        {
          symbol: 'BTC',
          contract_code: 'BTC-USDT',
          volume: 1,
          available: 1,
          frozen: 0,
          cost_open: 10000,
          cost_hold: 10000,
          profit_unreal: 0,
          profit_rate: 0,
          lever_rate: 20,
          position_margin: 100,
          direction: 'buy',
          profit: 0,
          last_price: 12345,
          margin_asset: 'USDT',
          margin_mode: 'cross',
          margin_account: 'BTC-USDT',
          contract_type: 'swap',
          pair: 'BTC-USDT',
          business_type: 'swap',
          position_mode: 'single',
          adl_risk_percent: '0',
        },
      ],
    });
    mockPostSwapOrder.mockResolvedValue({
      status: 'ok',
      ts: 1,
      data: { order_id: 1, order_id_str: '1' },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('uses market order_price_type for MARKET normal swap orders', async () => {
    await submitOrder(credential, {
      product_id,
      order_type: 'MARKET',
      order_direction: 'OPEN_LONG',
      volume: 1,
      price: 12345,
    } as any);

    expect(mockPostSwapOrder).toHaveBeenCalledWith(credential, {
      contract_code: 'BTC-USDT',
      contract_type: 'swap',
      price: 12345,
      volume: 1,
      offset: 'open',
      direction: 'buy',
      lever_rate: 20,
      order_price_type: 'market',
      channel_code: 'broker-id',
    });
  });

  test('uses limit order_price_type for LIMIT normal swap orders', async () => {
    await submitOrder(credential, {
      product_id,
      order_type: 'LIMIT',
      order_direction: 'OPEN_LONG',
      volume: 1,
      price: 12345,
    } as any);

    expect(mockPostSwapOrder).toHaveBeenCalledWith(credential, {
      contract_code: 'BTC-USDT',
      contract_type: 'swap',
      price: 12345,
      volume: 1,
      offset: 'open',
      direction: 'buy',
      lever_rate: 20,
      order_price_type: 'limit',
      channel_code: 'broker-id',
    });
  });

  test('uses ioc order_price_type for IOC normal swap orders', async () => {
    await submitOrder(credential, {
      product_id,
      order_type: 'IOC',
      order_direction: 'OPEN_LONG',
      volume: 1,
      price: 12345,
    } as any);

    expect(mockPostSwapOrder).toHaveBeenCalledWith(credential, {
      contract_code: 'BTC-USDT',
      contract_type: 'swap',
      price: 12345,
      volume: 1,
      offset: 'open',
      direction: 'buy',
      lever_rate: 20,
      order_price_type: 'ioc',
      channel_code: 'broker-id',
    });
  });

  test('uses fok order_price_type for FOK normal swap orders', async () => {
    await submitOrder(credential, {
      product_id,
      order_type: 'FOK',
      order_direction: 'OPEN_LONG',
      volume: 1,
      price: 12345,
    } as any);

    expect(mockPostSwapOrder).toHaveBeenCalledWith(credential, {
      contract_code: 'BTC-USDT',
      contract_type: 'swap',
      price: 12345,
      volume: 1,
      offset: 'open',
      direction: 'buy',
      lever_rate: 20,
      order_price_type: 'fok',
      channel_code: 'broker-id',
    });
  });
});

describe('submitOrder unified swap account order type mapping', () => {
  const credential = { access_key: 'ak', secret_key: 'sk' };
  const product_id = encodePath('HUOBI', 'SWAP', 'BTC-USDT');

  beforeEach(() => {
    process.env.BROKER_ID = 'broker-id';
    mockAccountModeQuery.mockResolvedValue(1);
    mockPostUnionAccountSwapOrder.mockResolvedValue({
      code: 200,
      message: 'ok',
      data: { order_id: 1, order_id_str: '1' },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test.each([
    ['IOC', 'ioc'],
    ['FOK', 'fok'],
  ])('uses %s time_in_force for unified swap orders', async (orderType, timeInForce) => {
    await submitOrder(credential, {
      product_id,
      order_type: orderType,
      order_direction: 'OPEN_LONG',
      volume: 1,
      price: 12345,
    } as any);

    expect(mockPostUnionAccountSwapOrder).toHaveBeenCalledWith(credential, {
      contract_code: 'BTC-USDT',
      margin_mode: 'cross',
      price: 12345,
      volume: 1,
      position_side: 'both',
      side: 'buy',
      type: 'limit',
      time_in_force: timeInForce,
      channel_code: 'broker-id',
      reduce_only: 0,
    });
  });
});

describe('listSwapOrders order type mapping', () => {
  const credential = { access_key: 'ak', secret_key: 'sk' };

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('maps Huobi order_price_type values back to Yuan order types', async () => {
    mockGetSwapOpenOrders
      .mockResolvedValueOnce({
        status: 'ok',
        data: {
          orders: [
            {
              order_id_str: '1',
              contract_code: 'BTC-USDT',
              order_price_type: 'lightning',
              direction: 'open',
              offset: 'buy',
              volume: 1,
              created_at: 1,
              price: 100,
              trade_volume: 0,
            },
            {
              order_id_str: '2',
              contract_code: 'BTC-USDT',
              order_price_type: 'limit',
              direction: 'open',
              offset: 'buy',
              volume: 1,
              created_at: 2,
              price: 200,
              trade_volume: 0,
            },
            {
              order_id_str: '3',
              contract_code: 'BTC-USDT',
              order_price_type: 'ioc',
              direction: 'open',
              offset: 'buy',
              volume: 1,
              created_at: 3,
              price: 300,
              trade_volume: 0,
            },
            {
              order_id_str: '4',
              contract_code: 'BTC-USDT',
              order_price_type: 'fok',
              direction: 'open',
              offset: 'buy',
              volume: 1,
              created_at: 4,
              price: 400,
              trade_volume: 0,
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        status: 'ok',
        data: {
          orders: [],
        },
      });

    const orders = await listSwapOrders(credential);

    expect(orders.map((v) => v.order_type)).toEqual(['MARKET', 'LIMIT', 'IOC', 'FOK']);
  });
});
