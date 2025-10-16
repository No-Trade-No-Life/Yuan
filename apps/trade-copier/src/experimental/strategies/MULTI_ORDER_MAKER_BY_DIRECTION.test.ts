import { IOrder } from '@yuants/data-order';
import { makeStrategyMultiOrderMakerByDirection } from './MULTI_ORDER_MAKER_BY_DIRECTION';
import { StrategyContext } from '../types';

describe('MULTI_ORDER_MAKER_BY_DIRECTION', () => {
  const createMockContext = (overrides: Partial<StrategyContext>): StrategyContext => {
    return {
      accountId: 'test-account',
      productKey: 'datasource/product',
      product: {
        product_id: 'product',
        datasource_id: 'datasource',
        price_step: 0.01,
        volume_step: 0.001,
        name: 'Test Product',
        quote_currency: 'USD',
        base_currency: 'BTC',
        value_scale: 1,
        margin_rate: 0,
        price_min: 0,
        price_max: 100000,
        volume_min: 0.001,
        volume_max: 1000,
        value_scale_unit: 1,
        value_based_cost: 0,
        volume_based_cost: 0,
        max_position: 1000,
        allow_long: true,
        allow_short: true,
      } as any,
      quote: {
        ask_price: '100',
        bid_price: '99',
      } as any,
      strategy: {
        type: 'MULTI_ORDER_MAKER_BY_DIRECTION',
        order_count: 3,
      } as any,
      actualAccountInfo: {
        positions: [],
        orders: [],
      } as any,
      expectedAccountInfo: {
        positions: [],
        orders: [],
      } as any,
      pendingOrders: [],
      ...overrides,
    } as StrategyContext;
  };

  describe('基础订单管理场景', () => {
    it('场景1: 没有挂单，需要创建 N 个新订单', () => {
      const context = createMockContext({
        expectedAccountInfo: {
          positions: [{ product_id: 'product', direction: 'LONG', volume: 1, position_price: 100 }],
        } as any,
      });

      const orders = makeStrategyMultiOrderMakerByDirection(context);

      expect(orders).toHaveLength(3);
      expect(orders.every((order: IOrder) => order.order_direction === 'OPEN_LONG')).toBe(true);
      expect(orders.reduce((sum: number, order: IOrder) => sum + order.volume!, 0)).toBeCloseTo(1);
    });

    it('场景2: 已有部分挂单，需要补充到 N 个', () => {
      const existingOrders: IOrder[] = [
        {
          order_id: 'order1',
          account_id: 'test-account',
          product_id: 'product',
          order_direction: 'OPEN_LONG',
          price: 99.5,
          volume: 0.5,
          traded_volume: 0,
        },
      ];

      const context = createMockContext({
        actualAccountInfo: {
          orders: existingOrders,
        } as any,
        expectedAccountInfo: {
          positions: [{ product_id: 'product', direction: 'LONG', volume: 1, position_price: 100 }],
        } as any,
        pendingOrders: existingOrders,
      });

      const orders = makeStrategyMultiOrderMakerByDirection(context);

      // 应该保留现有订单并补充新订单
      expect(orders).toHaveLength(3);
      expect(orders.some((order: IOrder) => order.order_id === 'order1')).toBe(true);
    });

    it('场景3: 挂单超过 N 个，需要撤销最远订单', () => {
      const existingOrders: IOrder[] = [
        {
          order_id: 'order1',
          account_id: 'test-account',
          product_id: 'product',
          order_direction: 'OPEN_LONG',
          price: 99.5,
          volume: 0.25,
          traded_volume: 0,
        },
        {
          order_id: 'order2',
          account_id: 'test-account',
          product_id: 'product',
          order_direction: 'OPEN_LONG',
          price: 99.3,
          volume: 0.25,
          traded_volume: 0,
        },
        {
          order_id: 'order3',
          account_id: 'test-account',
          product_id: 'product',
          order_direction: 'OPEN_LONG',
          price: 99.1,
          volume: 0.25,
          traded_volume: 0,
        },
        {
          order_id: 'order4',
          account_id: 'test-account',
          product_id: 'product',
          order_direction: 'OPEN_LONG',
          price: 98.9,
          volume: 0.25,
          traded_volume: 0,
        },
      ];

      const context = createMockContext({
        actualAccountInfo: {
          orders: existingOrders,
        } as any,
        expectedAccountInfo: {
          positions: [{ product_id: 'product', direction: 'LONG', volume: 1, position_price: 100 }],
        } as any,
        pendingOrders: existingOrders,
      });

      const orders = makeStrategyMultiOrderMakerByDirection(context);

      // 应该只保留最接近盘口的 3 个订单
      expect(orders).toHaveLength(3);
      expect(orders.some((order: IOrder) => order.order_id === 'order4')).toBe(false); // 最远的订单被撤销
    });
  });

  describe('部分成交场景', () => {
    it('场景5: 部分订单已完全成交，剩余订单数量不足', () => {
      const existingOrders: IOrder[] = [
        {
          order_id: 'order1',
          account_id: 'test-account',
          product_id: 'product',
          order_direction: 'OPEN_LONG',
          price: 99.5,
          volume: 0.5,
          traded_volume: 0.5,
        }, // 完全成交
        {
          order_id: 'order2',
          account_id: 'test-account',
          product_id: 'product',
          order_direction: 'OPEN_LONG',
          price: 99.3,
          volume: 0.5,
          traded_volume: 0,
        }, // 未成交
      ];

      const context = createMockContext({
        actualAccountInfo: {
          positions: [{ product_id: 'product', direction: 'LONG', volume: 0.5, position_price: 99.5 }],
          orders: existingOrders,
        } as any,
        expectedAccountInfo: {
          positions: [{ product_id: 'product', direction: 'LONG', volume: 2, position_price: 100 }],
        } as any,
        pendingOrders: existingOrders.filter((order) => order.volume! - order.traded_volume! > 0),
      });

      const orders = makeStrategyMultiOrderMakerByDirection(context);

      // 应该补充新订单到 3 个
      expect(orders).toHaveLength(3);
    });

    it('场景6: 部分订单部分成交，剩余量需要重新计算', () => {
      const existingOrders: IOrder[] = [
        {
          order_id: 'order1',
          account_id: 'test-account',
          product_id: 'product',
          order_direction: 'OPEN_LONG',
          price: 99,
          volume: 0.5,
          traded_volume: 0.2,
        }, // 部分成交
        {
          order_id: 'order2',
          account_id: 'test-account',
          product_id: 'product',
          order_direction: 'OPEN_LONG',
          price: 99,
          volume: 0.5,
          traded_volume: 0,
        }, // 未成交
      ];

      const context = createMockContext({
        actualAccountInfo: {
          positions: [{ product_id: 'product', direction: 'LONG', volume: 0.2, position_price: 99 }],
          orders: existingOrders,
        } as any,
        expectedAccountInfo: {
          positions: [{ product_id: 'product', direction: 'LONG', volume: 1, position_price: 100 }],
        } as any,
        pendingOrders: existingOrders.filter((order) => order.volume! - order.traded_volume! > 0),
      });

      const orders = makeStrategyMultiOrderMakerByDirection(context);

      // 应该重新分配剩余量
      const totalVolume = orders.reduce(
        (sum: number, order: IOrder) => sum + (order.volume! - (order.traded_volume || 0)),
        0,
      );
      expect(totalVolume).toBeCloseTo(0.8); // 1 - 0.2 = 0.8
    });
  });

  describe('方向分离场景', () => {
    it('场景19: LONG 方向需要订单，SHORT 方向不需要', () => {
      const context = createMockContext({
        expectedAccountInfo: {
          positions: [{ product_id: 'product', direction: 'LONG', volume: 1, position_price: 100 }],
        } as any,
      });

      const orders = makeStrategyMultiOrderMakerByDirection(context);

      // 应该只有 LONG 方向的订单
      expect(orders.every((order: IOrder) => order.order_direction === 'OPEN_LONG')).toBe(true);
      expect(orders).toHaveLength(3);
    });

    it('场景20: SHORT 方向需要订单，LONG 方向不需要', () => {
      const context = createMockContext({
        expectedAccountInfo: {
          positions: [{ product_id: 'product', direction: 'SHORT', volume: 1, position_price: 100 }],
        } as any,
      });

      const orders = makeStrategyMultiOrderMakerByDirection(context);

      // 应该只有 SHORT 方向的订单
      expect(orders.every((order: IOrder) => order.order_direction === 'OPEN_SHORT')).toBe(true);
      expect(orders).toHaveLength(3);
    });
  });

  describe('边界条件场景', () => {
    it('场景15: N=2 的最小情况', () => {
      const context = createMockContext({
        strategy: {
          type: 'MULTI_ORDER_MAKER_BY_DIRECTION',
          order_count: 2,
        } as any,
        expectedAccountInfo: {
          positions: [{ product_id: 'product', direction: 'LONG', volume: 1, position_price: 100 }],
        } as any,
      });

      const orders = makeStrategyMultiOrderMakerByDirection(context);

      expect(orders).toHaveLength(2);
    });

    it('场景17: 订单量非常小，需要四舍五入处理', () => {
      const context = createMockContext({
        expectedAccountInfo: {
          positions: [{ product_id: 'product', direction: 'LONG', volume: 0.001, position_price: 100 }],
        } as any,
      });

      const orders = makeStrategyMultiOrderMakerByDirection(context);

      // 每个订单的量应该是最小交易单位的整数倍
      orders.forEach((order: IOrder) => {
        expect(order.volume! % 0.001).toBe(0);
      });
    });
  });
});
