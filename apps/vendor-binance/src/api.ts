import { formatTime } from '@yuants/data-model';
import { PromRegistry } from '@yuants/protocol';
// @ts-ignore
import CryptoJS from 'crypto-js';

import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

const MetricBinanceApiUsedWeight = PromRegistry.create('gauge', 'binance_api_used_weight');

interface errorResult {
  code: number;
  msg: string;
}

export const isError = <T>(x: T | errorResult): x is errorResult => (x as errorResult).code !== undefined;

const proxyAgent = new HttpsProxyAgent('http://127.0.0.1:7890');

/**
 * Binance 币安 API
 *
 * https://developers.binance.com/docs/zh-CN/binance-spot-api-docs/CHANGELOG
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
    const str = CryptoJS.enc.Hex.stringify(CryptoJS.HmacSHA256(signData, secret_key));
    url.searchParams.set('signature', str);

    const headers = {
      'Content-Type': 'application/json;charset=utf-8',
      'X-MBX-APIKEY': this.config.auth.public_key!,
    };

    console.info(formatTime(Date.now()), method, url.href, JSON.stringify(headers), body, signData);
    const res = await fetch(url.href, {
      method,
      headers,
      agent: proxyAgent,
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

  /**
   * 查询账户信息(USER_DATA)
   *
   * 查询账户信息
   *
   * 权重: 20
   *
   * https://developers.binance.com/docs/zh-CN/derivatives/portfolio-margin/account/Account-Information
   */
  getUnifiedAccountInfo = (): Promise<
    | {
        uniMMR: string;
        accountEquity: string;
        actualEquity: string;
        accountInitialMargin: string;
        accountMaintMargin: string;
        accountStatus: string;
        virtualMaxWithdrawAmount: string;
        totalAvailableBalance: string;
        totalMarginOpenLoss: string;
        updateTime: number;
      }
    | errorResult
  > => this.request('GET', 'https://papi.binance.com/papi/v1/account');

  /**
   * 获取UM账户信息
   *
   * 现有UM账户资产和仓位信息
   *
   * 权重: 5
   *
   * https://developers.binance.com/docs/zh-CN/derivatives/portfolio-margin/account/Get-UM-Account-Detail
   */
  getUnifiedUmAccount = (): Promise<
    | {
        assets: {
          asset: string;
          crossWalletBalance: string;
          crossUnPnl: string;
          maintMargin: string;
          initialMargin: string;
          positionInitialMargin: string;
          openOrderInitialMargin: string;
          updateTime: number;
        }[];
        positions: {
          symbol: string;
          initialMargin: string;
          maintMargin: string;
          unrealizedProfit: string;
          positionInitialMargin: string;
          openOrderInitialMargin: string;
          leverage: string;
          entryPrice: string;
          maxNotional: string;
          bidNotional: string;
          askNotional: string;
          positionSide: string;
          positionAmt: string;
          updateTime: number;
        }[];
      }
    | errorResult
  > => this.request('GET', 'https://papi.binance.com/papi/v1/um/account');

  /**
   * 查看当前全部UM挂单(USER_DATA)
   *
   * 查看当前全部UM挂单，请小心使用不带symbol参数的调用
   *
   * 权重: 带symbol 1 - 不带 40
   */
  getUnifiedUmOpenOrders = (params?: {
    symbol?: string;
  }): Promise<
    {
      avgPrice: string;
      clientOrderId: string;
      cumQuote: string;
      executedQty: string;
      orderId: number;
      origQty: string;
      origType: string;
      price: string;
      reduceOnly: boolean;
      side: string;
      positionSide: string;
      status: string;
      symbol: string;
      time: number;
      timeInForce: string;
      type: string;
      updateTime: number;
      selfTradePreventionMode: string;
      goodTillDate: number;
    }[]
  > => this.request('GET', 'https://papi.binance.com/papi/v1/um/openOrders', params);

  /**
   * 查询账户余额(USER_DATA)
   *
   * 查询账户余额
   *
   * 权重: 20
   *
   * https://developers.binance.com/docs/zh-CN/derivatives/portfolio-margin/account/Account-Balance
   */
  getUnifiedAccountBalance = (params?: {
    assets?: string;
  }): Promise<
    | {
        asset: string;
        totalWalletBalance: string;
        crossMarginAsset: string;
        crossMarginBorrowed: string;
        crossMarginFree: string;
        crossMarginInterest: string;
        crossMarginLocked: string;
        umWalletBalance: string;
        umUnrealizedPNL: string;
        cmWalletBalance: string;
        cmUnrealizedPNL: string;
        updateTime: number;
      }[]
    | errorResult
  > => this.request('GET', 'https://papi.binance.com/papi/v1/balance', params);

  /**
   * 账户信息 (USER_DATA)
   *
   * 权重: 20
   *
   * https://developers.binance.com/docs/zh-CN/binance-spot-api-docs/rest-api#%E8%B4%A6%E6%88%B7%E4%BF%A1%E6%81%AF-user_data
   */
  getSpotAccountInfo = (params?: {
    omitZeroBalances?: boolean;
  }): Promise<
    | {
        makerCommission: number;
        takerCommission: number;
        buyerCommission: number;
        sellerCommission: number;
        commissionRates: {
          maker: string;
          taker: string;
          buyer: string;
          seller: string;
        };
        canTrade: boolean;
        canWithdraw: boolean;
        canDeposit: boolean;
        brokered: boolean;
        requireSelfTradePrevention: boolean;
        preventSor: boolean;
        updateTime: number;
        balances: {
          asset: string;
          free: string;
          locked: string;
        }[];
        permissions: string[];
        uid: number;
      }
    | errorResult
  > => this.request('GET', 'https://api.binance.com/api/v3/account', params);
}

// (async () => {
//   const client = new ApiClient({
//     auth: {
//       public_key: process.env.ACCESS_KEY!,
//       secret_key: process.env.SECRET_KEY!,
//     },
//   });

//   console.info(JSON.stringify(await client.getUnifiedAccountBalance(), undefined, 2));
// })();
