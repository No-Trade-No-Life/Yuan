import { formatTime } from '@yuants/data-model';
// @ts-ignore
import CryptoJS from 'crypto-js';

/**
 * API: https://www.bitget.com/zh-CN/api-doc/common/intro
 */
export class BitgetClient {
  constructor(
    public config: {
      auth?: {
        access_key: string;
        secret_key: string;
        passphrase: string;
      };
    },
  ) {}

  async request(method: string, path: string, params?: any) {
    const url = new URL('https://api.bitget.com');
    url.pathname = path;
    if (method === 'GET' && params !== undefined) {
      const sortedParams = Object.entries(params).sort(([a], [b]) => a.localeCompare(b));
      for (const [k, v] of sortedParams) {
        url.searchParams.set(k, '' + v);
      }
    }
    if (!this.config.auth) {
      console.info(formatTime(Date.now()), method, url.href);
      const res = await fetch(url.href, { method });
      return res.json();
    }
    const timestamp = '' + Date.now();
    const secret_key = this.config.auth.secret_key;
    const body = method === 'GET' ? '' : JSON.stringify(params);
    const signData = timestamp + method + url.pathname + url.search + body;
    const str = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA256(signData, secret_key));

    const headers = {
      'Content-Type': 'application/json',
      'ACCESS-KEY': this.config.auth.access_key!,
      'ACCESS-SIGN': str,
      'ACCESS-TIMESTAMP': timestamp,
      'ACCESS-PASSPHRASE': this.config.auth.passphrase!,
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
   * 资产概览
   *
   * 限速规则: 1次/1s (Uid)
   *
   * https://www.bitget.com/zh-CN/api-doc/common/account/All-Account-Balance
   */
  getAllAccountBalance = (): Promise<{
    code: string;
    msg: string;
    requestTime: number;
    data: {
      accountType: string;
      usdtBalance: string;
    }[];
  }> => this.request('GET', '/api/v2/account/all-account-balance');

  /**
   * 获取账户信息列表
   *
   * 限速规则: 10次/1s (uid)
   *
   * 查询某产品类型下所有账户信息
   *
   * https://www.bitget.com/zh-CN/api-doc/contract/account/Get-Account-List
   */
  getFutureAccounts = (params: {
    productType: string;
  }): Promise<{
    code: string;
    msg: string;
    requestTime: number;
    data: {
      marginCoin: string;
      locked: string;
      available: string;
      crossedMaxAvailable: string;
      isolatedMaxAvailable: string;
      maxTransferOut: string;
      accountEquity: string;
      usdtEquity: string;
      btcEquity: string;
      crossedRiskRate: string;
      unrealizedPL: string;
      coupon: string;
    }[];
  }> => this.request('GET', '/api/v2/mix/account/accounts', params);

  /**
   * 获取合约信息
   *
   * 20次/S 根据ip限频
   *
   * 获取合约详情信息。
   *
   * https://www.bitget.com/zh-CN/api-doc/contract/market/Get-All-Symbols-Contracts
   */
  getMarketContracts = (params: {
    symbol?: string;
    productType: string;
  }): Promise<{
    code: string;
    msg: string;
    requestTime: number;
    data: {
      supportMarginCoins: string[];
      symbol: string;
      baseCoin: string;
      quoteCoin: string;
      buyLimitPriceRatio: string;
      sellLimitPriceRatio: string;
      feeRateUpRatio: string;
      makerFeeRate: string;
      takerFeeRate: string;
      openCostUpRatio: string;
      minTradeNum: string;
      priceEndStep: string;
      volumePlace: string;
      pricePlace: string;
      sizeMultiplier: string;
      symbolType: string;
      minTradeUSDT: string;
      maxSymbolOrderNum: string;
      maxProductOrderNum: string;
      maxPositionNum: string;
      symbolStatus: string;
      offTime: string;
      limitOpenTime: string;
      deliveryTime: string;
      deliveryStartTime: string;
      deliveryPeriod: string;
      launchTime: string;
      fundInterval: string;
      minLever: string;
      maxLever: string;
      posLimit: string;
      maintainTime: string;
    }[];
  }> => this.request('GET', '/api/v2/mix/market/contracts', params);

  /**
   * 获取交易对信息
   * 限速规则 20次/1s (IP)
   *
   * 获取交易对信息，支持单个及全量查询
   *
   * https://www.bitget.com/zh-CN/api-doc/spot/market/Get-Symbols
   */
  getSymbols = (params?: {
    symbol?: string;
  }): Promise<{
    code: string;
    msg: string;
    requestTime: number;
    data: {
      symbol: string;
      baseCoin: string;
      quoteCoin: string;
      minTradeAmount: string;
      maxTradeAmount: string;
      pricePrecision: string;
      quantityPrecision: string;
      quotePrecision: string;
      status: string;
    }[];
  }> => this.request('GET', '/api/v2/mix/market/symbols', params);

  /**
   * 获取支持杠杆的所有交易对
   * 限速规则 10次/1s (IP)
   *
   * https://www.bitget.com/zh-CN/api-doc/margin/common/support-currencies
   */
  getMarginCurrencies = (): Promise<{
    code: string;
    msg: string;
    requestTime: number;
    data: {
      symbol: string;
      baseCoin: string;
      quoteCoin: string;
      maxCrossedLeverage: string;
      maxIsolatedLeverage: string;
      warningRiskRatio: string;
      liquidationRiskRatio: string;
      minTradeAmount: string;
      maxTradeAmount: string;
      takerFeeRate: string;
      makerFeeRate: string;
      pricePrecision: string;
      quantityPrecision: string;
      minTradeUSDT: string;
      isBorrowable: string;
      userMinBorrow: string;
      status: string;
      isIsolatedBaseBorrowable: string;
      isIsolatedQuoteBorrowable: string;
      isCrossBorrowable: string;
    }[];
  }> => this.request('GET', '/api/v2/margin/currencies');

  /**
   *
   * 获取全部合约仓位信息
   * 5次/S 根据uid限频
   *
   * 返回指定productType当前全部的持仓信息
   *
   * 此接口返回数据可能会在以下场景下出现延迟，建议订阅Websocket监控仓位信息：
   * 资金费率结算时
   * 行情波动剧烈
   *
   * https://www.bitget.com/zh-CN/api-doc/contract/position/get-all-position
   */
  getAllPositions = (params: {
    productType: string;
    marginCoin: string;
  }): Promise<{
    code: string;
    msg: string;
    requestTime: number;
    data: {
      symbol: string;
      marginCoin: string;
      holdSide: string;
      openDelegateSize: string;
      marginSize: string;
      available: string;
      locked: string;
      total: string;
      leverage: string;
      achievedProfits: string;
      openPriceAvg: string;
      marginMode: string;
      posMode: string;
      unrealizedPL: string;
      liquidationPrice: string;
      keepMarginRate: string;
      markPrice: string;
      breakEvenPrice: string;
      totalFee: string;
      deductedFee: string;
      cTime: string;
    }[];
  }> => this.request('GET', '/api/v2/mix/position/all-position', params);

  /**
   * 获取单个交易对行情
   *
   * 限速规则: 20次/1s (IP)
   *
   * 获取指定产品类型下，单个交易对的行情数据
   *
   * https://www.bitget.com/zh-CN/api-doc/contract/market/Get-Ticker
   */
  getFutureMarketTicker = (params: {
    symbol: string;
    productType: string;
  }): Promise<{
    code: string;
    msg: string;
    requestTime: number;
    data: {
      symbol: string;
      lastPr: string;
      askPr: string;
      bidPr: string;
      bidSz: string;
      askSz: string;
      high24h: string;
      low24h: string;
      ts: string;
      change24h: string;
      baseVolume: string;
      quoteVolume: string;
      usdtVolume: string;
      openUtc: string;
      changeUtc24h: string;
      indexPrice: string;
      fundingRate: string;
      holdingAmount: string;
      open24h: string;
      deliveryStartTime: string;
      deliveryTime: string;
      deliveryStatus: string;
    }[];
  }> => this.request('GET', '/api/v2/mix/market/ticker', params);

  /**
   * 获取全部交易对行情
   *
   * 限速规则: 20次/1s (IP)
   *
   * 获取指定产品类型下，全部交易对的行情数据
   *
   * https://www.bitget.com/zh-CN/api-doc/contract/market/Get-All-Symbol-Ticker
   */
  getFutureMarketTickers = (params: {
    productType: string;
  }): Promise<{
    code: string;
    msg: string;
    requestTime: number;
    data: {
      symbol: string;
      lastPr: string;
      askPr: string;
      bidPr: string;
      bidSz: string;
      askSz: string;
      high24h: string;
      low24h: string;
      ts: string;
      change24h: string;
      baseVolume: string;
      quoteVolume: string;
      usdtVolume: string;
      openUtc: string;
      changeUtc24h: string;
      indexPrice: string;
      fundingRate: string;
      holdingAmount: string;
      open24h: string;
      deliveryStartTime: string;
      deliveryTime: string;
      deliveryStatus: string;
    }[];
  }> => this.request('GET', '/api/v2/mix/market/tickers', params);

  /**
   * 获取账户信息
   *
   * 限速规则 1次/秒/UID
   *
   * 获取账户信息 (需要现货只读或者读写权限)
   *
   * https://www.bitget.com/zh-CN/api-doc/spot/account/Get-Account-Info
   */
  getAccountInfo = (): Promise<{
    code: string;
    msg: string;
    requestTime: number;
    data: {
      userId: string;
      inviterId: string;
      channelCode: string;
      channel: string;
      ips: string;
      authorities: string[];
      parentId: number;
      traderType: string;
      regisTime: string;
    };
  }> => this.request('GET', '/api/v2/spot/account/info');

  /**
   * 获取平台总持仓量
   *
   * 限速规则: 20次/1s (IP)
   *
   * 获取某交易对在平台的总持仓量
   *
   * https://www.bitget.com/zh-CN/api-doc/contract/market/Get-Open-Interest
   */
  getOpenInterest = (params: {
    symbol: string;
    productType: string;
  }): Promise<{
    code: string;
    msg: string;
    requestTime: number;
    data: {
      openInterestList: {
        symbol: string;
        size: string;
      }[];
      ts: string;
    };
  }> => this.request('GET', '/api/v2/mix/market/open-interest', params);

  getNextFundingTime = (params: {
    symbol: string;
    productType: string;
  }): Promise<{
    code: string;
    msg: string;
    requestTime: number;
    data: {
      symbol: string;
      nextFundingTime: string;
      ratePeriod: string;
    };
  }> => this.request('GET', '/api/v2/mix/market/funding-time', params);
}

// (async () => {
//   const client = new BitgetClient({
//     auth: {
//       access_key: process.env.ACCESS_KEY!,
//       secret_key: process.env.SECRET_KEY!,
//       passphrase: process.env.PASSPHRASE!,
//     },
//   });

//   // console.log(await client.getAccountInfo());
//   // console.log(await client.getAllPositions({ productType: 'USDT-FUTURES', marginCoin: 'USDT' }));
//   console.log(await client.getFutureAccounts({ productType: 'COIN-FUTURES' }));
//   // console.log(await client.getMarketContracts({ productType: 'USDT-FUTURES' }));
//   // console.log(
//   //   JSON.stringify(await client.getOpenInterest({ productType: 'USDT-FUTURES', symbol: 'BTCUSDT' })),
//   // );
//   // console.log(await client.getMarketContracts({ productType: 'USDT-FUTURES' }));
// })();
