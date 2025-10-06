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

const createTestOrder = (product_id: string, order_direction: string, volume: number, price: number) => ({
  product_id,
  order_direction,
  volume,
  price,
  account_id: 'test-account',
  order_type: 'MAKER' as const,
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
  },
  pendingOrders: [],
  strategy: {
    type: 'BBO_MAKER_BY_DIRECTION',
    max_volume: 1000,
  },
  ...overrides,
});

describe('BBO_MAKER_BY_DIRECTION Strategy', () => {
  it('should place buy order when actual volume is below lower bound', () => {
    const context = createTestContext({
      actualAccountInfo: {
        ...createTestContext({}).actualAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'LONG', 100, 50000)],
      },
      expectedAccountInfo: {
        ...createTestContext({}).expectedAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'LONG', 200, 50000)],
      },
    });

    const actions = makeStrategyBboMakerByDirection(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('SubmitOrder');
    expect(actions[0].payload.order_direction).toBe('OPEN_LONG');
    expect(actions[0].payload.volume).toBe(100); // 200 - 100
  });

  it('should place sell order when actual volume is above upper bound', () => {
    const context = createTestContext({
      actualAccountInfo: {
        ...createTestContext({}).actualAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'LONG', 300, 50000)],
      },
      expectedAccountInfo: {
        ...createTestContext({}).expectedAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'LONG', 200, 50000)],
      },
    });

    const actions = makeStrategyBboMakerByDirection(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('SubmitOrder');
    expect(actions[0].payload.order_direction).toBe('CLOSE_LONG');
    expect(actions[0].payload.volume).toBe(100); // 300 - 200
  });

  it('should cancel all orders when in expected range', () => {
    const existingOrder = createTestOrder('BTC-USDT', 'OPEN_LONG', 50, 50000);

    const context = createTestContext({
      actualAccountInfo: {
        ...createTestContext({}).actualAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'LONG', 200, 50000)],
      },
      expectedAccountInfo: {
        ...createTestContext({}).expectedAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'LONG', 200, 50000)],
      },
      pendingOrders: [existingOrder],
    });

    const actions = makeStrategyBboMakerByDirection(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('CancelOrder');
    expect(actions[0].payload).toBe(existingOrder);
  });

  it('should cancel excess orders when too many pending orders', () => {
    const orders = [
      createTestOrder('BTC-USDT', 'OPEN_LONG', 50, 50000),
      createTestOrder('BTC-USDT', 'OPEN_LONG', 50, 51000),
    ];

    const context = createTestContext({
      actualAccountInfo: {
        ...createTestContext({}).actualAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'LONG', 100, 50000)],
      },
      expectedAccountInfo: {
        ...createTestContext({}).expectedAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'LONG', 200, 50000)],
      },
      pendingOrders: orders,
    });

    const actions = makeStrategyBboMakerByDirection(context);

    expect(actions).toHaveLength(2); // 应该撤销所有订单
    actions.forEach((action) => {
      expect(action.type).toBe('CancelOrder');
    });
  });

  it('should update order when parameters changed', () => {
    const existingOrder = createTestOrder('BTC-USDT', 'OPEN_LONG', 50, 50000);

    const context = createTestContext({
      actualAccountInfo: {
        ...createTestContext({}).actualAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'LONG', 100, 50000)],
      },
      expectedAccountInfo: {
        ...createTestContext({}).expectedAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'LONG', 200, 50000)],
      },
      pendingOrders: [existingOrder],
      quote: {
        ...createTestContext({}).quote,
        bid_price: '49000', // 价格变化
      },
    });

    const actions = makeStrategyBboMakerByDirection(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('CancelOrder');
  });

  it('should handle both LONG and SHORT directions', () => {
    const context = createTestContext({
      actualAccountInfo: {
        ...createTestContext({}).actualAccountInfo,
        positions: [
          createTestPosition('BTC-USDT', 'LONG', 100, 50000),
          createTestPosition('BTC-USDT', 'SHORT', 50, 52000),
        ],
      },
      expectedAccountInfo: {
        ...createTestContext({}).expectedAccountInfo,
        positions: [
          createTestPosition('BTC-USDT', 'LONG', 200, 50000),
          createTestPosition('BTC-USDT', 'SHORT', 100, 52000),
        ],
      },
    });

    const actions = makeStrategyBboMakerByDirection(context);

    // 应该为两个方向都生成动作
    expect(actions.length).toBeGreaterThan(0);

    const longActions = actions.filter(
      (a) => a.payload.order_direction === 'OPEN_LONG' || a.payload.order_direction === 'CLOSE_LONG',
    );
    const shortActions = actions.filter(
      (a) => a.payload.order_direction === 'OPEN_SHORT' || a.payload.order_direction === 'CLOSE_SHORT',
    );

    expect(longActions.length).toBeGreaterThan(0);
    expect(shortActions.length).toBeGreaterThan(0);
  });
});
