import { IOrder } from '@yuants/data-order';
import { formatTime, roundToStep } from '@yuants/utils';
import {
  calculateDirectionalPositionVolumes,
  calculateOrdersVolume,
  calculatePositionBounds,
  calculateSlippageProtectedPrice,
  sortOrdersByPrice,
} from '../pure-functions';
import { strategyRegistry } from '../strategy-registry';
import { StrategyAction, StrategyContext, StrategyFunction } from '../types';

/**
 * BBO_MAKER_BY_DIRECTION 策略的纯函数版本
 */
export const makeStrategyBboMakerByDirection: StrategyFunction = (
  context: StrategyContext,
): StrategyAction[] => {
  // 分别处理多头和空头方向
  const longActions = _makeDirectionalStrategy(context, 'LONG');
  const shortActions = _makeDirectionalStrategy(context, 'SHORT');

  return [...longActions, ...shortActions];
};

strategyRegistry.set('BBO_MAKER_BY_DIRECTION', makeStrategyBboMakerByDirection);

/**
 * 处理单个方向的策略逻辑
 */
function _makeDirectionalStrategy(context: StrategyContext, direction: string): StrategyAction[] {
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

  // 计算实际和预期持仓
  const actualPosition = calculateDirectionalPositionVolumes(
    actualAccountInfo.positions,
    product_id,
    direction,
  );
  const expectedPosition = calculateDirectionalPositionVolumes(
    expectedAccountInfo.positions,
    product_id,
    direction,
  );

  // 过滤该方向的挂单
  const directionOrders = pendingOrders.filter(
    (o) =>
      o.product_id === product_id &&
      { OPEN_LONG: 'LONG', CLOSE_LONG: 'LONG', OPEN_SHORT: 'SHORT', CLOSE_SHORT: 'SHORT' }[
        o.order_direction!
      ] === direction,
  );

  // 计算持仓边界
  const bounds = calculatePositionBounds(actualPosition.volume, expectedPosition.volume, product.volume_step);

  // 1. 检查是否需要撤单的情况

  // 1.1 订单过多，直接全部撤单
  if (directionOrders.length > 1) {
    return directionOrders.map((order) => ({
      type: 'CancelOrder' as const,
      payload: order,
    }));
  }

  // 1.2 在预期范围内，撤单
  if (bounds.deltaVolume === 0) {
    return directionOrders.map((order) => ({
      type: 'CancelOrder' as const,
      payload: order,
    }));
  }

  // 2. 下单逻辑

  let order_direction: string;
  let volume: number;
  let price: number;

  if (bounds.deltaVolume > 0) {
    // 开仓
    price = direction === 'LONG' ? +quote.bid_price : +quote.ask_price;
    order_direction = direction === 'LONG' ? 'OPEN_LONG' : 'OPEN_SHORT';
    volume = bounds.deltaVolume;

    // 滑点保护
    if (typeof strategy.open_slippage === 'number') {
      price = calculateSlippageProtectedPrice(
        direction,
        price,
        actualPosition.volume,
        actualPosition.avgPositionPrice,
        expectedPosition.volume,
        expectedPosition.avgPositionPrice,
        bounds.deltaVolume,
        strategy.open_slippage,
      );
    }
  } else {
    // 平仓
    price = direction === 'LONG' ? +quote.ask_price : +quote.bid_price;
    order_direction = direction === 'LONG' ? 'CLOSE_LONG' : 'CLOSE_SHORT';
    volume = Math.min(-bounds.deltaVolume, actualPosition.volume);
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
  const existingOrder = directionOrders[0];
  if (existingOrder) {
    if (
      order.volume !== existingOrder.volume ||
      order.price !== existingOrder.price ||
      order.order_direction !== existingOrder.order_direction
    ) {
      // 订单参数不一致，撤销现有订单
      return [
        {
          type: 'CancelOrder',
          payload: existingOrder,
        },
      ];
    }
    // 订单已存在且参数正确，不需要操作
    return [];
  }

  // 4. 没有现有订单，直接下单
  return [
    {
      type: 'SubmitOrder',
      payload: order,
    },
  ];
}
