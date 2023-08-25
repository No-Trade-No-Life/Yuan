import { IAccountInfo, IPosition, IProduct, PositionVariant } from '@yuants/protocol';
import { format } from 'date-fns';

/**
 * @internal
 */
export const formatTime = (time: Date | number) => {
  try {
    return format(time, 'yyyy-MM-dd HH:mm:ss');
  } catch (e) {
    return 'Invalid Date';
  }
};

/**
 * 计算盈亏
 * @public
 * @param product - 品种信息
 * @param openPrice - 开仓价
 * @param closePrice - 平仓价
 * @param volume - 成交量
 * @param variant - 仓位类型
 * @param currency - 账户货币
 * @param quotes - 市场报价
 * @returns - 盈亏
 * @see https://tradelife.feishu.cn/wiki/wikcnRNzWSF7jtkH8nGruaMhhlh
 */
export const getProfit = (
  product: IProduct,
  openPrice: number,
  closePrice: number,
  volume: number,
  variant: PositionVariant,
  currency: string,
  quotes: (product_id: string) => { ask: number; bid: number } | undefined,
) =>
  (variant === PositionVariant.LONG ? 1 : -1) *
  volume *
  (closePrice - openPrice) *
  (product.value_speed ?? 1) *
  (product.is_underlying_base_currency === true ? 1 / closePrice : 1) *
  (product.base_currency !== currency
    ? (variant === PositionVariant.LONG
        ? quotes(`${product.base_currency}${currency}`)?.bid
        : quotes(`${product.base_currency}${currency}`)?.ask) ?? 1
    : 1);

/**
 * 根据目标盈利计算目标平仓价
 * @public
 * @param product - 品种信息
 * @param openPrice - 开仓价
 * @param volume - 成交量
 * @param desiredProfit - 目标盈利
 * @param variant - 仓位类型
 * @param currency - 账户货币
 * @param quotes - 市场报价
 * @returns - 目标平仓价
 * @see https://tradelife.feishu.cn/wiki/wikcnRNzWSF7jtkH8nGruaMhhlh
 */
export const getClosePriceByDesiredProfit = (
  product: IProduct,
  openPrice: number,
  volume: number,
  desiredProfit: number,
  variant: PositionVariant,
  currency: string,
  quotes: (product_id: string) => { ask: number; bid: number } | undefined,
) => {
  const variant_coefficient = variant === PositionVariant.LONG ? 1 : -1;
  const cross_product_exchange_rate =
    product.base_currency !== currency
      ? (variant === PositionVariant.LONG
          ? quotes(`${product.base_currency}${currency}`)?.bid
          : quotes(`${product.base_currency}${currency}`)?.ask) ?? 1
      : 1;

  const beta = desiredProfit / (variant_coefficient * volume * (product.value_speed ?? 1));

  if (product.is_underlying_base_currency) {
    return openPrice + beta / cross_product_exchange_rate;
  }
  if (product.quoted_currency === currency) {
    return openPrice + beta;
  }
  if (beta >= cross_product_exchange_rate) {
    return NaN;
  }
  return openPrice / (1 - beta / cross_product_exchange_rate);
};

/**
 * 计算保证金
 * @public
 * @param product - 品种信息
 * @param openPrice - 开仓价
 * @param volume - 成交量
 * @param variant - 仓位类型
 * @param currency - 账户货币
 * @param quote - 市场报价
 * @returns - 保证金
 * @see https://tradelife.feishu.cn/wiki/wikcnEVBM0RQ7pmbNZUxMV8viRg
 */
export const getMargin = (
  product: IProduct,
  openPrice: number,
  volume: number,
  variant: PositionVariant,
  currency: string,
  quote: (product_id: string) => { ask: number; bid: number } | undefined,
) =>
  volume *
  (product.is_underlying_base_currency ? 1 : openPrice) *
  (product.margin_rate ?? 1) *
  (product.base_currency !== currency
    ? (variant === PositionVariant.LONG
        ? quote(`${product.base_currency}${currency}`)?.bid
        : quote(`${product.base_currency}${currency}`)?.ask) ?? 1
    : 1) *
  (product.value_speed ?? 1);

/**
 * 构造一个空的账户流信息
 * @param account_id - 账户ID
 * @param currency - 账户保证金货币
 * @param leverage - 账户系统杠杆率
 * @param initial_balance - 初始余额
 *
 * @public
 */
