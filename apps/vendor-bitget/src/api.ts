import { UUID, formatTime } from '@yuants/utils';
// @ts-ignore
import CryptoJS from 'crypto-js';
import { Subject, filter, firstValueFrom, mergeMap, of, shareReplay, throwError, timeout, timer } from 'rxjs';

/**
 * API: https://www.bitget.com/zh-CN/api-doc/common/intro
 */
export class BitgetClient {
  noAuth = true;
  constructor(
    public config: {
      auth: {
        access_key: string;
        secret_key: string;
        passphrase: string;
      };
    },
  ) {
    if (this.config.auth.access_key && this.config.auth.secret_key && this.config.auth.passphrase) {
      this.noAuth = false;
    }
  }

  async request(method: string, path: string, params?: any) {
    const url = new URL('https://api.bitget.com');
    url.pathname = path;
    if (method === 'GET' && params !== undefined) {
      const sortedParams = Object.entries(params).sort(([a], [b]) => a.localeCompare(b));
      for (const [k, v] of sortedParams) {
        url.searchParams.set(k, '' + v);
      }
    }
    if (this.noAuth) {
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
    const retStr = await res.text();
    try {
      if (process.env.LOG_LEVEL === 'DEBUG') {
        console.debug(formatTime(Date.now()), 'BitgetResponse', path, JSON.stringify(params), retStr);
      }
      return JSON.parse(retStr);
    } catch (e) {
      console.error(formatTime(Date.now()), 'BitgetRequestFailed', path, JSON.stringify(params), retStr);
      throw e;
    }
  }

  mapPathToRequestChannel: Record<
    string,
    {
      requestQueue: Array<{
        trace_id: string;
        method: string;
        path: string;
        params?: any;
      }>;
      responseChannel: Subject<{ trace_id: string; response?: any; error?: Error }>;
    }
  > = {};

  setupChannel(path: string, period: number, limit: number) {
    this.mapPathToRequestChannel[path] = {
      requestQueue: [],
      responseChannel: new Subject(),
    };

    const { requestQueue, responseChannel } = this.mapPathToRequestChannel[path];
    timer(0, period)
      .pipe(
        filter(() => requestQueue.length > 0),
        mergeMap(() => requestQueue.splice(0, limit)),
        mergeMap(async (request) => {
          try {
            const res = await this.request(request.method, request.path, request.params);
            return { trace_id: request.trace_id, response: res };
          } catch (error) {
            return { trace_id: request.trace_id, error };
          }
        }),
      )
      .subscribe(responseChannel);
  }

  async requestWithFlowControl(
    method: string,
    path: string,
    flowControl: { period: number; limit: number } = { period: 10, limit: Infinity },
    params?: any,
  ) {
    const { period, limit } = flowControl;
    if (!this.mapPathToRequestChannel[path]) {
      this.setupChannel(path, period, limit);
    }
    const uuid = UUID();

    const { requestQueue, responseChannel } = this.mapPathToRequestChannel[path];
    const res$ = responseChannel.pipe(
      //
      filter((response) => response.trace_id === uuid),
      mergeMap((response) => (response.error ? throwError(() => response.error) : of(response))),
      timeout(30_000),
      shareReplay(1),
    );
    requestQueue.push({ trace_id: uuid, method, path, params });
    return (await firstValueFrom(res$)).response;
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

  /**
   * 获取下次资金费结算时间
   *
   * 限速规则: 20次/1s (IP)
   *
   * 获取合约下一次的结算时间以及该合约的结算周期
   *
   * https://www.bitget.com/zh-CN/api-doc/contract/market/Get-Symbol-Next-Funding-Time
   */
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
    }[];
  }> =>
    this.requestWithFlowControl(
      'GET',
      '/api/v2/mix/market/funding-time',
      { period: 1000, limit: 20 },
      params,
    );

  /**
   * 下单
   *
   * 普通用户:限速10次/秒，根据uid限频
   *
   * 跟单交易员:限速1次/秒，根据uid限频
   *
   * https://www.bitget.com/zh-CN/api-doc/contract/trade/Place-Order
   */
  postFuturePlaceOrder = (params: {
    symbol: string;
    productType: string;
    marginMode: string;
    marginCoin: string;
    size: string;
    price?: string;
    side: string;
    tradeSide?: string;
    orderType: string;
    force?: string;
    clientOid?: string;
    reduceOnly?: string;
    presetStopSurplusPrice?: string;
    presetStopLossPrice?: string;
  }): Promise<{
    code: string;
    msg: string;
    requestTime: number;
    data: {
      orderId: string;
      clientOid: string;
    };
  }> => this.request('POST', '/api/v2/mix/order/place-order', params);

