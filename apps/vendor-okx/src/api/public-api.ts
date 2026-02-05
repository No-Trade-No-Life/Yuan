import { fetch, selectHTTPProxyIpRoundRobinAsync } from '@yuants/http-services';
import { Terminal } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';

const shouldUseHttpProxy = process.env.USE_HTTP_PROXY === 'true';
const fetchImpl = shouldUseHttpProxy ? fetch : globalThis.fetch ?? fetch;
const terminal = Terminal.fromNodeEnv();
const MISSING_PUBLIC_IP_LOG_INTERVAL = 3_600_000;
const missingPublicIpLogAtByTerminalId = new Map<string, number>();

if (shouldUseHttpProxy) {
  globalThis.fetch = fetch;
}

type RequestContext = { ip: string };

const resolveLocalPublicIp = (): string => {
  const ip = terminal.terminalInfo.tags?.public_ip?.trim();
  if (ip) return ip;
  const now = Date.now();
  const lastLoggedAt = missingPublicIpLogAtByTerminalId.get(terminal.terminal_id) ?? 0;
  if (now - lastLoggedAt > MISSING_PUBLIC_IP_LOG_INTERVAL) {
    missingPublicIpLogAtByTerminalId.set(terminal.terminal_id, now);
    console.info(formatTime(Date.now()), 'missing terminal public_ip tag, fallback to public-ip-unknown');
  }
  return 'public-ip-unknown';
};

const createRequestContext = async (): Promise<RequestContext> => {
  if (shouldUseHttpProxy) {
    const ip = await selectHTTPProxyIpRoundRobinAsync(terminal);
    return { ip };
  }
  return { ip: resolveLocalPublicIp() };
};

/**
 * 基础公共请求函数
 */
async function publicRequest(method: string, path: string, params?: Record<string, string>) {
  const url = new URL('https://www.okx.com');
  url.pathname = path;
  const requestContext = await createRequestContext();
  if (method === 'GET') {
    for (const key in params) {
      url.searchParams.set(key, params[key]);
    }
  }

  console.info(formatTime(Date.now()), method, url.href);
  const res = await fetchImpl(
    url.href,
    shouldUseHttpProxy
      ? { method, labels: requestContext.ip ? { ip: requestContext.ip } : undefined, terminal }
      : { method },
  );
  return res.json();
}

/**
 * 获取所有产品行情信息
 *
 * 获取产品行情信息
 *
 * 限速：20次/2s
 * 限速规则：IP
 *
 * https://www.okx.com/docs-v5/zh/#order-book-trading-market-data-get-tickers
 */
export const getMarketTickers = (params: {
  instType: string;
  uly?: string;
  instFamily?: string;
}): Promise<{
  code: string;
  msg: string;
  data: Array<{
    instType: string;
    instId: string;
    last: string;
    lastSz: string;
    askPx: string;
    askSz: string;
    bidPx: string;
    bidSz: string;
    open24h: string;
    high24h: string;
    low24h: string;
    volCcy24h: string;
    vol24h: string;
    sodUtc0: string;
    sodUtc8: string;
    ts: string;
  }>;
}> => publicRequest('GET', '/api/v5/market/tickers', params);

/**
 * 获取交易产品基础信息
 *
 * 获取所有可交易产品的信息列表。
 *
 * 限速：20次/2s
 * 限速规则：IP +instType
 *
 * https://www.okx.com/docs-v5/zh/#public-data-rest-api-get-instruments
 */
