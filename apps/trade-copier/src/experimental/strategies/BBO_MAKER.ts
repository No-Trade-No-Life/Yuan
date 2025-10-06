import { IOrder } from '@yuants/data-order';
import { roundToStep } from '@yuants/utils';
import { StrategyContext, StrategyAction, StrategyFunction } from '../types';
import { calculatePositionVolumes, calculatePositionBounds, calculateOrdersVolume } from '../pure-functions';
import { strategyRegistry } from '../strategy-registry';

/**
 * BBO_MAKER 策略的纯函数版本
 * 基于净持仓量的挂单策略，使用 BBO 价格
 */
export const makeStrategyBboMaker: StrategyFunction = (context: StrategyContext): StrategyAction[] => {
  const {
    accountId,
    productKey,
    actualAccountInfo,
    expectedAccountInfo,
    product,
    quote,
    pendingOrders,
    strategy,
  } = context;
  const [datasource_id, product_id] = productKey.split('/');

  const actions: StrategyAction[] = [];

  // 计算实际和预期净持仓量
  const actualVolumes = calculatePositionVolumes(actualAccountInfo.positions, product_id);
  const expectedVolumes = calculatePositionVolumes(expectedAccountInfo.positions, product_id);

  // 计算持仓边界
  const bounds = calculatePositionBounds(
    actualVolumes.netVolume,
    expectedVolumes.netVolume,
    product.volume_step,
  );

  // 过滤该产品的挂单
  const productOrders = pendingOrders.filter((o) => o.product_id === product_id);

  // 1. 检查是否需要撤单的情况

  // 1.1 订单过多，直接全部撤单
  if (productOrders.length > 1) {
    return productOrders.map((order) => ({
      type: 'CancelOrder' as const,
      payload: order,
    }));
  }

  // 1.2 在预期范围内，撤单
  const isInExpectedRange =
    bounds.lowerBound <= actualVolumes.netVolume && actualVolumes.netVolume <= bounds.upperBound;
  if (isInExpectedRange) {
    return productOrders.map((order) => ({
      type: 'CancelOrder' as const,
      payload: order,
    }));
  }

  // 计算订单总成交量
  const ordersVolume = calculateOrdersVolume(productOrders, product_id);

  // 1.3 订单数量超过需求，撤销多余的订单
  // 注意：当 deltaVolume 为负数时，ordersVolume 也应该为负数（平仓订单）
  // 所以比较的是绝对值
  if (Math.abs(ordersVolume) > Math.abs(bounds.deltaVolume)) {
    // 撤销所有订单
    return productOrders.map((order) => ({
      type: 'CancelOrder' as const,
      payload: order,
    }));
  }

  // 2. 下单逻辑

  let order_direction: string;
  let volume: number;
  let price: number;

  if (bounds.deltaVolume > 0) {
    // 需要增加净持仓
    if (actualVolumes.shortVolume > 0) {
      // 先平空
      order_direction = 'CLOSE_SHORT';
      volume = Math.min(bounds.deltaVolume, actualVolumes.shortVolume);
      price = +quote.ask_price; // 平空用卖一价
    } else {
      // 开多
      order_direction = 'OPEN_LONG';
      volume = bounds.deltaVolume;
      price = +quote.bid_price; // 开多用买一价
    }
  } else {
    // 需要减少净持仓
    if (actualVolumes.longVolume > 0) {
      // 先平多
      order_direction = 'CLOSE_LONG';
      volume = Math.min(-bounds.deltaVolume, actualVolumes.longVolume);
      price = +quote.ask_price; // 平多用卖一价
    } else {
      // 开空
      order_direction = 'OPEN_SHORT';
      volume = -bounds.deltaVolume;
      price = +quote.bid_price; // 开空用买一价
    }
  }

  const order: IOrder = {
    order_type: 'MAKER',
    account_id: accountId,
    product_id: product_id,
    order_direction: order_direction,
    price: roundToStep(price, product.price_step),
    volume: roundToStep(Math.min(volume, strategy.max_volume ?? Infinity), product.volume_step),
  };

  // 3. 检查是否需要更新现有订单
  const existingOrder = productOrders[0];
  if (existingOrder) {
    if (
      order.volume !== existingOrder.volume ||
      order.price !== existingOrder.price ||
      order.order_direction !== existingOrder.order_direction
    ) {
      // 先撤单，然后下单
      actions.push({
        type: 'CancelOrder',
        payload: existingOrder,
      });
      actions.push({
        type: 'SubmitOrder',
        payload: order,
      });
      return actions;
    }
    // 订单已存在且参数正确，不需要操作
    return [];
  }

  // 4. 没有现有订单，直接下单
  actions.push({
    type: 'SubmitOrder',
    payload: order,
  });

  return actions;
};

strategyRegistry.set('BBO_MAKER', makeStrategyBboMaker);