  /**
   * 撤单
   *
   * 限速规则: 10次/1s
   *
   * https://www.bitget.com/zh-CN/api-doc/contract/trade/Cancel-Order
   */
  postFutureCancelOrder = (params: {
    symbol: string;
    productType: string;
    marginCoin?: string;
    orderId?: string;
    clientOid?: string;
  }): Promise<{
    code: string;
    msg: string;
    requestTime: number;
    data: {
      orderId: string;
      clientOid: string;
    };
  }> => this.request('POST', '/api/v2/mix/order/cancel-order', params);

  /**
   * 划转
   *
   * 限速规则 10次/1s (UID)
   *
   * 资产划转
   *
   * https://www.bitget.com/zh-CN/api-doc/spot/account/Wallet-Transfer
   */
  postTransfer = (params: {
    fromType: string;
    toType: string;
    amount: string;
    coin: string;
    symbol?: string;
    clientOid?: string;
  }): Promise<{
    code: string;
    msg: string;
    requestTime: number;
    data: {
      transferId: string;
      clientOid: string;
    };
  }> => this.request('POST', '/api/v2/spot/wallet/transfer', params);

  /**
   * 子母账户划转
   *
   * 限速规则 20次/1s (UID)
   *
   * 子母账户资产划转，该接口支持的划转类型包括
   *
   * 母账户转子账户（仅母账户APIKey有权限）
   * 子账户转母账户（仅母账户APIKey有权限）
   * 子账户转子账户（仅母账户APIKey有权限，并要求发起与接收方子账户归属于同一母账户）
   * 子账户内部划转（仅母账户APIKey有权限，并要求发起与接收方子账户为同一子账户）
   * 请求参数中的转入及转出账户UID须为母子/兄弟关系，且所有转账操作均只有母账户才有操作权限
   *
   * https://www.bitget.com/zh-CN/api-doc/spot/account/Sub-Transfer
   */
  postSubAccountTransfer = (params: {
    fromType: string;
    toType: string;
    amount: string;
    coin: string;
    symbol?: string;
    clientOid?: string;
    fromUserId: string;
    toUserId: string;
  }): Promise<{
    code: string;
    msg: string;
    requestTime: number;
    data: {
      transferId: string;
      clientOid: string;
    };
  }> => this.request('POST', '/api/v2/spot/wallet/subaccount-transfer', params);

  /**
   * 提币
   *
   * 限速规则 5次/1s (UID)
   *
   * 提币接口 包括链上提币和内部提币。(需要在网页端添加地址到地址簿中)
   *
   * https://www.bitget.com/zh-CN/api-doc/spot/account/Wallet-Withdrawal
   */
  postWithdraw = (params: {
    coin: string;
    transferType: string;
    address: string;
    chain: string;
    innerToType?: string;
    areaCode?: string;
    tag?: string;
    size: string;
    remark?: string;
    clientOid?: string;
  }): Promise<{
    code: string;
    msg: string;
    requestTime: number;
    data: {
      orderId: string;
      clientOid: string;
    };
  }> => this.request('POST', '/api/v2/spot/wallet/withdrawal', params);

  /**
   * 获取充币地址
   *
   * 限速规则 10 次/1s (UID)
   *
   * 获取当前账号充币地址
   *
   * https://www.bitget.com/zh-CN/api-doc/spot/account/Get-Deposit-Address
   */
  getDepositAddress = (params: {
    coin: string;
    chain?: string;
  }): Promise<{
    code: string;
    msg: string;
    requestTime: number;
    data: {
      address: string;
      chain: string;
      coin: string;
      tag: string;
      url: string;
    };
  }> => this.request('GET', '/api/v2/spot/wallet/deposit-address', params);

  /**
   * 获取提币记录
   *
   * 限速规则 10次/1s (UID)
   *
   * 获取提币记录
   *
   * https://www.bitget.com/zh-CN/api-doc/spot/account/Get-Withdraw-Record
   */
  getWithdrawalRecords = (params: {
    coin?: string;
    clientOid?: string;
    orderId?: string;
    startTime: string;
    endTime: string;
    idLessThan?: string;
    limit?: string;
  }): Promise<{
    code: string;
    msg: string;
    requestTime: number;
    data: {
      orderId: string;
      tradeId: string;
      coin: string;
      clientOid: string;
      type: string;
      dest: string;
      size: string;
      status: string;
      fromAddress: string;
      toAddress: string;
      fee: string;
      chain: string;
      confirm: string;
      tag: string;
      cTime: string;
      uTime: string;
    }[];
  }> => this.request('GET', '/api/v2/spot/wallet/withdrawal-records', params);