export const getInstruments = (params: {
  instType: string;
  uly?: string;
  instFamily?: string;
  instId?: string;
}): Promise<{
  code: string;
  msg: string;
  data: Array<{
    alias: string;
    baseCcy: string;
    category: string;
    ctMult: string;
    ctType: string;
    ctVal: string;
    ctValCcy: string;
    expTime: string;
    instFamily: string;
    instId: string;
    instType: string;
    lever: string;
    listTime: string;
    lotSz: string;
    maxIcebergSz: string;
    maxLmtAmt: string;
    maxLmtSz: string;
    maxMktAmt: string;
    maxMktSz: string;
    maxStopSz: string;
    maxTriggerSz: string;
    maxTwapSz: string;
    minSz: string;
    optType: string;
    quoteCcy: string;
    settleCcy: string;
    state: string;
    stk: string;
    tickSz: string;
    uly: string;
  }>;
}> => publicRequest('GET', '/api/v5/public/instruments', params);

/**
 * 获取永续合约当前资金费率
 *
 * 获取当前资金费率
 *
 * 限速：20次/2s
 * 限速规则：IP +instrumentID
 *
 * https://www.okx.com/docs-v5/zh/#public-data-rest-api-get-funding-rate
 */
export const getFundingRate = (params: {
  instId: string;
}): Promise<{
  code: string;
  data: Array<{
    fundingRate: string;
    fundingTime: string;
    instId: string;
    instType: string;
    method: string;
    maxFundingRate: string;
    minFundingRate: string;
    nextFundingRate: string;
    nextFundingTime: string;
    premium: string;
    settFundingRate: string;
    settState: string;
    ts: string;
  }>;
  msg: string;
}> => publicRequest('GET', '/api/v5/public/funding-rate', params);

/**
 * 获取永续合约历史资金费率
 *
 * 获取最近3个月的历史资金费率
 *
 * 限速：10次/2s
 * 限速规则：IP +instrumentID
 *
 * https://www.okx.com/docs-v5/zh/#public-data-rest-api-get-funding-rate-history
 */
export const getFundingRateHistory = (params: {
  instId: string;
  before?: string;
  after?: string;
  limit?: string;
}): Promise<{
  code: string;
  msg: string;
  data: Array<{
    fundingRate: string;
    fundingTime: string;
    instId: string;
    instType: string;
    method: string;
    realizedRate: string;
  }>;
}> => publicRequest('GET', '/api/v5/public/funding-rate-history', params);

/**
 * 获取标记价格历史K线数据
 *
 * 获取最近几年的标记价格K线数据
 *
 * 限速：10次/2s
 * 限速规则：IP
 *
 * https://www.okx.com/docs-v5/zh/#public-data-rest-api-get-mark-price-candlesticks-history
 */
export const getHistoryMarkPriceCandles = (params: {
  instId: string;
  bar?: string;
  after?: string;
  before?: string;
  limit?: string;
}): Promise<{
  code: string;
  msg: string;
  data: Array<[ts: string, o: string, h: string, l: string, c: string, confirm: string]>;
}> => publicRequest('GET', '/api/v5/market/history-mark-price-candles', params);

/**
 * 获取交易产品历史K线数据
 *
 * 获取最近几年的历史k线数据(1s k线支持查询最近3个月的数据)
 *
 * 限速：20次/2s
 * 限速规则：IP
 *
 * 期权不支持 1s K线， 其他业务线 (币币, 杠杆, 交割和永续)支持
 *
 * https://www.okx.com/docs-v5/zh/#order-book-trading-market-data-get-candlesticks-history
 */
export const getHistoryCandles = (params: {
  instId: string;
  bar?: string;
  after?: string;
  before?: string;
  limit?: string;
}): Promise<{
  code: string;
  msg: string;
  data: Array<
    [
      ts: string,
      o: string,
      h: string,
      l: string,
      c: string,
      vol: string,
      volCcy: string,
      volCcyQuote: string,
      confirm: string,
    ]
  >;
}> => publicRequest('GET', '/api/v5/market/history-candles', params);

/**
 * 获取持仓总量
 *
 * 查询单个交易产品的市场的持仓总量
 *
 * 限速：20次/2s
 * 限速规则：IP + instrumentID
 *
 * https://www.okx.com/docs-v5/zh/#public-data-rest-api-get-open-interest
 */
