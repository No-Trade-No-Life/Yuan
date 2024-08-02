import { formatTime } from '@yuants/data-model';
import { PromRegistry } from '@yuants/protocol';
// @ts-ignore
import CryptoJS from 'crypto-js';

const MetricBinanceApiUsedWeight = PromRegistry.create('gauge', 'binance_api_used_weight');

interface errorResult {
  code: number;
  msg: string;
}

export const isError = <T>(x: T | errorResult): x is errorResult => (x as errorResult).code !== undefined;

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
    for (const key in params) {
      if (params[key] === undefined) continue;
      url.searchParams.set(key, params[key]);
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
    const signData = url.search.slice(1);
    const str = CryptoJS.enc.Hex.stringify(CryptoJS.HmacSHA256(signData, secret_key));
    url.searchParams.set('signature', str);

    const headers = {
      'Content-Type': 'application/json;charset=utf-8',
      'X-MBX-APIKEY': this.config.auth.public_key!,
    };

    console.info(
      formatTime(Date.now()),
      method,
      url.href,
      JSON.stringify(headers),
      url.searchParams.toString(),
      signData,
    );
    const res = await fetch(url.href, {
      method,
      headers,
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

  /**
   * 用户万向划转(USER_DATA)
   *
   * 用户万向划转
   *
   * 您需要开通api key 允许万向划转权限来调用此接口。
   *
   * 权重: 900
   *
   * https://developers.binance.com/docs/zh-CN/wallet/asset/user-universal-transfer
   */
  postAssetTransfer = (params: {
    type: string;
    asset: string;
    amount: number;
    fromSymbol?: string;
    toSymbol?: string;
  }): Promise<
    | {
        tranId: number;
      }
    | errorResult
  > => this.request('POST', 'https://api.binance.com/sapi/v1/asset/transfer', params);

  /**
   * 统一账户资金归集(TRADE)
   *
   * 资金归集到统一账户钱包
   *
   * 权重: 750
   *
   * https://developers.binance.com/docs/zh-CN/derivatives/portfolio-margin/account/Fund-Auto-collection
   *
   * ISSUE(2024-07-18): 目前这是唯一能够将资金从原 U 本位合约账户转入统一账户的接口。
   */
  postUnifiedAccountAutoCollection = (): Promise<{
    msg: string;
  }> => this.request('POST', 'https://papi.binance.com/papi/v1/auto-collection');

  /**
   * 获取充值地址(支持多网络)(USER_DATA)
   *
   * 获取充值地址
   *
   * 权重: 10
   *
   * https://developers.binance.com/docs/zh-CN/wallet/capital/deposite-address
   */
  getDepositAddress = (params: {
    coin: string;
    network?: string;
    amount?: number;
  }): Promise<{
    address: string;
    coin: string;
    tag: string;
    url: string;
  }> => this.request('GET', 'https://api.binance.com/sapi/v1/capital/deposit/address', params);

  /**
   * 查询子账户列表(适用主账户)
   *
   * 权重: 1
   *
   * https://developers.binance.com/docs/zh-CN/sub_account/account-management/Query-Sub-account-List
   */
  getSubAccountList = (params?: {
    email?: string;
    isFreeze?: number;
    page?: number;
    limit?: number;
  }): Promise<
    | {
        subAccounts: {
          email: string;
          isFreeze: boolean;
          createTime: number;
          isManagedSubAccount: boolean;
          isAssetManagementSubAccount: boolean;
        }[];
      }
    | errorResult
  > => this.request('GET', 'https://api.binance.com/sapi/v1/sub-account/list');

  /**
   * 提币(USER_DATA)
   *
   * 权重: 600
   *
   * https://developers.binance.com/docs/zh-CN/wallet/capital/withdraw
   */
  postWithdraw = (
    params:
      | {
          coin: string;
          withdrawOrderId?: string;
          network?: string;
          address: string;
          addressTag?: string;
          amount: number;
          transactionFeeFlag?: boolean;
          name?: string;
          walletType?: number;
        }
      | errorResult,
  ): Promise<{
    id: string;
  }> => this.request('POST', 'https://api.binance.com/sapi/v1/capital/withdraw/apply', params);

  /**
   * 获取提币历史(支持多网络)(USER_DATA)
   *
   * 获取提币历史 (支持多网络)
   *
   * 请求权重(IP)#
   * 18000 请求限制: 每秒10次
   *
   * 本接口特别采用每秒UID速率限制，用户的总秒级 UID 速率限制为180000/秒。从该接口收到的响应包含key X-SAPI-USED-UID-WEIGHT-1S，该key定义了当前 UID 使用的权重
   *
   * https://developers.binance.com/docs/zh-CN/wallet/capital/withdraw-history
   */
  getWithdrawHistory = (params?: {
    coin?: string;
    withdrawOrderId?: string;
    status?: number;
    offset?: number;
    limit?: number;
    startTime?: number;
    endTime?: number;
  }): Promise<
    {
      id: string;
      amount: string;
      transactionFee: string;
      coin: string;
      status: number;
      address: string;
      txId: string;
      applyTime: Date;
      network: string;
      transferType: number;
      info: string;
      confirmNo: number;
      walletType: number;
      txKey: string;
      completeTime: Date;
    }[]
  > => this.request('GET', 'https://api.binance.com/sapi/v1/capital/withdraw/history', params);

  /**
   * 获取充值历史(支持多网络)
   *
   * 权重: 1
   *
   * https://developers.binance.com/docs/zh-CN/wallet/capital/deposite-history
   */
  getDepositHistory = (params?: {
    includeSource?: boolean;
    coin?: string;
    status?: number;
    startTime?: number;
    endTime?: number;
    offset?: number;
    limit?: number;
    txId?: string;
  }): Promise<
    {
      id: string;
      amount: string;
      coin: string;
      network: string;
      status: number;
      address: string;
      addressTag: string;
      txId: string;
      insertTime: number;
      transferType: number;
      confirmTimes: string;
      unlockConfirm: number;
      walletType: number;
    }[]
  > => this.request('GET', 'https://api.binance.com/sapi/v1/capital/deposit/hisrec', params);

  /**
   * UM下单(TRADE)
   *
   * 权重: 1
   *
   * https://developers.binance.com/docs/zh-CN/derivatives/portfolio-margin/trade/New-UM-Order
   */
  postUmOrder = (params: {
    symbol: string;
    side: string;
    positionSide?: string;
    type: string;
    timeInForce?: string;
    quantity: number;
    reduceOnly?: string;
    price?: number;
    newClientOrderId?: string;
    newOrderRespType?: string;
    selfTradePreventionMode?: string;
    goodTillDate?: number;
  }): Promise<
    | {
        clientOrderId: string;
        cumQty: string;
        cumQuote: string;
        executedQty: string;
        orderId: number;
        avgPrice: string;
        origQty: string;
        price: string;
        reduceOnly: boolean;
        side: string;
        positionSide: string;
        status: string;
        symbol: string;
        timeInForce: string;
        type: string;
        selfTradePreventionMode: string;
        goodTillDate: number;
        updateTime: number;
      }
    | errorResult
  > => this.request('POST', 'https://papi.binance.com/papi/v1/um/order', params);

  /**
   * 获取所有全仓杠杆交易对(MARKET_DATA)
   *
   * 权重: 1
   *
   * https://developers.binance.com/docs/zh-CN/margin_trading/market-data/Get-All-Cross-Margin-Pairs
   */
  getMarginAllPairs = (params?: {
    symbol?: string;
  }): Promise<
    {
      id: string;
      symbol: string;
      base: string;
      quote: string;
      isMarginTrade: boolean;
      isBuyAllowed: boolean;
      isSellAllowed: boolean;
    }[]
  > => this.request('GET', 'https://api.binance.com/sapi/v1/margin/allPairs', params);
}