  /**
   * 获取充币记录
   *
   * 限速规则 10次/1s (UID)
   *
   * 获取充币记录(不包含法币充值)
   *
   * https://www.bitget.com/zh-CN/api-doc/spot/account/Get-Deposit-Record
   */
  getDepositRecords = (params: {
    coin?: string;
    orderId?: string;
    startTime: string;
    endTime: string;
    idLessThan?: string;
    limit?: string;
  }): Promise<{
    code: string;
    msg: string;
    requestTime: number;
    data: {
      orderId: string;
      tradeId: string;
      coin: string;
      type: string;
      dest: string;
      size: string;
      status: string;
      fromAddress: string;
      toAddress: string;
      chain: string;
      cTime: string;
      uTime: string;
    }[];
  }> => this.request('GET', '/api/v2/spot/wallet/deposit-records', params);

  /**
   * 获取历史资金费率
   *
   * 限速规则: 20次/1s (IP)
   *
   * 获取合约的历史资金费率
   *
   * https://www.bitget.com/zh-CN/api-doc/contract/market/Get-History-Funding-Rate
   */
  getHistoricalFundingRate = (params: {
    symbol: string;
    productType: string;
    pageSize?: string;
    pageNo?: string;
  }): Promise<{
    code: string;
    msg: string;
    requestTime: number;
    data: {
      symbol: string;
      fundingRate: string;
      fundingTime: string;
    }[];
  }> =>
    this.requestWithFlowControl(
      'GET',
      '/api/v2/mix/market/history-fund-rate',
      { period: 1000, limit: 20 },
      params,
    );

  /**
   * 获取账户现货资产
   *
   * 限速规则 10次/1s (UID)
   *
   * 获取账户币种资产
   *
   * https://www.bitget.com/zh-CN/api-doc/spot/account/Get-Account-Assets
   */
  getSpotAssets = (params?: {
    coin?: string;
    assetType?: string;
  }): Promise<{
    code: string;
    msg: string;
    requestTime: number;
    data: {
      coin: string;
      available: string;
      frozen: string;
      locked: string;
      limitAvailable: string;
      uTime: string;
    }[];
  }> => this.request('GET', '/api/v2/spot/account/assets', params);

  /**
   * 获取所有子账户现货资产
   *
   * 限速规则 10次/1s (UID)
   *
   * 获取所有子账户现货资产。仅限非代理商(非ND Broker)用户调用。
   *
   * https://www.bitget.com/zh-CN/api-doc/spot/account/Get-Subaccount-Assets
   */
  getSubAccountSpotAssets = (): Promise<{
    code: string;
    msg: string;
    requestTime: number;
    data: {
      userId: string;
      assetsList: {
        coin: string;
        available: string;
        limitAvailable: string;
        frozen: string;
        locked: string;
        uTime: string;
      }[];
    };
  }> => this.request('GET', '/api/v2/spot/account/subaccount-assets');

  /**
   * 查询子账户列表
   *
   * 限速规则 1次/1s (UID)
   *
   * 查询子账户列表
   *
   * https://www.bitget.com/zh-CN/api-doc/common/vsubaccount/Get-Virtual-Subaccount-List
   */
  getVirtualSubAccountList = (params?: {
    status?: string;
    limit?: string;
    idLessThan?: string;
  }): Promise<{
    code: string;
    msg: string;
    requestTime: number;
    data: {
      subAccountList: {
        subAccountUid: string;
        subAccountName: string;
        label: string;
        status: string;
        permList: string;
        accountType: string;
        bindingTime: string;
        cTime: string;
        uTime: string;
      }[];
      endId: string;
    };
  }> => this.request('GET', '/api/v2/user/virtual-subaccount-list', params);

  /**
   * 获取财务记录
   *
   * 限速规则 20次/1s (UID)
   *
   * 获取财务记录
   *
   * https://www.bitget.com/zh-CN/api-doc/uta/account/Get-Financial-Records
   */
  getAccountFinancialRecord = (params?: {
    category: string;
    coin?: string;
    type?: string;
    startTime?: string;
    endTime?: string;
    limit?: string;
    cursor?: string;
  }): Promise<{
    code: string;
    msg: string;
    requestTime: number;
    data: {
      list: {
        category: string;
        id: string;
        symbol: string;
        coin: string;
        type: string;
        amount: string;
        fee: string;
        balance: string;
        ts: string;
      }[];
      cursor: string;
    };
  }> => this.request('GET', '/api/v3/account/financial-records', params);
}

export const client = new BitgetClient({
  auth: {
    access_key: process.env.ACCESS_KEY!,
    secret_key: process.env.SECRET_KEY!,
    passphrase: process.env.PASSPHRASE!,
  },
});
