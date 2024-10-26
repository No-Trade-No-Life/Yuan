/**
 * 根据目标盈利计算目标平仓价
 * @public
 * @param product - 品种信息
 * @param openPrice - 开仓价
 * @param volume - 成交量
 * @param desiredProfit - 目标盈利
 * @param direction - 仓位方向
 * @param currency - 账户货币
 * @param quotes - 市场报价
 * @returns - 目标平仓价
 */
export const getClosePriceByDesiredProfit = (
  product: IProduct,
  openPrice: number,
  volume: number,
  desiredProfit: number,
  direction: string,
  currency: string,
  quotes: (product_id: string) => { ask: number; bid: number } | undefined,
) => {
  const variant_coefficient = direction === 'LONG' ? 1 : -1;
  const cross_product_exchange_rate =
    product.quote_currency !== currency
      ? (direction === 'LONG'
          ? quotes(`${product.quote_currency}${currency}`)?.bid
          : quotes(`${product.quote_currency}${currency}`)?.ask) ?? 1
      : 1;

  const beta =
    desiredProfit /
    (variant_coefficient *
      volume *
      (product.value_scale ?? 1) *
      (product.value_scale_unit ? 1 / openPrice : 1));

  if (product.quote_currency === currency) {
    return beta + openPrice;
  }
  if (product.base_currency && product.base_currency === currency) {
    return openPrice / (1 - beta);
  }
  return openPrice + beta / cross_product_exchange_rate;
};
