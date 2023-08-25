import { OrderDirection, PositionVariant } from '../model';

const MAP_ORDER_DIRECTION_TO_NET_POSITION_COEF = {
  [OrderDirection.OPEN_LONG]: 1,
  [OrderDirection.CLOSE_LONG]: -1,
  [OrderDirection.OPEN_SHORT]: -1,
  [OrderDirection.CLOSE_SHORT]: 1,
};

/**
 * Map order direction to net position coefficient
 *
 * @param direction - Order direction
 * @returns 1 | -1
 *
 * @public
 */
export function mapOrderDirectionToNetPositionCoef(direction: OrderDirection): number {
  return MAP_ORDER_DIRECTION_TO_NET_POSITION_COEF[direction];
}

const MAP_POSITION_VARIANT_TO_NET_POSITION_COEF = {
  [PositionVariant.LONG]: 1,
  [PositionVariant.SHORT]: -1,
};

/**
 * Map position variant to net position coefficient
 * @public
 */
export function mapPositionVariantToNetPositionCoef(variant: PositionVariant): number {
  return MAP_POSITION_VARIANT_TO_NET_POSITION_COEF[variant];
}

export * from './account-info';
