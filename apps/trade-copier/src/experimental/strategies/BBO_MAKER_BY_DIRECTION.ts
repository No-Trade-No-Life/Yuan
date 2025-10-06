import { IOrder } from '@yuants/data-order';
import { decodePath, roundToStep } from '@yuants/utils';
import {
  calculateDirectionalPositionVolumes,
  calculatePositionBounds,
  calculateSlippageProtectedPrice,
} from '../pure-functions';
import { strategyRegistry } from '../strategy-registry';
import { StrategyContext, StrategyFunction } from '../types';

/**
 * BBO_MAKER_BY_DIRECTION 策略的纯函数版本
 */
export const makeStrategyBboMakerByDirection: StrategyFunction = (context: StrategyContext): IOrder[] => {
  // 分别处理多头和空头方向
  const longOrders = _makeDirectionalStrategy(context, 'LONG');
  const shortOrders = _makeDirectionalStrategy(context, 'SHORT');

  return [...longOrders, ...shortOrders];
};

strategyRegistry.set('BBO_MAKER_BY_DIRECTION', makeStrategyBboMakerByDirection);

/**
 * 处理单个方向的策略逻辑
 */
function _makeDirectionalStrategy(context: StrategyContext, direction: string): IOrder[] {
  const { accountId, productKey, actualAccountInfo, expectedAccountInfo, product, quote, strategy } = context;
  const [datasource_id, product_id] = decodePath(productKey);

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

  // 计算持仓边界
  const bounds = calculatePositionBounds(actualPosition.volume, expectedPosition.volume, product.volume_step);

  // 在预期范围内，不需要订单
  if (bounds.deltaVolume === 0) {
    return [];
  }

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

  return [
    {
      order_type: 'MAKER',
      account_id: accountId,
      product_id: product_id,
      order_direction: order_direction,
      price: roundToStep(price, product.price_step),
      volume: roundToStep(Math.min(volume, strategy.max_volume ?? Infinity), product.volume_step),
    },
  ];
}
