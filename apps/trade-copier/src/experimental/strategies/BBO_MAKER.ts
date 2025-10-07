import { IOrder } from '@yuants/data-order';
import { decodePath, roundToStep } from '@yuants/utils';
import { calculatePositionBounds, calculatePositionVolumes } from '../pure-functions';
import { addStrategy } from '../strategy-registry';
import { StrategyContext, StrategyFunction } from '../types';

/**
 * BBO_MAKER 策略的纯函数版本
 * 基于净持仓量的挂单策略，使用 BBO 价格
 */
export const makeStrategyBboMaker: StrategyFunction = (context: StrategyContext): IOrder[] => {
  const { accountId, productKey, actualAccountInfo, expectedAccountInfo, product, quote, strategy } = context;
  const [datasource_id, product_id] = decodePath(productKey);

  // 计算实际和预期净持仓量
  const actualVolumes = calculatePositionVolumes(actualAccountInfo.positions, product_id);
  const expectedVolumes = calculatePositionVolumes(expectedAccountInfo.positions, product_id);

  // 计算持仓边界
  const bounds = calculatePositionBounds(
    actualVolumes.netVolume,
    expectedVolumes.netVolume,
    product.volume_step,
  );

  // 在预期范围内，不需要订单
  if (bounds.deltaVolume === 0) {
    return [];
  }

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
};

addStrategy('BBO_MAKER', makeStrategyBboMaker, {
  type: 'object',
  properties: {
    max_volume: { type: 'number', minimum: 0, description: '单次下单的最大数量，单位为合约数量' },
  },
});
