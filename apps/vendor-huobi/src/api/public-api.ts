import { fetch } from '@yuants/http-services';
import { formatTime, scopeError, tokenBucket } from '@yuants/utils';

// Huobi API 根域名
const SWAP_API_ROOT = 'api.hbdm.com';
const SPOT_API_ROOT = 'api.huobi.pro';

type HuobiBusiness = 'spot' | 'linear-swap';
type HuobiPublicInterfaceType = 'market' | 'non-market';

const shouldUseHttpProxy = process.env.USE_HTTP_PROXY === 'true';
const fetchImpl = shouldUseHttpProxy ? fetch : globalThis.fetch ?? fetch;

if (shouldUseHttpProxy) {
  globalThis.fetch = fetch;
}

const acquire = (bucketId: string, meta: Record<string, unknown>) => {
  const bucket = tokenBucket(bucketId);
  scopeError('HUOBI_API_RATE_LIMIT', { ...meta, bucketId }, () => bucket.acquireSync(1));
};

// https://www.htx.com/zh-cn/opend/newApiPages/?id=474
// 行情类：同一个 IP，总共 1s 最多 800 个请求（合约业务共享总额度）
const marketDataIPAllBucketId = 'HUOBI_PUBLIC_MARKET_IP_1S_ALL';
tokenBucket(marketDataIPAllBucketId, {
  capacity: 800,
  refillInterval: 1000,
  refillAmount: 800,
});

// 行情类：按业务线拆分（用于交割/币本位永续/U本位分开限频）
const marketDataSpotBucketId = 'HUOBI_PUBLIC_MARKET_IP_1S_SPOT';
tokenBucket(marketDataSpotBucketId, { capacity: 800, refillInterval: 1000, refillAmount: 800 });

const marketDataLinearSwapBucketId = 'HUOBI_PUBLIC_MARKET_IP_1S_LINEAR_SWAP';
tokenBucket(marketDataLinearSwapBucketId, { capacity: 800, refillInterval: 1000, refillAmount: 800 });

// 非行情类公开接口：同一个 IP，3s 最多 120 次请求
const nonMarketDataIPBucketId = 'HUOBI_PUBLIC_NON_MARKET_IP_3S_ALL';
tokenBucket(nonMarketDataIPBucketId, {
  capacity: 120,
  refillInterval: 3000,
  refillAmount: 120,
});

/**
 * 公共 API 请求方法（不负责限流；限流由调用点选择对应 helper）
 */
async function publicRequest(method: string, path: string, api_root: string, params?: any) {
  const url = new URL(`https://${api_root}${path}`);

  if (method === 'GET') {
    for (const [k, v] of Object.entries(params || {})) {
      url.searchParams.append(k, String(v));
    }
  }

  const body = method === 'GET' ? '' : JSON.stringify(params);

  console.info(formatTime(Date.now()), method, url.href, body);

  const res = await fetchImpl(url.href, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body || undefined,
  });

  console.info(formatTime(Date.now()), 'PublicResponse', url.toString(), res.status);

  const retStr = await res.text();
  try {
    return JSON.parse(retStr);
  } catch (e) {
    console.error(formatTime(Date.now()), 'huobiRequestFailed', path, JSON.stringify(params), retStr);
    throw e;
  }
}

const spotMarketRequest = async (method: string, path: string, params?: any) => {
  const meta = {
    method,
    api_root: SPOT_API_ROOT,
    path,
    business: 'spot' as HuobiBusiness,
    interfaceType: 'market' as HuobiPublicInterfaceType,
  };
  acquire(marketDataIPAllBucketId, meta);
  acquire(marketDataSpotBucketId, meta);
  return publicRequest(method, path, SPOT_API_ROOT, params);
};

const spotNonMarketRequest = async (method: string, path: string, params?: any) => {
  const meta = {
    method,
    api_root: SPOT_API_ROOT,
    path,
    business: 'spot' as HuobiBusiness,
    interfaceType: 'non-market' as HuobiPublicInterfaceType,
  };
  acquire(nonMarketDataIPBucketId, meta);
  return publicRequest(method, path, SPOT_API_ROOT, params);
};

