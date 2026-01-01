import { makeStrategyBboMaker } from '../../strategies/BBO_MAKER';
import { StrategyContext } from '../../types';

// 测试用的简化类型
const createTestPosition = (
  product_id: string,
  direction: string,
  volume: number,
  position_price: number,
) => ({
  product_id,
  direction,
  volume,
  position_price,
  position_id: `${product_id}-${direction}`,
  free_volume: volume,
  closable_price: position_price,
  floating_profit: 0,
  valuation: volume * position_price,
});

const createTestContext = (overrides: Partial<StrategyContext>): StrategyContext => ({
  accountId: 'test-account',
  productKey: 'datasource/BTC-USDT',
  actualAccountInfo: {
    account_id: 'test-account',
    money: {
      currency: 'USDT',
      equity: 10000,
      balance: 10000,
      profit: 0,
      free: 10000,
      used: 0,
    },
    positions: [],
    updated_at: Date.now(),
  },
  expectedAccountInfo: {
    account_id: 'TradeCopier/Expected/test-account',
    money: {
      currency: 'USDT',
      equity: 10000,
      balance: 10000,
      profit: 0,
      free: 10000,
      used: 0,
    },
    positions: [],
    updated_at: Date.now(),
  },
  product: {
    product_id: 'BTC-USDT',
    datasource_id: 'datasource',
    name: 'BTC-USDT',
    base_currency: 'BTC',
    quote_currency: 'USDT',
    price_step: 0.01,
    volume_step: 0.001,
    value_scale: 1,
    value_scale_unit: '',
    value_based_cost: 0,
    volume_based_cost: 0,
    max_position: 10000,
    max_volume: 1000,
    allow_long: true,
    allow_short: true,
    margin_rate: 0.1,
  },
  quote: {
    product_id: 'BTC-USDT',
    datasource_id: 'datasource',
    updated_at: new Date().toISOString(),
    last_price: '50000',
    ask_price: '51000',
    bid_price: '50000',
    ask_volume: '1',
    bid_volume: '1',
    open_interest: '1000',
    interest_rate_long: '0.01',
    interest_rate_short: '0.01',
    interest_rate_prev_settled_at: new Date().toISOString(),
    interest_rate_next_settled_at: new Date().toISOString(),
    interest_rate_settlement_interval: '',
  },
  pendingOrders: [],
  strategy: {
    type: 'BBO_MAKER',
    max_volume: 1000,
  },
  ...overrides,
});

