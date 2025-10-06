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

const createTestOrder = (product_id: string, order_direction: string, volume: number, price: number) => ({
  order_id: `${product_id}-${order_direction}-${Date.now()}`,
  account_id: 'test-account',
  product_id,
  order_direction,
  order_type: 'MAKER',
  volume,
  price,
  filled_volume: 0,
  status: 'pending',
  submitted_at: Date.now(),
  updated_at: new Date().toISOString(),
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
    type: 'BBO_MAKER',
    max_volume: 1000,
  },
  ...overrides,
});

describe('BBO_MAKER Strategy', () => {
  it('should place buy order when actual volume is below lower bound', () => {
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

    const actions = makeStrategyBboMaker(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('SubmitOrder');
    expect(actions[0].payload.order_direction).toBe('OPEN_LONG');
    expect(actions[0].payload.volume).toBe(0.1); // 0.2 - 0.1 = 0.1
    expect(actions[0].payload.price).toBe(50000); // 开多用买一价
    expect(actions[0].payload.order_type).toBe('MAKER');
  });

  it('should place sell order when actual volume is above upper bound', () => {
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

    const actions = makeStrategyBboMaker(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('SubmitOrder');
    expect(actions[0].payload.order_direction).toBe('CLOSE_LONG');
    expect(actions[0].payload.volume).toBe(0.1); // 0.3 - 0.2 = 0.1
    expect(actions[0].payload.price).toBe(51000); // 平多用卖一价
    expect(actions[0].payload.order_type).toBe('MAKER');
  });

  it('should cancel all orders when more than one pending order exists', () => {
    const context = createTestContext({
      actualAccountInfo: {
        ...createTestContext({}).actualAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'LONG', 0.1, 50000)],
      },
      expectedAccountInfo: {
        ...createTestContext({}).expectedAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'LONG', 0.2, 50000)],
      },
      pendingOrders: [
        createTestOrder('BTC-USDT', 'OPEN_LONG', 0.05, 50000),
        createTestOrder('BTC-USDT', 'OPEN_LONG', 0.05, 50000),
      ],
    });

    const actions = makeStrategyBboMaker(context);

    expect(actions).toHaveLength(2);
    expect(actions[0].type).toBe('CancelOrder');
    expect(actions[1].type).toBe('CancelOrder');
  });

  it('should cancel order when in expected range', () => {
    const context = createTestContext({
      actualAccountInfo: {
        ...createTestContext({}).actualAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'LONG', 0.2, 50000)],
      },
      expectedAccountInfo: {
        ...createTestContext({}).expectedAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'LONG', 0.2, 50000)],
      },
      pendingOrders: [createTestOrder('BTC-USDT', 'OPEN_LONG', 0.1, 50000)],
    });

    const actions = makeStrategyBboMaker(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('CancelOrder');
  });

  it('should update order when parameters changed', () => {
    const existingOrder = createTestOrder('BTC-USDT', 'OPEN_LONG', 0.05, 50000);
    const context = createTestContext({
      actualAccountInfo: {
        ...createTestContext({}).actualAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'LONG', 0.1, 50000)],
      },
      expectedAccountInfo: {
        ...createTestContext({}).expectedAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'LONG', 0.2, 50000)],
      },
      pendingOrders: [existingOrder],
    });

    const actions = makeStrategyBboMaker(context);

    expect(actions).toHaveLength(2);
    expect(actions[0].type).toBe('CancelOrder');
    expect(actions[0].payload).toBe(existingOrder);
    expect(actions[1].type).toBe('SubmitOrder');
    expect(actions[1].payload.order_direction).toBe('OPEN_LONG');
    expect(actions[1].payload.volume).toBe(0.1); // 新的下单量
  });

  it('should not update order when parameters unchanged', () => {
    const existingOrder = createTestOrder('BTC-USDT', 'OPEN_LONG', 0.1, 50000);
    const context = createTestContext({
      actualAccountInfo: {
        ...createTestContext({}).actualAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'LONG', 0.1, 50000)],
      },
      expectedAccountInfo: {
        ...createTestContext({}).expectedAccountInfo,
        positions: [createTestPosition('BTC-USDT', 'LONG', 0.2, 50000)],
      },
      pendingOrders: [existingOrder],
    });

    const actions = makeStrategyBboMaker(context);

    expect(actions).toHaveLength(0); // 订单参数正确，不需要更新
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

    const actions = makeStrategyBboMaker(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('SubmitOrder');
    expect(actions[0].payload.order_direction).toBe('CLOSE_SHORT');
    expect(actions[0].payload.volume).toBe(0.05); // 0.05
    expect(actions[0].payload.price).toBe(51000); // 平空用卖一价
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

    const actions = makeStrategyBboMaker(context);

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe('SubmitOrder');
    expect(actions[0].payload.order_direction).toBe('CLOSE_LONG');
    expect(actions[0].payload.volume).toBe(0.05); // 0.05
    expect(actions[0].payload.price).toBe(51000); // 平多用卖一价
  });
});
