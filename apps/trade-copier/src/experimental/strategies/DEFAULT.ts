import { decodePath, roundToStep } from '@yuants/utils';
import { calculatePositionBounds, calculatePositionVolumes } from '../pure-functions';
import { strategyRegistry } from '../strategy-registry';
import { StrategyFunction } from '../types';

/**
 * DEFAULT 策略的纯函数版本
 * 基于净持仓量的简单市价策略
 */
export const makeStrategyDefault: StrategyFunction = (context) => {
  const { accountId, productKey, actualAccountInfo, expectedAccountInfo, product, strategy } = context;
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

  // 在预期范围内，不需要操作
  if (bounds.deltaVolume === 0) {
    return [];
  }

  let order_direction: string;
  let volume: number;

  if (bounds.deltaVolume > 0) {
    // 需要增加净持仓
    if (actualVolumes.shortVolume > 0) {
      // 先平空
      order_direction = 'CLOSE_SHORT';
      volume = Math.min(bounds.deltaVolume, actualVolumes.shortVolume);
    } else {
      // 开多
      order_direction = 'OPEN_LONG';
      volume = bounds.deltaVolume;
    }
  } else {
    // 需要减少净持仓
    if (actualVolumes.longVolume > 0) {
      // 先平多
      order_direction = 'CLOSE_LONG';
      volume = Math.min(-bounds.deltaVolume, actualVolumes.longVolume);
    } else {
      // 开空
      order_direction = 'OPEN_SHORT';
      volume = -bounds.deltaVolume;
    }
  }

  return [
    {
      order_type: 'MARKET',
      account_id: accountId,
      product_id: product_id,
      order_direction: order_direction,
      volume: roundToStep(Math.min(volume, strategy.max_volume ?? Infinity), product.volume_step),
    },
  ];
};

strategyRegistry.set('DEFAULT', makeStrategyDefault);