const linearSwapMarketRequest = async (method: string, path: string, params?: any) => {
  const meta = {
    method,
    api_root: SWAP_API_ROOT,
    path,
    business: 'linear-swap' as HuobiBusiness,
    interfaceType: 'market' as HuobiPublicInterfaceType,
  };
  acquire(marketDataIPAllBucketId, meta);
  acquire(marketDataLinearSwapBucketId, meta);
  return publicRequest(method, path, SWAP_API_ROOT, params);
};

const linearSwapNonMarketRequest = async (method: string, path: string, params?: any) => {
  const meta = {
    method,
    api_root: SWAP_API_ROOT,
    path,
    business: 'linear-swap' as HuobiBusiness,
    interfaceType: 'non-market' as HuobiPublicInterfaceType,
  };
  acquire(nonMarketDataIPBucketId, meta);
  return publicRequest(method, path, SWAP_API_ROOT, params);
};

// ==================== 公共 API 方法 ====================

/**
 * 获取永续合约产品信息
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=8cb72f34-77b5-11ed-9966-0242ac110003
 */
export function getPerpetualContractSymbols(params?: {
  contract_code?: string;
  support_margin_mode?: string;
  pair?: string;
  contract_type?: string;
  business_type?: string;
}): Promise<{
  status: string;
  data: {
    symbol: string;
    contract_code: string;
    contract_size: number;
    price_tick: number;
    settlement_date: string;
    delivery_time: string;
    create_date: string;
    contract_status: number;
    support_margin_mode: string;
    contract_type: string;
    pair: string;
    business_type: string;
    delivery_date: string;
  }[];
  ts: string;
}> {
  return linearSwapNonMarketRequest('GET', '/linear-swap-api/v1/swap_contract_info', params);
}

/**
 * 获取现货产品信息
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec47f16-7773-11ed-9966-0242ac110003
 */
export function getSpotSymbols(): Promise<{
  status: string;
  data: {
    si: string;
    scr: string;
    sc: string;
    dn: string;
    bc: string;
    bcdn: string;
    qc: string;
    qcdn: string;
    state: string;
    whe: boolean;
    cd: boolean;
    te: boolean;
    toa: number;
    sp: string;
    w: number;
    ttp: number;
    tap: number;
    tpp: number;
    fp: number;
    suspend_desc: string;
    transfer_board_desc: string;
    tags: string;
    lr: number;
    smlr: number;
    flr: string;
    wr: string;
    d: number;
    elr: number;
    p: any;
    castate: string;
    ca1oa: number;
    ca2oa: number;
  }[];
  ts: string;
  full: number;
  err_code: string;
  err_msg: string;
}> {
  return spotNonMarketRequest('GET', '/v2/settings/common/symbols');
}

/**
 * 获取现货行情
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec3fc25-7773-11ed-9966-0242ac110003
 */
export function getSpotTick(params: { symbol: string }): Promise<{
  status: string;
  tick: {
    close: number;
  };
}> {
  return spotMarketRequest('GET', `/market/detail/merged`, params);
}

/**
 * 【现货】获取K线数据
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec3ff18-7773-11ed-9966-0242ac110003
 *
 * Note: HTX spot KLine uses unix seconds in `data[].id`
 */
export function getSpotHistoryKline(params: {
  symbol: string;
  period: string;
  size?: number;
  from?: number;
  to?: number;
}): Promise<{
  status: string;
  ch?: string;
  ts: number;
  data: {
    id: number;
    open: number;
    close: number;
    low: number;
    high: number;
    vol: number;
    amount?: number;
    count?: number;
  }[];
}> {
  return spotMarketRequest('GET', `/market/history/kline`, params);
}

/**
 * 【通用】批量获取合约资金费率
 *
 * 接口权限: 读取
 *
 * 限频: 其他非行情类的公开接口，比如获取指数信息，限价信息，交割结算、平台持仓信息等，所有用户都是每个IP3秒最多120次请求（所有该IP的非行情类的公开接口请求共享3秒120次的额度）
 *
 * 接口描述: 该接口支持全仓模式和逐仓模式
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=8cb71b45-77b5-11ed-9966-0242ac110003
 */
