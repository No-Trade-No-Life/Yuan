import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { from, groupBy, map, mergeMap, Observable, reduce, toArray } from 'rxjs';
import { v4 } from 'uuid';
import { IAccountInfo, IPosition, IProduct } from './interfaces';

/**
 * @public
 */
export const createEmptyAccountInfo = (
  account_id: string,
  currency: string,
  leverage: number = 1,
  initial_balance: number = 0,
): IAccountInfo => ({
  timestamp_in_us: 0,
  updated_at: 0,
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
 * Merge Positions by their product_id and variant
 * @public
 */
export const mergeAccountInfoPositions = (info: IAccountInfo): Observable<IAccountInfo> => {
  return from(info.positions).pipe(
    groupBy((position) => position.product_id),
    mergeMap((groupWithSameProductId) =>
      groupWithSameProductId.pipe(
        groupBy((position) => position.variant),
        mergeMap((groupWithSameVariant) =>
          groupWithSameVariant.pipe(
            reduce(
              (acc: IPosition, cur: IPosition): IPosition => ({
                ...acc,
                volume: acc.volume + cur.volume,
                free_volume: acc.free_volume + cur.free_volume,
                position_price:
                  (acc.position_price * acc.volume + cur.position_price * cur.volume) /
                  (acc.volume + cur.volume),
                floating_profit: acc.floating_profit + cur.floating_profit,
                closable_price:
                  (acc.closable_price * acc.volume + cur.closable_price * cur.volume) /
                  (acc.volume + cur.volume),
              }),
            ),
          ),
        ),
      ),
    ),
    toArray(),
    map((positions): IAccountInfo => ({ ...info, positions })),
  );
};

/**
 * @see https://tradelife.feishu.cn/wiki/wikcnRNzWSF7jtkH8nGruaMhhlh
 *
 * @public
 */
export const getProfit = (
  product: IProduct,
  openPrice: number,
  closePrice: number,
  volume: number,
  variant: string,
  currency: string,
  quotes: (product_id: string) => { ask: number; bid: number } | undefined,
) =>
  (variant === 'LONG' ? 1 : -1) *
  volume *
  (closePrice - openPrice) *
  (product.value_scale ?? 1) *
  (product.value_unit === 'BASE' ? 1 / closePrice : 1) *
  (product.base_currency !== currency
    ? (variant === 'LONG'
        ? quotes(`${product.base_currency}${currency}`)?.bid
        : quotes(`${product.base_currency}${currency}`)?.ask) ?? 1
    : 1);
/**
 * @see https://tradelife.feishu.cn/wiki/wikcnRNzWSF7jtkH8nGruaMhhlh
 *
 * @public
 */
export const getClosePriceByDesiredProfit = (
  product: IProduct,
  openPrice: number,
  volume: number,
  desiredProfit: number,
  variant: string,
  currency: string,
  quotes: (product_id: string) => { ask: number; bid: number } | undefined,
) => {
  const variant_coefficient = variant === 'LONG' ? 1 : -1;
  const cross_product_exchange_rate =
    product.base_currency !== currency
      ? (variant === 'LONG'
          ? quotes(`${product.base_currency}${currency}`)?.bid
          : quotes(`${product.base_currency}${currency}`)?.ask) ?? 1
      : 1;

  const beta = desiredProfit / (variant_coefficient * volume * (product.value_scale ?? 1));

  if (product.value_unit === 'NORM') {
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
 * @see https://tradelife.feishu.cn/wiki/wikcnEVBM0RQ7pmbNZUxMV8viRg
 *
 * @public
 */
export const getMargin = (
  product: IProduct,
  openPrice: number,
  volume: number,
  variant: string,
  currency: string,
  quote: (product_id: string) => { ask: number; bid: number } | undefined,
) =>
  volume *
  (product.value_unit === 'BASE' ? 1 : openPrice) *
  (product.margin_rate ?? 1) *
  (product.base_currency !== currency
    ? (variant === 'LONG'
        ? quote(`${product.base_currency}${currency}`)?.bid
        : quote(`${product.base_currency}${currency}`)?.ask) ?? 1
    : 1) *
  (product.value_scale ?? 1);

/**
 * all the time is formatted as `yyyy-MM-dd HH:mm:ssXXX`.
 *
 * e.g. "2023-05-07 12:34:56+08:00"
 *
 * @public
 */
export const formatTime = (time: Date | number | string, timeZone: string | undefined = undefined) => {
  try {
    if (timeZone) {
      return formatInTimeZone(time, timeZone, 'yyyy-MM-dd HH:mm:ssXXX');
    }
    return format(new Date(time), 'yyyy-MM-dd HH:mm:ssXXX');
  } catch (e) {
    return 'Invalid Date';
  }
};

/**
 * @public
 * @returns Universal Unique ID string
 */
export const UUID = () => v4();

/**
 * convert params to path.
 * Path is splitted by `/`.
 * Escape to `\/` if a param including `/`.
 * @public
 */
export const encodePath = (...params: any[]): string =>
  params.map((param) => `${param}`.replace(/\//g, '\\/')).join('/');

/**
 * convert path to params.
 * Path is splitted by `/`.
 * Escape to `\/` if a param including `/`.
 * @public
 */
export const decodePath = (path: string): string[] =>
  path.split(/(?<!\\)\//g).map((x) => x.replace(/\\\//g, '/'));
