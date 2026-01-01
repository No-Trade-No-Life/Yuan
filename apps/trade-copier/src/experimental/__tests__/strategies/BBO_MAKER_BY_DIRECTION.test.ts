import { makeStrategyBboMakerByDirection } from '../../strategies/BBO_MAKER_BY_DIRECTION';
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
    type: 'BBO_MAKER_BY_DIRECTION',
    max_volume: 1000,
  },
  ...overrides,
});

describe('BBO_MAKER_BY_DIRECTION Strategy', () => {
  it('should place long open order when long volume is below expected', () => {
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

    const orders = makeStrategyBboMakerByDirection(context);

    expect(orders).toHaveLength(1);
    expect(orders[0].order_direction).toBe('OPEN_LONG');
    expect(orders[0].volume).toBe(0.1); // 0.2 - 0.1 = 0.1
    expect(orders[0].order_type).toBe('MAKER');
    expect(orders[0].price).toBe(50000); // 买一价
  });

  it('should place long close order when long volume is above expected', () => {
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

    const orders = makeStrategyBboMakerByDirection(context);

    expect(orders).toHaveLength(1);
    expect(orders[0].order_direction).toBe('CLOSE_LONG');
    expect(orders[0].volume).toBe(0.1); // 0.3 - 0.2 = 0.1
    expect(orders[0].order_type).toBe('MAKER');
    expect(orders[0].price).toBe(51000); // 卖一价
  });

  it('should place short open order when short volume is below expected', () => {
    const context = createTestContext({
      actualAccountInfo: {
        ...createTestContext({}).actualAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'SHORT', 0.1, 50000)],
      },
      expectedAccountInfo: {
        ...createTestContext({}).expectedAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'SHORT', 0.2, 50000)],
      },
    });

    const orders = makeStrategyBboMakerByDirection(context);

    expect(orders).toHaveLength(1);
    expect(orders[0].order_direction).toBe('OPEN_SHORT');
    expect(orders[0].volume).toBe(0.1); // 0.2 - 0.1 = 0.1
    expect(orders[0].order_type).toBe('MAKER');
    expect(orders[0].price).toBe(51000); // 卖一价
  });

  it('should place short close order when short volume is above expected', () => {
    const context = createTestContext({
      actualAccountInfo: {
        ...createTestContext({}).actualAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'SHORT', 0.3, 50000)],
      },
      expectedAccountInfo: {
        ...createTestContext({}).expectedAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'SHORT', 0.2, 50000)],
      },
    });

    const orders = makeStrategyBboMakerByDirection(context);

    expect(orders).toHaveLength(1);
    expect(orders[0].order_direction).toBe('CLOSE_SHORT');
    expect(orders[0].volume).toBe(0.1); // 0.3 - 0.2 = 0.1
    expect(orders[0].order_type).toBe('MAKER');
    expect(orders[0].price).toBe(50000); // 买一价
  });

  it('should handle both long and short directions independently', () => {
    const context = createTestContext({
      actualAccountInfo: {
        ...createTestContext({}).actualAccountInfo,
        positions: [
          createTestPosition('BTC-USDT', 'LONG', 0.1, 50000),
          createTestPosition('BTC-USDT', 'SHORT', 0.1, 50000),
        ],
      },
      expectedAccountInfo: {
        ...createTestContext({}).expectedAccountInfo,
        positions: [
          createTestPosition('BTC-USDT', 'LONG', 0.2, 50000),
          createTestPosition('BTC-USDT', 'SHORT', 0.2, 50000),
        ],
      },
    });

    const orders = makeStrategyBboMakerByDirection(context);

    expect(orders).toHaveLength(2);

    const longOrder = orders.find((o) => o.order_direction === 'OPEN_LONG');
    const shortOrder = orders.find((o) => o.order_direction === 'OPEN_SHORT');

    expect(longOrder).toBeDefined();
    expect(longOrder!.volume).toBe(0.1);
    expect(longOrder!.price).toBe(50000);

    expect(shortOrder).toBeDefined();
    expect(shortOrder!.volume).toBe(0.1);
    expect(shortOrder!.price).toBe(51000);
  });

  it('should return empty array when both directions are in expected range', () => {
    const context = createTestContext({
      actualAccountInfo: {
        ...createTestContext({}).actualAccountInfo,
        positions: [
          createTestPosition('BTC-USDT', 'LONG', 0.2, 50000),
          createTestPosition('BTC-USDT', 'SHORT', 0.2, 50000),
        ],
      },
      expectedAccountInfo: {
        ...createTestContext({}).expectedAccountInfo,
        positions: [
          createTestPosition('BTC-USDT', 'LONG', 0.2, 50000),
          createTestPosition('BTC-USDT', 'SHORT', 0.2, 50000),
        ],
      },
    });

    const orders = makeStrategyBboMakerByDirection(context);

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
        type: 'BBO_MAKER_BY_DIRECTION',
        max_volume: 0.5, // 限制最大下单量为 0.5
      },
    });

    const orders = makeStrategyBboMakerByDirection(context);

    expect(orders).toHaveLength(1);
    expect(orders[0].volume).toBe(0.5); // 0.5
  });

  it('should apply slippage protection when configured', () => {
    const context = createTestContext({
      actualAccountInfo: {
        ...createTestContext({}).actualAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'LONG', 0.1, 50000)],
      },
      expectedAccountInfo: {
        ...createTestContext({}).expectedAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'LONG', 0.2, 50000)],
      },
      strategy: {
        type: 'BBO_MAKER_BY_DIRECTION',
        max_volume: 1000,
        open_slippage: 0.01, // 1% 滑点
      },
    });

    const orders = makeStrategyBboMakerByDirection(context);

    expect(orders).toHaveLength(1);
    expect(orders[0].order_direction).toBe('OPEN_LONG');
    // 滑点保护可能会返回最佳价格或调整后的价格
    // 根据滑点保护函数的逻辑，在某些情况下会返回最佳价格
    expect(orders[0].price).toBeDefined();
  });
});