export function getSwapBatchFundingRate(params: { contract_code?: string }): Promise<{
  status: string;
  ts: number;
  data: {
    estimated_rate: null;
    funding_rate: string;
    contract_code: string;
    symbol: string;
    fee_asset: string;
    funding_time: string;
    next_funding_time: null;
    trade_partition: string;
  }[];
}> {
  return linearSwapNonMarketRequest('GET', `/linear-swap-api/v1/swap_batch_funding_rate`, params);
}

/**
 * 【通用】获取市场最近成交记录
 *
 * 接口权限: 读取
 *
 * 限频: 行情类的公开接口，比如：获取K线数据、获取聚合行情、市场行情、获取行情深度数据、获取溢价指数K线、获取实时预测资金费率k线，获取基差数据、获取市场最近成交记录：
 *
 * （1） restful接口：同一个IP, 所有业务（交割合约、币本位永续合约和U本位合约）总共1秒最多800个请求
 *
 * 接口描述: 该接口支持全仓模式和逐仓模式
 *
 * 请求参数contract_code支持交割合约代码，格式为BTC-USDT-210625；同时支持合约标识，格式为 BTC-USDT（永续）、BTC-USDT-CW（当周）、BTC-USDT-NW（次周）、BTC-USDT-CQ（当季）、BTC-USDT-NQ（次季）。
 *
 * business_type 在查询交割合约数据时为必填参数。且参数值要传：futures 或 all 。
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=8cb73c34-77b5-11ed-9966-0242ac110003
 */
export function getSwapMarketTrade(params: { contract_code?: string; business_type?: string }): Promise<{
  ch: string;
  status: string;
  tick: {
    data: {
      amount: string;
      quantity: string;
      trade_turnover: string;
      ts: number;
      id: number;
      price: string;
      direction: string;
      contract_code: string;
      business_type: string;
      trade_partition: string;
    }[];
    id: number;
    ts: number;
  };
  ts: number;
}> {
  return linearSwapMarketRequest('GET', `/linear-swap-ex/market/trade`, params);
}

/**
 * 获得当前合约的总持仓量
 *
 * https://huobiapi.github.io/docs/usdt_swap/v1/cn/#3218e7531a
 */
export function getSwapOpenInterest(params: {
  contract_code?: string;
  pair?: string;
  contract_type?: string;
  business_type?: string;
}): Promise<{
  status: string;
  data: {
    volume: number;
    amount: number;
    symbol: string;
    value: number;
    contract_code: string;
    trade_amount: number;
    trade_volume: number;
    trade_turnover: number;
    business_type: string;
    pair: string;
    contract_type: string;
  }[];
  ts: number;
}> {
  return linearSwapMarketRequest('GET', '/linear-swap-api/v1/swap_open_interest', params);
}

/**
 * 【通用】获取市场最优挂单
 *
 * 接口权限: 读取
 *
 * 限频: 行情类的公开接口，比如：获取K线数据、获取聚合行情、市场行情、获取行情深度数据、获取溢价指数K线、获取实时预测资金费率k线，获取基差数据、获取市场最近成交记录：
 *
 * （1） restful接口：同一个IP, 所有业务（交割合约、币本位永续合约和U本位合约）总共1秒最多800个请求
 *
 * 接口描述: 该接口支持全仓模式和逐仓模式
 *
 * 请求参数contract_code支持交割合约代码，格式为BTC-USDT-210625；同时支持合约标识，格式为 BTC-USDT（永续）、BTC-USDT-CW（当周）、BTC-USDT-NW（次周）、BTC-USDT-CQ（当季）、BTC-USDT-NQ（次季）。
 *
 * business_type 在查询交割合约数据时为必填参数。且参数值要传：futures 或 all 。
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=8cb735e0-77b5-11ed-9966-0242ac110003
 */
