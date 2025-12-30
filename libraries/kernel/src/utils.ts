import { IPosition } from '@yuants/data-account';
import { IProduct } from '@yuants/data-product';

/**
 * 计算盈亏
 * @public
 * @param product - 品种信息
 * @param openPrice - 开仓价
 * @param closePrice - 平仓价
 * @param volume - 成交量
 * @param direction - 仓位方向
 * @param currency - 账户货币
 * @param quotes - 市场报价
 * @returns - 盈亏
 */
export const getProfit = (
  product: IProduct | null,
  openPrice: number,
  closePrice: number,
  volume: number,
  direction: string,
  currency: string,
  quotes: (product_id: string) => { ask: number; bid: number } | undefined,
) =>
  (direction === 'LONG' ? 1 : -1) *
  volume *
  (closePrice - openPrice) *
  (product?.value_scale ?? 1) *
  (product?.value_scale_unit ? 1 / openPrice : 1) *
  (product && product.quote_currency !== currency
    ? (direction === 'LONG'
        ? quotes(`${product.quote_currency}${currency}`)?.bid
        : quotes(`${product.quote_currency}${currency}`)?.ask) ?? 1
    : 1);

/**
 * 计算保证金
 * @public
 * @param product - 品种信息
 * @param openPrice - 开仓价
 * @param volume - 成交量
 * @param direction - 仓位方向
 * @param currency - 账户货币
 * @param quote - 市场报价
 * @returns - 保证金
 */
export const getMargin = (
  product: IProduct | null,
  openPrice: number,
  volume: number,
  direction: string,
  currency: string,
  quote: (product_id: string) => { ask: number; bid: number } | undefined,
) =>
  volume *
  (product?.value_scale ?? 1) *
  (product?.value_scale_unit ? 1 : openPrice) *
  (product?.margin_rate ?? 1) *
  (product && product.quote_currency !== currency
    ? (direction === 'LONG'
        ? quote(`${product.quote_currency}${currency}`)?.bid
        : quote(`${product.quote_currency}${currency}`)?.ask) ?? 1
    : 1);

/**
 * Merge Positions by product_id/variant
 * @param positions - List of Positions
 * @returns - Merged Positions
 *
 * @public
 */
export const mergePositions = (positions: IPosition[]): IPosition[] => {
  const mapProductIdToPosition = positions.reduce((acc, cur) => {
    const { product_id, direction } = cur;
    if (!acc[`${product_id}-${direction}`]) {
      acc[`${product_id}-${direction}`] = { ...cur };
    } else {
      let thePosition = acc[`${product_id}-${direction}`];
      thePosition = {
        ...thePosition,
        volume: thePosition.volume + cur.volume,
        free_volume: thePosition.free_volume + cur.free_volume,
        position_price:
          (thePosition.position_price * thePosition.volume + cur.position_price * cur.volume) /
          (thePosition.volume + cur.volume),
        floating_profit: thePosition.floating_profit + cur.floating_profit,
        closable_price:
          (thePosition.closable_price * thePosition.volume + cur.closable_price * cur.volume) /
          (thePosition.volume + cur.volume),
      };
      acc[`${product_id}-${direction}`] = thePosition;
    }
    return acc;
  }, {} as Record<string, IPosition>);
  return Object.values(mapProductIdToPosition);
};

/**
 * @public
 */
export interface IPositionDiff {
  /** Product ID */
  product_id: string;
  /** position variant LONG/SHORT */
  direction: string;
  /** source volume */
  volume_in_source: number;
  /** Target volume */
  volume_in_target: number;
  /** Error Volume */
  error_volume: number;
}

/**
 * 计算持仓差距，会自动合并相同 product_id/variant 的持仓
 * @param source - 源持仓
 * @param target - 目标持仓
 * @returns - 持仓差距
 *
 * @public
 *
 * @deprecated - use `@yuants/data-account#diffPosition` instead
 */
export const diffPosition = (source: IPosition[], target: IPosition[]): IPositionDiff[] => {
  const sourceMapped = source
    .map((position) => ({
      product_id: position.product_id,
      direction: position.direction!,
      volume_in_source: position.volume,
    }))
    .reduce((acc, cur) => {
      const { product_id, direction } = cur;
      if (!acc[`${product_id}-${direction}`]) {
        acc[`${product_id}-${direction}`] = { ...cur };
      } else {
        let thePosition = acc[`${product_id}-${direction}`];
        thePosition = {
          ...thePosition,
          volume_in_source: thePosition.volume_in_source + cur.volume_in_source,
        };
        acc[`${product_id}-${direction}`] = thePosition;
      }
      return acc;
    }, {} as Record<string, Pick<IPositionDiff, 'product_id' | 'direction' | 'volume_in_source'>>);

  const targetMapped = target
    .map((position) => ({
      product_id: position.product_id,
      direction: position.direction!,
      volume_in_target: position.volume,
    }))
    .reduce((acc, cur) => {
      const { product_id, direction } = cur;
      if (!acc[`${product_id}-${direction}`]) {
        acc[`${product_id}-${direction}`] = { ...cur };
      } else {
        let thePosition = acc[`${product_id}-${direction}`];
        thePosition = {
          ...thePosition,
          volume_in_target: thePosition.volume_in_target + cur.volume_in_target,
        };
        acc[`${product_id}-${direction}`] = thePosition;
      }
      return acc;
    }, {} as Record<string, Pick<IPositionDiff, 'product_id' | 'direction' | 'volume_in_target'>>);

  const diff = [
    // source 中存在的部分
    ...Object.values(sourceMapped).map((position) => {
      const { product_id, direction } = position;
      const targetPosition = targetMapped[`${product_id}-${direction}`];
      const error_volume = position.volume_in_source - (targetPosition?.volume_in_target ?? 0);
      return {
        product_id,
        direction,
        volume_in_source: position.volume_in_source,
        volume_in_target: targetPosition?.volume_in_target ?? 0,
        error_volume,
      };
    }),
    // source 中不存在的部分
    ...Object.values(targetMapped)
      .filter((position) => !sourceMapped[`${position.product_id}-${position.direction}`])
      .map((position) => {
        const { product_id, direction } = position;
        return {
          product_id,
          direction,
          volume_in_source: 0,
          volume_in_target: position.volume_in_target,
          error_volume: -position.volume_in_target,
        };
      }),
  ];

  return diff;

  // // the code below is more readable yet haven't been tested
  // const mapPositionIdVariantToDiff: Record<string, IPositionDiff> = {};

  // for (const position of source) {
  //   const diff = mapPositionIdVariantToDiff[`${position.product_id}-${position.variant}`];
  //   if (diff) {
  //     diff.volume_in_source += position.volume;
  //   } else {
  //     mapPositionIdVariantToDiff[`${position.product_id}-${position.variant}`] = {
  //       product_id: position.product_id,
  //       variant: position.variant,
  //       volume_in_source: position.volume,
  //       volume_in_target: 0,
  //       error_volume: 0
  //     };
  //   }
  // }

  // for (const position of target) {
  //   const diff = mapPositionIdVariantToDiff[`${position.product_id}-${position.variant}`];
  //   if (diff) {
  //     diff.volume_in_target += position.volume;
  //     diff.error_volume = diff.volume_in_source - diff.volume_in_target;
  //   } else {
  //     mapPositionIdVariantToDiff[`${position.product_id}-${position.variant}`] = {
  //       product_id: position.product_id,
  //       variant: position.variant,
  //       volume_in_source: 0,
  //       volume_in_target: position.volume,
  //       error_volume: -position.volume
  //     };
  //   }
  // }

  // return Object.values(mapPositionIdVariantToDiff);
};
