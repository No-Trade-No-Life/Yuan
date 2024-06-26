import { formatTime } from '@yuants/data-model';
import { PromRegistry } from '@yuants/protocol';
// @ts-ignore
import CryptoJS from 'crypto-js';

const MetricBinanceApiUsedWeight = PromRegistry.create('gauge', 'binance_api_used_weight');

/**
 * Binance 币安 API
 *
 * https://binance-docs.github.io/apidocs/spot/cn/
 */
export class ApiClient {
  constructor(
    public config: {
      auth?: {
        public_key: string;
        secret_key: string;
      };
    },
  ) {}

  async request(method: string, path: string, params: any = {}) {
    const url = new URL(path);
    params.recvWindow = 5000;
    params.timestamp = Date.now();
    if (method === 'GET') {
      for (const key in params) {
        url.searchParams.set(key, params[key]);
      }
    }
    if (!this.config.auth) {
      console.info(formatTime(Date.now()), method, url.href);
      const res = await fetch(url.href, { method });
      console.info(formatTime(Date.now()), 'response', method, url.href, res.status);
      const usedWeight1M = res.headers.get('x-mbx-used-weight-1m');
      if (usedWeight1M) {
        // console.info('usedWeight1M', method, url.href, usedWeight1M);
        MetricBinanceApiUsedWeight.set(+usedWeight1M, {});
      }
      return res.json();
    }
    const secret_key = this.config.auth.secret_key;
    const body = method === 'GET' ? '' : JSON.stringify(params);
    const signData = url.search.slice(1);
    const str = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA256(signData, secret_key));
    url.searchParams.set('signature', str);

    const headers = {
      'Content-Type': 'application/json',
      'X-MBX-APIKEY': this.config.auth.public_key!,
    };

    console.info(formatTime(Date.now()), method, url.href, JSON.stringify(headers), body, signData);
    const res = await fetch(url.href, {
      method,
      headers,
      body: body || undefined,
    });
    const usedWeight1M = res.headers.get('x-mbx-used-weight-1m');
    console.info(formatTime(Date.now()), 'response', method, url.href, res.status);
    if (usedWeight1M) {
      // console.info('usedWeight1M', method, url.href, res.status, usedWeight1M);
      MetricBinanceApiUsedWeight.set(+usedWeight1M, {});
    }
    return res.json();
  }

  /**
   * 获取交易规则和交易对
   *
   * https://binance-docs.github.io/apidocs/futures/cn/#0f3f2d5ee7
   */
  getFutureExchangeInfo = (): Promise<{
    timezone: string;
    serverTime: number;
    futuresType: string;
    rateLimits: {
      rateLimitType: string;
      interval: string;
      intervalNum: number;
      limit: number;
    }[];
    exchangeFilters: any[];
    assets: {
      asset: string;
      marginAvailable: boolean;
      autoAssetExchange: string;
    }[];
    symbols: {
      symbol: string;
      pair: string;
      contractType: string;
      deliveryDate: number;
      onboardDate: number;
      status: string;
      maintMarginPercent: string;
      requiredMarginPercent: string;
      baseAsset: string;
      quoteAsset: string;
      marginAsset: string;
      pricePrecision: number;
      quantityPrecision: number;
      baseAssetPrecision: number;
      quotePrecision: number;
      underlyingType: string;
      underlyingSubType: string[];
      settlePlan: number;
      triggerProtect: string;
      liquidationFee: string;
      marketTakeBound: string;
      maxMoveOrderLimit: number;
      filters: {
        filterType: string;
        maxPrice?: string;
        minPrice?: string;
        tickSize?: string;
        maxQty?: string;
        stepSize?: string;
        minQty?: string;
        limit?: number;
        notional?: string;
        multiplierDecimal?: string;
        multiplierUp?: string;
        multiplierDown?: string;
      }[];
      orderTypes: string[];
      timeInForce: string[];
    }[];
  }> => this.request('GET', 'https://fapi.binance.com/fapi/v1/exchangeInfo');

  /**
   * 查询资金费率历史
   *
   * https://binance-docs.github.io/apidocs/futures/cn/#31dbeb24c4
   */
  getFutureFundingRate = (params: {
    symbol?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): Promise<
    {
      symbol: string;
      fundingTime: number;
      fundingRate: string;
      markPrice: string;
    }[]
  > => this.request('GET', 'https://fapi.binance.com/fapi/v1/fundingRate', params);

  /**
   * 最新标记价格和资金费率
   *
   * 采集各大交易所数据加权平均
   *
   * 权重: 带symbol为1；不带symbol为10
   *
   * https://binance-docs.github.io/apidocs/futures/cn/#69f9b0b2f3
   */
  getFuturePremiumIndex = (params: {
    symbol?: string;
  }): Promise<
    {
      symbol: string;
      markPrice: string;
      indexPrice: string;
      estimatedSettlePrice: string;
      lastFundingRate: string;
      interestRate: string;
      nextFundingTime: number;
      time: number;
    }[]
  > => this.request('GET', 'https://fapi.binance.com/fapi/v1/premiumIndex', params);

  /**
   * 获取未平仓合约数
   *
   * 权重: 1
   *
   * 更新速率: 3s
   *
   * https://binance-docs.github.io/apidocs/futures/cn/#f6cc22e496
   */
  getFutureOpenInterest = (params: {
    symbol: string;
  }): Promise<{
    openInterest: string;
    symbol: string;
    time: number;
  }> => this.request('GET', 'https://fapi.binance.com/fapi/v1/openInterest', params);
}