export function getSwapMarketBbo(params: { contract_code?: string }): Promise<{
  status: string;
  ticks: {
    trade_partition: string;
    business_type: string;
    contract_code: string;
    ask: number[] | null;
    bid: number[] | null;
    mrid: number;
    ts: number;
  }[];
  ts: number;
}> {
  return linearSwapMarketRequest('GET', `/linear-swap-ex/market/bbo`, params);
}

/**
 * 获取合约的历史资金费率
 *
 * 接口权限: 读取
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=5d51f1f9-77b6-11ed-9966-0242ac110003
 */
export function getSwapHistoricalFundingRate(params: {
  contract_code: string;
  page_index?: number;
  page_size?: number;
}): Promise<{
  status: string;
  ts: number;
  data: {
    data: {
      symbol: string;
      contract_code: string;
      fee_asset: string;
      funding_time: string;
      funding_rate: string;
      realized_rate: string;
      avg_premium_index: string;
    }[];
    total_page: number;
    current_page: number;
    total_size: number;
  };
}> {
  return linearSwapNonMarketRequest('GET', `/linear-swap-api/v1/swap_historical_funding_rate`, params);
}

/**
 * 【通用】获取K线数据
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=8cb73746-77b5-11ed-9966-0242ac110003
 */
export function getSwapHistoryKline(params: {
  contract_code: string;
  period: string;
  size?: number;
  from?: number;
  to?: number;
}): Promise<{
  status: string;
  ch?: string;
  ts: number;
  data: {
    id: number;
    open: number;
    close: number;
    low: number;
    high: number;
    vol: number;
    amount?: number;
    count?: number;
  }[];
}> {
  return linearSwapMarketRequest('GET', `/linear-swap-ex/market/history/kline`, params);
}

/**
 * 【全仓】获取平台阶梯保证金
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=8cb72290-77b5-11ed-9966-0242ac110003
 */
export function getSwapCrossLadderMargin(params?: {
  contract_code?: string;
  pair?: string;
  contract_type?: string;
  business_type?: string;
}): Promise<{
  status: string;
  data: Array<{ contract_code: string; pair: string; list: Array<{ lever_rate: number }> }>;
}> {
  return linearSwapNonMarketRequest('GET', '/linear-swap-api/v1/swap_cross_ladder_margin', params);
}

/**
 * APIv2币链参考信息
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec478f0-7773-11ed-9966-0242ac110003
 */
export function getV2ReferenceCurrencies(params: { currency?: string; authorizedUser?: string }): Promise<{
  code: number;
  data: {
    currency: string;
    assetType: number;
    chains: {
      chain: string;
      displayName: string;
      fullName: string;
      baseChain?: string;
      baseChainProtocol?: string;
      isDynamic?: boolean;
      numOfConfirmations: number;
      numOfFastConfirmations: number;
      depositStatus: string;
      minDepositAmt: string;
      withdrawStatus: string;
      minWithdrawAmt: string;
      withdrawPrecision: number;
      maxWithdrawAmt: string;
      withdrawQuotaPerDay: string;
      withdrawQuotaPerYear: null;
      withdrawQuotaTotal: null;
      withdrawFeeType: string;
      transactFeeWithdraw?: string;
      addrWithTag: boolean;
      addrDepositTag: boolean;
      minTransactFeeWithdraw?: string;
      transactFeeRateWithdraw?: string;
      maxTransactFeeWithdraw?: string;
    }[];
    instStatus: string;
  }[];
}> {
  return spotNonMarketRequest('GET', '/v2/reference/currencies', params);
}

/**
 * 【现货】获取市场所有交易对的最新行情
 *
 * https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec40374-7773-11ed-9966-0242ac110003
 *
 */
export const getSpotMarketTickers = (): Promise<{
  data: {
    symbol: string;
    open: number;
    high: number;
    low: number;
    close: number;
    amount: number;
    vol: number;
    count: number;
    bid: number;
    bidSize: number;
    ask: number;
    askSize: number;
  }[];
  status: string;
  ts: number;
}> => spotMarketRequest('GET', '/market/tickers');
