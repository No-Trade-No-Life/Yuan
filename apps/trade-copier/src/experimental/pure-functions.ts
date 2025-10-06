import { IPosition } from '@yuants/data-account';
import { IOrder } from '@yuants/data-order';
import { IProduct } from '@yuants/data-product';
import { roundToStep } from '@yuants/utils';

/**
 * 计算持仓量
 */
export interface PositionVolumes {
  longVolume: number;
  shortVolume: number;
  netVolume: number;
}

/**
 * 计算多空持仓量
 */
export function calculatePositionVolumes(positions: IPosition[], productId: string): PositionVolumes {
  const productPositions = positions.filter((p) => p.product_id === productId);

  const longVolume = productPositions.filter((p) => p.direction === 'LONG').reduce((a, b) => a + b.volume, 0);

  const shortVolume = productPositions
    .filter((p) => p.direction === 'SHORT')
    .reduce((a, b) => a + b.volume, 0);

  const netVolume = longVolume - shortVolume;

  return { longVolume, shortVolume, netVolume };
}

/**
 * 计算持仓边界
 */
export interface PositionBounds {
  lowerBound: number;
  upperBound: number;
  deltaVolume: number;
}

/**
 * 计算持仓边界和差异
 */
export function calculatePositionBounds(
  actualVolume: number,
  expectedVolume: number,
  volumeStep: number,
): PositionBounds {
  const lowerBound = roundToStep(expectedVolume, volumeStep, Math.floor);
  const upperBound = roundToStep(expectedVolume, volumeStep, Math.ceil);

  const deltaVolume =
    actualVolume < lowerBound
      ? lowerBound - actualVolume
      : actualVolume > upperBound
      ? upperBound - actualVolume
      : 0;

  return { lowerBound, upperBound, deltaVolume };
}

/**
 * 计算方向性持仓量
 */
export interface DirectionalPositionVolumes {
  volume: number;
  avgPositionPrice: number;
}

/**
 * 计算特定方向的持仓量和平均持仓价格
 */
export function calculateDirectionalPositionVolumes(
  positions: IPosition[],
  productId: string,
  direction: string,
): DirectionalPositionVolumes {
  const actualPositions = positions.filter((p) => p.product_id === productId && p.direction === direction);

  const volume = actualPositions.reduce((a, b) => a + b.volume, 0);
  const avgPositionPrice =
    volume === 0 ? 0 : actualPositions.reduce((a, b) => a + b.volume * b.position_price, 0) / volume;

  return { volume, avgPositionPrice };
}

/**
 * 计算订单总成交量
 */
export function calculateOrdersVolume(orders: IOrder[], productId: string): number {
  const productOrders = orders.filter((o) => o.product_id === productId);

  return productOrders.reduce(
    (a, b) =>
      a +
      b.volume *
        (({ OPEN_LONG: 1, CLOSE_LONG: -1, OPEN_SHORT: -1, CLOSE_SHORT: 1 } as const)[b.order_direction!] ||
          0),
    0,
  );
}

/**
 * 按价格排序订单（多头从低到高，空头从高到低）
 */
export function sortOrdersByPrice(orders: IOrder[], direction: string): IOrder[] {
  return direction === 'LONG'
    ? orders.sort((a, b) => a.price! - b.price!)
    : orders.sort((a, b) => b.price! - a.price!);
}

/**
 * 计算滑点保护价格
 */
export function calculateSlippageProtectedPrice(
  direction: string,
  bestPrice: number,
  actualVolume: number,
  actualAvgPositionPrice: number,
  expectedVolume: number,
  expectedAvgPositionPrice: number,
  deltaVolume: number,
  slippage: number,
): number {
  // 解方程: x * delta_volume + actualVolume * actualAvgPositionPrice === expectedVolume * expectedAvgPositionPrice * (1 + slippage)
  const x =
    (expectedVolume * expectedAvgPositionPrice * (1 + (direction === 'LONG' ? 1 : -1) * slippage) -
      actualVolume * actualAvgPositionPrice) /
    deltaVolume; // 挂单限价

  if (isNaN(x) || !isFinite(x)) {
    return bestPrice;
  }

  if (direction === 'LONG') {
    return Math.min(bestPrice, x);
  }

  if (direction === 'SHORT') {
    return Math.max(bestPrice, x);
  }

  return bestPrice;
}
