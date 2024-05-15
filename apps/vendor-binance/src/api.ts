import { formatTime } from '@yuants/data-model';
// @ts-ignore
import CryptoJS from 'crypto-js';

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
}
