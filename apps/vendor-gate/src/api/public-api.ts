import { requestPublic } from './http-client';
import { rateLimiter } from './rate-limiter';

/**
 * 查询所有的合约信息
 *
 * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E6%9F%A5%E8%AF%A2%E6%89%80%E6%9C%89%E7%9A%84%E5%90%88%E7%BA%A6%E4%BF%A1%E6%81%AF
 */
export const getFuturesContracts = (
  settle: string,
  params?: { limit?: number; offset?: number },
): Promise<
  {
    name: string;
    type: string;
    quanto_multiplier: string;
    ref_discount_rate: string;
    order_price_deviate: string;
    maintenance_rate: string;
    mark_type: string;
    last_price: string;
    mark_price: string;
    index_price: string;
    funding_rate_indicative: string;
    mark_price_round: string;
    funding_offset: number;
    in_delisting: boolean;
    risk_limit_base: string;
    interest_rate: string;
    order_price_round: string;
    order_size_min: number;
    ref_rebate_rate: string;
    funding_interval: number;
    risk_limit_step: string;
    leverage_min: string;
    leverage_max: string;
    risk_limit_max: string;
    maker_fee_rate: string;
    taker_fee_rate: string;
    funding_rate: string;
    order_size_max: number;
    funding_next_apply: number;
    short_users: number;
    config_change_time: number;
    trade_size: number;
    position_size: number;
    long_users: number;
    funding_impact_value: string;
    orders_limit: number;
    trade_id: number;
    orderbook_id: number;
    enable_bonus: boolean;
    enable_credit: boolean;
    create_time: number;
    funding_cap_ratio: string;
  }[]
> => requestPublic('GET', `/futures/${settle}/contracts`, params);

/**
 * 合约市场历史资金费率
 *
 * - Note: 该接口返回的数据是按照时间倒序排列的
 * - Note: limit 参数最大值为 1000
 * - Note: t 字段为秒级时间戳 (Unix Second)，r 字段为资金费率 (0-1 单位)
 *
 * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E5%90%88%E7%BA%A6%E5%B8%82%E5%9C%BA%E5%8E%86%E5%8F%B2%E8%B5%84%E9%87%91%E8%B4%B9%E7%8E%87
 */
export const getFutureFundingRate = (
  settle: string,
  params: { contract: string; limit?: number; from?: number; to?: number; offset?: number },
): Promise<
  {
    t: number;
    r: string;
  }[]
> => requestPublic('GET', `/futures/${settle}/funding_rate`, params);

/**
 * 合约市场 K 线图
 *
 * https://www.gate.com/docs/developers/apiv4/zh_CN/#%E5%90%88%E7%BA%A6%E5%B8%82%E5%9C%BA-k-%E7%BA%BF%E5%9B%BE
 */
export const getFuturesCandlesticks = (
  settle: string,
  params: {
    contract: string;
    interval: string;
    from?: number;
    to?: number;
    limit?: number;
  },
): Promise<
  Array<{
    /** Unix second */
    t: number;
    /** Open */
    o: string;
    /** High */
    h: string;
    /** Low */
    l: string;
    /** Close */
    c: string;
    /** Volume */
    v: string;
  }>
> => requestPublic('GET', `/futures/${settle}/candlesticks`, params);

/**
 * 市场 K 线图
 *
 * https://www.gate.com/docs/developers/apiv4/zh_CN/#%E5%B8%82%E5%9C%BA-k-%E7%BA%BF%E5%9B%BE
 */
export const getSpotCandlesticks = (params: {
  currency_pair: string;
  interval: string;
  from?: number;
  to?: number;
  limit?: number;
}): Promise<
  Array<
    /**
     * [t, v, c, h, l, o]
     * - t: Unix second
     */
    [string, string, string, string, string, string]
  >
> => requestPublic('GET', `/spot/candlesticks`, params);

/**
 * 查询合约市场深度信息
 *
 * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E6%9F%A5%E8%AF%A2%E5%90%88%E7%BA%A6%E5%B8%82%E5%9C%BA%E6%B7%B1%E5%BA%A6%E4%BF%A1%E6%81%AF
 */
export const getFuturesOrderBook = async (
  settle: string,
  params: {
    contract: string;
    interval?: string;
    limit?: number;
    with_id?: boolean;
  },
): Promise<{
  id: number;
  current: number;
  update: number;
  asks: {
    p: string;
    s: string;
  }[];
  bids: {
    p: string;
    s: string;
  }[];
}> =>
  rateLimiter.schedule(`futures-order-book:${settle}`, 200, 10_000, () =>
    requestPublic('GET', `/futures/${settle}/order_book`, params),
  );

/**
 * 获取所有合约交易行情统计
 *
 * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E8%8E%B7%E5%8F%96%E6%89%80%E6%9C%89%E5%90%88%E7%BA%A6%E4%BA%A4%E6%98%93%E8%A1%8C%E6%83%85%E7%BB%9F%E8%AE%A1
 */
export const getFuturesTickers = (
  settle: string,
  params?: { contract?: string },
): Promise<
  {
    contract: string;
    last: string;
    change_percentage: string;
    total_size: string;
    low_24h: string;
    high_24h: string;
    volume_24h: string;
    volume_24h_btc: string;
    volume_24h_usd: string;
    volume_24h_base: string;
    volume_24h_quote: string;
    volume_24h_settle: string;
    mark_price: string;
    funding_rate: string;
    funding_rate_indicative: string;
    index_price: string;
    quanto_base_rate: string;
    basis_rate: string;
    basis_value: string;
    lowest_ask: string;
    highest_bid: string;
  }[]
> => requestPublic('GET', `/futures/${settle}/tickers`, params);

/**
 * 获取交易对 ticker 信息
 *
 * https://www.gate.com/docs/developers/apiv4/zh_CN/#%E8%8E%B7%E5%8F%96%E4%BA%A4%E6%98%93%E5%AF%B9-ticker-%E4%BF%A1%E6%81%AF
 */
export const getSpotTickers = (params: {
  currency_pair?: string;
  timezone?: string;
}): Promise<
  Array<{
    currency_pair: string;
    last: string;
    lowest_ask: string;
    lowest_size: string;
    highest_bid: string;
    highest_size: string;
    change_percentage: string;
    change_utc0: string;
    change_utc8: string;
    base_volume: string;
    quote_volume: string;
    high_24h: string;
    low_24h: string;
    etf_net_value: string;
    etf_pre_net_value: string;
    etf_pre_timestamp: string;
    etf_leverage: string;
  }>
> => requestPublic('GET', `/spot/tickers`, params);

/**
 * 查询支持的所有现货交易对
 * https://www.gate.com/docs/developers/apiv4/zh_CN/#%E6%9F%A5%E8%AF%A2%E6%94%AF%E6%8C%81%E7%9A%84%E6%89%80%E6%9C%89%E4%BA%A4%E6%98%93%E5%AF%B9
 */
export const getSpotCurrencyPairs = (): Promise<
  Array<{
    id: string;
    base: string;
    base_name: string;
    quote: string;
    quote_name: string;
    fee: string;
    min_base_amount: string;
    min_quote_amount: string;
    max_base_amount: string;
    max_quote_amount: string;
    amount_precision: Number;
    precision: Number;
    trade_status: string;
    sell_start: Number;
    buy_start: number;
    delisting_time: number;
    trade_url: string;
    st_tag: boolean;
  }>
> => requestPublic('GET', `/spot/currency_pairs`);