describe('BBO_MAKER Strategy', () => {
  it('should place long open order when net volume is below expected', () => {
    const context = createTestContext({
      actualAccountInfo: {
        ...createTestContext({}).actualAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'LONG', 0.1, 50000)],
      },
      expectedAccountInfo: {
        ...createTestContext({}).expectedAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'LONG', 0.2, 50000)],
      },
    });

    const orders = makeStrategyBboMaker(context);

    expect(orders).toHaveLength(1);
    expect(orders[0].order_direction).toBe('OPEN_LONG');
    expect(orders[0].volume).toBe(0.1); // 0.2 - 0.1 = 0.1
    expect(orders[0].order_type).toBe('MAKER');
    expect(orders[0].price).toBe(50000); // 买一价
  });

  it('should place long close order when net volume is above expected', () => {
    const context = createTestContext({
      actualAccountInfo: {
        ...createTestContext({}).actualAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'LONG', 0.3, 50000)],
      },
      expectedAccountInfo: {
        ...createTestContext({}).expectedAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'LONG', 0.2, 50000)],
      },
    });

    const orders = makeStrategyBboMaker(context);

    expect(orders).toHaveLength(1);
    expect(orders[0].order_direction).toBe('CLOSE_LONG');
    expect(orders[0].volume).toBe(0.1); // 0.3 - 0.2 = 0.1
    expect(orders[0].order_type).toBe('MAKER');
    expect(orders[0].price).toBe(51000); // 卖一价
  });

  it('should close short position first when need to increase net volume', () => {
    const context = createTestContext({
      actualAccountInfo: {
        ...createTestContext({}).actualAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'SHORT', 0.05, 50000)],
      },
      expectedAccountInfo: {
        ...createTestContext({}).expectedAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'LONG', 0.1, 50000)],
      },
    });

    const orders = makeStrategyBboMaker(context);

    expect(orders).toHaveLength(1);
    expect(orders[0].order_direction).toBe('CLOSE_SHORT');
    expect(orders[0].volume).toBe(0.05); // 0.05
    expect(orders[0].order_type).toBe('MAKER');
    expect(orders[0].price).toBe(51000); // 卖一价
  });

  it('should close long position first when need to decrease net volume', () => {
    const context = createTestContext({
      actualAccountInfo: {
        ...createTestContext({}).actualAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'LONG', 0.05, 50000)],
      },
      expectedAccountInfo: {
        ...createTestContext({}).expectedAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'SHORT', 0.1, 50000)],
      },
    });

    const orders = makeStrategyBboMaker(context);

    expect(orders).toHaveLength(1);
    expect(orders[0].order_direction).toBe('CLOSE_LONG');
    expect(orders[0].volume).toBe(0.05); // 0.05
    expect(orders[0].order_type).toBe('MAKER');
    expect(orders[0].price).toBe(51000); // 卖一价
  });

  it('should place short open order when net volume needs to decrease and no long position', () => {
    const context = createTestContext({
      actualAccountInfo: {
        ...createTestContext({}).actualAccountInfo,
        positions: [], // 没有持仓
      },
      expectedAccountInfo: {
        ...createTestContext({}).expectedAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'SHORT', 0.1, 50000)],
      },
    });

    const orders = makeStrategyBboMaker(context);

    expect(orders).toHaveLength(1);
    expect(orders[0].order_direction).toBe('OPEN_SHORT');
    expect(orders[0].volume).toBe(0.1); // 0.1
    expect(orders[0].order_type).toBe('MAKER');
    expect(orders[0].price).toBe(50000); // 买一价
  });

  it('should return empty array when in expected range', () => {
    const context = createTestContext({
      actualAccountInfo: {
        ...createTestContext({}).actualAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'LONG', 0.2, 50000)],
      },
      expectedAccountInfo: {
        ...createTestContext({}).expectedAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'LONG', 0.2, 50000)],
      },
    });

    const orders = makeStrategyBboMaker(context);

    expect(orders).toHaveLength(0);
  });

  it('should respect max volume limit', () => {
    const context = createTestContext({
      actualAccountInfo: {
        ...createTestContext({}).actualAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'LONG', 0.1, 50000)],
      },
      expectedAccountInfo: {
        ...createTestContext({}).expectedAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'LONG', 2.0, 50000)], // 需要开仓 1.9
      },
      strategy: {
        type: 'BBO_MAKER',
        max_volume: 0.5, // 限制最大下单量为 0.5
      },
    });

    const orders = makeStrategyBboMaker(context);

    expect(orders).toHaveLength(1);
    expect(orders[0].volume).toBe(0.5); // 0.5
  });

  it('should handle mixed long and short positions correctly', () => {
    const context = createTestContext({
      actualAccountInfo: {
        ...createTestContext({}).actualAccountInfo,
        positions: [
          createTestPosition('BTC-USDT', 'LONG', 0.2, 50000),
          createTestPosition('BTC-USDT', 'SHORT', 0.1, 50000),
        ],
      },
      expectedAccountInfo: {
        ...createTestContext({}).expectedAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'LONG', 0.3, 50000)],
      },
    });

    const orders = makeStrategyBboMaker(context);

    expect(orders).toHaveLength(1);
    expect(orders[0].order_direction).toBe('CLOSE_SHORT');
    expect(orders[0].volume).toBe(0.1); // 先平空
    expect(orders[0].price).toBe(51000); // 卖一价
  });
});