export const getOpenInterest = (params: {
  instType: string;
  uly?: string;
  instFamily?: string;
  instId?: string;
}): Promise<{
  code: string;
  msg: string;
  data: {
    instType: string;
    instId: string;
    oi: string;
    oiCcy: string;
    ts: string;
  }[];
}> => publicRequest('GET', '/api/v5/public/open-interest', params);

/**
 * 获取市场借币杠杆利率和借币限额
 *
 * 限速：2次/2s
 * 限速规则：IP
 *
 * https://www.okx.com/docs-v5/zh/#public-data-rest-api-get-interest-rate-and-loan-quota
 */
export const getInterestRateLoanQuota = (): Promise<{
  code: string;
  data?: Array<{
    basic: Array<{
      ccy: string;
      rate: string;
      quota: string;
    }>;
    vip: Array<{
      loanQuotaCoef: string;
      level: string;
    }>;
    regular: Array<{
      loanQuotaCoef: string;
      level: string;
    }>;
  }>;
}> => publicRequest('GET', '/api/v5/public/interest-rate-loan-quota');

/**
 * 获取市场借贷历史（公共）
 *
 * 公共接口无须鉴权
 *
 * 返回2021年12月14日后的记录
 *
 * 限速：6次/s
 * 限速规则：IP
 *
 * https://www.okx.com/docs-v5/zh/#financial-product-savings-get-public-borrow-history-public
 */
export const getLendingRateHistory = (params: {
  ccy?: string;
  after?: string;
  before?: string;
  limit?: string;
}): Promise<{
  code: string;
  msg: string;
  data: Array<{
    ccy: string;
    amt: string;
    rate: string;
    ts: string;
  }>;
}> => publicRequest('GET', '/api/v5/finance/savings/lending-rate-history', params);

/**
 * 获取指数行情数据
 *
 * 限速：20次/2s
 *
 * https://www.okx.com/docs-v5/zh/#public-data-rest-api-get-index-tickers
 */
export const getMarketIndexTicker = (params?: {
  quoteCcy?: string;
  instId?: string;
}): Promise<{
  code: string;
  msg: string;
  data: {
    instId: string;
    idxPx: string;
    high24h: string;
    sodUtc0: string;
    open24h: string;
    low24h: string;
    sodUtc8: string;
    ts: string;
  }[];
}> => publicRequest('GET', '/api/v5/market/index-tickers', params);

/**
 * 获取产品深度
 *
 * 限速：40次/2s
 * 限速规则：IP
 *
 * https://www.okx.com/docs-v5/zh/#order-book-trading-market-data-get-order-book
 */
export const getMarketBooks = (params: {
  sz?: string;
  instId: string;
}): Promise<{
  code: string;
  data: {
    asks: [price: string, volume: string, abandon: string, order_number: string][];
    bids: [price: string, volume: string, abandon: string, order_number: string][];
    ts: string;
  }[];
  msg: string;
}> => publicRequest('GET', '/api/v5/market/books', params);

/**
 * 获取衍生品仓位档位
 *
 * 获取全部仓位档位对应信息
 *
 * 限速：10次/2s
 * 限速规则：IP
 *
 * https://www.okx.com/docs-v5/zh/#public-data-rest-api-get-position-tiers
 */
export const getPositionTiers = (params: {
  instType: string;
  tdMode: string;
  instFamily?: string;
  instId?: string;
  uly?: string;
  ccy?: string;
  tier?: string;
}): Promise<{
  code: string;
  msg: string;
  data: Array<{
    uly: string;
    instFamily: string;
    instId: string;
    tier: string;
    minSz: string;
    maxSz: string;
    mmr: string;
    imr: string;
    maxLever: string;
    optMgnFactor: string;
    quoteMaxLoan: string;
    baseMaxLoan: string;
  }>;
}> => publicRequest('GET', '/api/v5/public/position-tiers', params);