export const createEmptyAccountInfo = (
  account_id: string,
  currency: string,
  leverage: number = 1,
  initial_balance: number = 0,
): IAccountInfo => ({
  timestamp_in_us: 0,
  account_id,
  money: {
    currency,
    leverage,
    equity: initial_balance,
    balance: initial_balance,
    profit: 0,
    used: 0,
    free: 0,
  },
  positions: [],
  orders: [],
});

/**
 * 合并相同 product_id/variant 的头寸
 * @param positions - 头寸列表
 * @returns - 合并后的头寸列表
 *
 * @public
 */
export const mergePositions = (positions: IPosition[]): IPosition[] => {
  const mapProductIdToPosition = positions.reduce((acc, cur) => {
    const { product_id, variant } = cur;
    if (!acc[`${product_id}-${variant}`]) {
      acc[`${product_id}-${variant}`] = { ...cur };
    } else {
      let thePosition = acc[`${product_id}-${variant}`];
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
      acc[`${product_id}-${variant}`] = thePosition;
    }
    return acc;
  }, {} as Record<string, IPosition>);
  return Object.values(mapProductIdToPosition);
};

/**
 * @public
 */
export interface IPositionDiff {
  /** 品种 ID */
  product_id: string;
  /** 持仓方向 */
  variant: PositionVariant;
  /** 源持仓 volume */
  volume_in_source: number;
  /** 目标持仓 volume */
  volume_in_target: number;
  /** 持仓差距 */
  error_volume: number;
}

/**
 * 计算持仓差距，会自动合并相同 product_id/variant 的持仓
 * @param source - 源持仓
 * @param target - 目标持仓
 * @returns - 持仓差距
 *
 * @public
 */
export const diffPosition = (source: IPosition[], target: IPosition[]): IPositionDiff[] => {
  const sourceMapped = source
    .map((position) => ({
      product_id: position.product_id,
      variant: position.variant,
      volume_in_source: position.volume,
    }))
    .reduce((acc, cur) => {
      const { product_id, variant } = cur;
      if (!acc[`${product_id}-${variant}`]) {
        acc[`${product_id}-${variant}`] = { ...cur };
      } else {
        let thePosition = acc[`${product_id}-${variant}`];
        thePosition = {
          ...thePosition,
          volume_in_source: thePosition.volume_in_source + cur.volume_in_source,
        };
        acc[`${product_id}-${variant}`] = thePosition;
      }
      return acc;
    }, {} as Record<string, Pick<IPositionDiff, 'product_id' | 'variant' | 'volume_in_source'>>);

  const targetMapped = target
    .map((position) => ({
      product_id: position.product_id,
      variant: position.variant,
      volume_in_target: position.volume,
    }))
    .reduce((acc, cur) => {
      const { product_id, variant } = cur;
      if (!acc[`${product_id}-${variant}`]) {
        acc[`${product_id}-${variant}`] = { ...cur };
      } else {
        let thePosition = acc[`${product_id}-${variant}`];
        thePosition = {
          ...thePosition,
          volume_in_target: thePosition.volume_in_target + cur.volume_in_target,
        };
        acc[`${product_id}-${variant}`] = thePosition;
      }
      return acc;
    }, {} as Record<string, Pick<IPositionDiff, 'product_id' | 'variant' | 'volume_in_target'>>);

  const diff = [
    // source 中存在的部分
    ...Object.values(sourceMapped).map((position) => {
      const { product_id, variant } = position;
      const targetPosition = targetMapped[`${product_id}-${variant}`];
      const error_volume = position.volume_in_source - (targetPosition?.volume_in_target ?? 0);
      return {
        product_id,
        variant,
        volume_in_source: position.volume_in_source,
        volume_in_target: targetPosition?.volume_in_target ?? 0,
        error_volume,
      };
    }),
    // source 中不存在的部分
    ...Object.values(targetMapped)
      .filter((position) => !sourceMapped[`${position.product_id}-${position.variant}`])
      .map((position) => {
        const { product_id, variant } = position;
        return {
          product_id,
          variant,
          volume_in_source: 0,
          volume_in_target: position.volume_in_target,
          error_volume: -position.volume_in_target,
        };
      }),
  ];

  return diff;

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
