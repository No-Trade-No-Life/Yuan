import { IOrder } from '@yuants/data-order';
import { decodePath, roundToStep } from '@yuants/utils';
import {
  calculateDirectionalPositionVolumes,
  calculatePositionBounds,
  calculateSlippageProtectedPrice,
  sortOrdersByPrice,
} from '../pure-functions';
import { addStrategy } from '../strategy-registry';
import { StrategyContext, StrategyFunction } from '../types';

/**
 * MULTI_ORDER_MAKER_BY_DIRECTION 策略的纯函数版本
 * 同时维护 N 个订单来避免盘口晃骗
 */
export const makeStrategyMultiOrderMakerByDirection: StrategyFunction = (
  context: StrategyContext,
): IOrder[] => {
  // 分别处理多头和空头方向
  const longOrders = _makeDirectionalMultiOrderStrategy(context, 'LONG');
  const shortOrders = _makeDirectionalMultiOrderStrategy(context, 'SHORT');

  return [...longOrders, ...shortOrders];
};

/**
 * 处理单个方向的多订单策略逻辑
 */
function _makeDirectionalMultiOrderStrategy(context: StrategyContext, direction: string): IOrder[] {
  const {
    accountId,
    productKey,
    actualAccountInfo,
    expectedAccountInfo,
    product,
    quote,
    strategy,
    pendingOrders,
  } = context;
  const [datasource_id, product_id] = decodePath(productKey);

  // 计算实际和预期持仓
  const actualPosition = calculateDirectionalPositionVolumes(
    actualAccountInfo.positions || [],
    product_id,
    direction,
  );
  const expectedPosition = calculateDirectionalPositionVolumes(
    expectedAccountInfo.positions || [],
    product_id,
    direction,
  );

  // 计算持仓边界
  const bounds = calculatePositionBounds(actualPosition.volume, expectedPosition.volume, product.volume_step);

  // 情况1: 在预期范围内，不需要订单
  if (bounds.deltaVolume === 0) {
    return [];
  }

  // 获取当前方向的挂单
  const directionalPendingOrders = pendingOrders.filter((order) => {
    const isDirectionalOrder =
      (direction === 'LONG' &&
        (order.order_direction === 'OPEN_LONG' || order.order_direction === 'CLOSE_LONG')) ||
      (direction === 'SHORT' &&
        (order.order_direction === 'OPEN_SHORT' || order.order_direction === 'CLOSE_SHORT'));

    return (
      order.product_id === product_id && isDirectionalOrder && order.volume! - (order.traded_volume || 0) > 0
    );
  });

  // 获取策略参数
  const orderCount = Math.max(2, strategy.order_count || 3); // 默认 2 个订单，最少 2 个
  const maxVolume = strategy.max_volume ?? Infinity;

  // 按价格排序现有订单
  const sortedOrders = sortOrdersByPrice(directionalPendingOrders, direction);

  // 确定订单方向和目标成交量
  let order_direction: string;
  let targetVolume: number;
  let is_open: boolean;
  let is_buy: boolean;

  if (bounds.deltaVolume > 0) {
    // 开仓
    order_direction = direction === 'LONG' ? 'OPEN_LONG' : 'OPEN_SHORT';
    targetVolume = Math.min(bounds.deltaVolume, maxVolume);
    is_open = true;
    is_buy = direction === 'LONG';
  } else {
    // 平仓
    order_direction = direction === 'LONG' ? 'CLOSE_LONG' : 'CLOSE_SHORT';
    targetVolume = Math.min(-bounds.deltaVolume, actualPosition.volume, maxVolume);
    is_open = false;
    is_buy = direction === 'SHORT';
  }

  // 情况2: 订单数量超过 N 个，需要撤销最远的订单
  if (sortedOrders.length > orderCount) {
    // 只保留最接近盘口的 orderCount 个订单
    return sortedOrders.slice(0, orderCount);
  }

  const quotePrice = is_buy ? +quote.bid_price : +quote.ask_price;

  const worstPrice =
    typeof strategy.open_slippage === 'number'
      ? roundToStep(
          calculateSlippageProtectedPrice(
            direction,
            quotePrice,
            actualPosition.volume,
            actualPosition.avgPositionPrice,
            expectedPosition.volume,
            expectedPosition.avgPositionPrice,
            bounds.deltaVolume,
            strategy.open_slippage,
          ),
          product.price_step,
        )
      : null;

  // 撤销超过滑点保护价格的订单
  if (worstPrice !== null) {
    const filteredOrders = sortedOrders.filter((order) =>
      is_buy ? order.price! <= worstPrice : order.price! >= worstPrice,
    );
    if (filteredOrders.length < sortedOrders.length) {
      // 有订单被过滤掉，说明有需要撤销的订单
      return filteredOrders;
    }
  }

  let priceToSubmitOrder = quotePrice;
  if (is_open && worstPrice !== null) {
    // 开仓订单且设置了滑点保护，使用保护价格
    if (is_buy) {
      priceToSubmitOrder = Math.min(quotePrice, worstPrice);
    } else {
      priceToSubmitOrder = Math.max(quotePrice, worstPrice);
    }
  }

  // 情况3: 订单数量正好为 N 个，但价格不在应该挂单的位置，需要撤销最远的一个订单
  if (sortedOrders.length === orderCount) {
    const farthestOrder = sortedOrders[orderCount - 1]; // 最远的订单

    // 检查最远订单是否在应该挂单的位置
    if (farthestOrder.price !== priceToSubmitOrder) {
      // 撤销最远的一个订单，返回 N-1 个订单
      return sortedOrders.slice(0, orderCount - 1);
    }

    // 如果没有下够单，撤销最远的订单重新下单
    const totalVolume = sortedOrders.reduce(
      (sum: number, order: IOrder) => sum + (order.volume! - (order.traded_volume || 0)),
      0,
    );
    if (totalVolume < targetVolume) {
      return sortedOrders.slice(0, orderCount - 1);
    }

    return sortedOrders; // 价格正确，直接返回现有订单
  }

  // 情况5: 订单数量不足 N 个，需要补充新订单
  const currentOrderCount = sortedOrders.length;
  const ordersToCreate = Math.max(0, orderCount - currentOrderCount);

  // 计算现有订单的剩余成交量
  const maintainedVolume = sortedOrders.reduce(
    (sum, order) => sum + (order.volume! - (order.traded_volume || 0)),
    0,
  );

  // 计算需要补充的成交量
  const volumeToCreate = Math.max(0, targetVolume - maintainedVolume);

  // 如果没有需要补充的成交量，直接返回现有订单
  if (volumeToCreate <= 0) {
    return sortedOrders;
  }

  // 创建新订单
  const newOrders: IOrder[] = [];

  if (ordersToCreate > 0 && volumeToCreate > 0) {
    // 均分需要补充的成交量
    const volumePerOrder = roundToStep(volumeToCreate / ordersToCreate, product.volume_step, Math.floor);

    for (let i = 0; i < ordersToCreate; i++) {
      const volume =
        i === ordersToCreate - 1
          ? roundToStep(volumeToCreate - volumePerOrder * (ordersToCreate - 1), product.volume_step) // 最后一个订单，补齐剩余量
          : volumePerOrder;

      if (volume <= 0) continue;

      newOrders.push({
        order_type: 'MAKER',
        account_id: accountId,
        product_id: product_id,
        order_direction: order_direction,
        price: priceToSubmitOrder,
        volume: volume,
      });
    }
  }

  // 返回现有订单和新创建的订单
  return [...sortedOrders, ...newOrders];
}

addStrategy('MULTI_ORDER_MAKER_BY_DIRECTION', makeStrategyMultiOrderMakerByDirection, {
  type: 'object',
  properties: {
    order_count: {
      type: 'number',
      minimum: 2,
      description: '同时维护的订单数量，N >= 2',
    },
    max_volume: {
      type: 'number',
      minimum: 0,
      description: '单次下单的最大数量，单位为合约数量',
    },
    open_slippage: {
      type: 'number',
      minimum: 0,
      description: '开仓时允许的最大滑点，单位为价格（币种）',
    },
  },
  required: ['order_count'],
});
