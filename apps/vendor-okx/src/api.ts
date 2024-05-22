import { formatTime } from '@yuants/data-model';
// @ts-ignore
import CryptoJS from 'crypto-js';

/**
 * API v5: https://www.okx.com/docs-v5/#overview
 */
export class OkxClient {
  constructor(
    public config: {
      auth?: {
        public_key: string;
        secret_key: string;
        passphrase: string;
      };
    },
  ) {}

  async request(method: string, path: string, params?: any) {
    const url = new URL('https://www.okx.com');
    url.pathname = path;
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
    const timestamp = formatTime(Date.now(), 'UTC').replace(' ', 'T');
    const secret_key = this.config.auth.secret_key;
    const body = method === 'GET' ? '' : JSON.stringify(params);
    const signData = timestamp + method + url.pathname + url.search + body;
    const str = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA256(signData, secret_key));

    const headers = {
      'Content-Type': 'application/json',
      'OK-ACCESS-KEY': this.config.auth.public_key!,
      'OK-ACCESS-SIGN': str,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': this.config.auth.passphrase,
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
   * 获取所有产品行情信息
   *
   * 获取产品行情信息
   *
   * 限速：20次/2s
   * 限速规则：IP
   *
   * https://www.okx.com/docs-v5/zh/#order-book-trading-market-data-get-tickers
   */
  getMarketTickers = (params: {
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
  }> => this.request('GET', '/api/v5/market/tickers', params);

  /**
   * 获取账户资产估值
   *
   * 查看账户资产估值
   *
   * 限速：1次/s
   * 限速规则：UserID
   *
   * https://www.okx.com/docs-v5/zh/#funding-account-rest-api-get-account-asset-valuation
   */
  getAssetValuation = (params?: {
    ccy?: string;
  }): Promise<{
    code: string;
    msg: string;
    data: Array<{
      details: {
        classic: string;
        earn: string;
        funding: string;
        trading: string;
      };
      totalBal: string;
      ts: string;
    }>;
  }> => this.request('GET', '/api/v5/asset/asset-valuation', params);

  /**
   * 查看账户配置
   * 查看当前账户的配置信息。
   *
   * 限速：5次/2s
   * 限速规则：UserID
   *
   * https://www.okx.com/docs-v5/zh/#trading-account-rest-api-get-account-configuration
   */
  getAccountConfig = (): Promise<{
    code: string;
    data: Array<{
      acctLv: string;
      autoLoan: boolean;
      ctIsoMode: string;
      greeksType: string;
      level: string;
      levelTmp: string;
      mgnIsoMode: string;
      posMode: string;
      spotOffsetType: string;
      uid: string;
      label: string;
      roleType: string;
      traderInsts: any[];
      spotRoleType: string;
      spotTraderInsts: any[];
      opAuth: string;
      kycLv: string;
      ip: string;
      perm: string;
      mainUid: string;
    }>;
    msg: string;
  }> => this.request('GET', '/api/v5/account/config');

  /**
   * 获取市场借币杠杆利率和借币限额
   *
   * 限速：2次/2s
   * 限速规则：IP
   *
   * https://www.okx.com/docs-v5/zh/#public-data-rest-api-get-interest-rate-and-loan-quota
   */
  getInterestRateLoanQuota = (): Promise<{
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
  }> => this.request('GET', '/api/v5/public/interest-rate-loan-quota');

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
  getInstruments = (params: {
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
  }> => this.request('GET', '/api/v5/public/instruments', params);

  /**
   * 获取永续合约当前资金费率
   * 获取当前资金费率
   *
   * 限速：20次/2s
   * 限速规则：IP +instrumentID
   *
   * https://www.okx.com/docs-v5/zh/#public-data-rest-api-get-funding-rate
   */
  getFundingRate = (params: {
    instId?: string;
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
  }> => this.request('GET', '/api/v5/public/funding-rate', params);

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
  getFundingRateHistory = (params: {
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
  }> => this.request('GET', '/api/v5/public/funding-rate-history', params);

  /**
   * 获取余币宝余额
   *
   * 限速：6次/s
   * 限速规则：UserID
   *
   * https://www.okx.com/docs-v5/zh/#financial-product-savings-get-saving-balance
   */
  getFinanceSavingsBalance = (params: {
    ccy?: string;
  }): Promise<{
    code: string;
    msg: string;
    data: {
      earnings: string;
      redemptAmt: string;
      rate: string;
      ccy: string;
      amt: string;
      loanAmt: string;
      pendingAmt: string;
    }[];
  }> => this.request('GET', '/api/v5/finance/savings/balance', params);

  /**
   * GET / 获取市场借贷历史（公共）
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
  getLendingRateHistory = (params: {
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
  }> => this.request('GET', '/api/v5/finance/savings/lending-rate-history', params);

  /**
   * 提币
   *
   * 用户提币。普通子账户不支持提币。
   *
   * API只能提币到免认证地址/账户上，通过 WEB/APP 可以设置免认证地址。
   *
   * 关于标签：某些币种如XRP充币时同时需要一个充值地址和标签（又名memo/payment_id），标签是一种保证您的充币地址唯一性的数字串，与充币地址成对出现并一一对应。请您务必遵守正确的充值步骤，在提币时输入完整信息，否则将面临丢失币的风险！
   * 对于有标签的币种，如果是OKX用户间的提币，请走内部转账不要走链上提币。
   *
   * 限速：6次/s
   * 限速规则：UserID
   *
   * https://www.okx.com/docs-v5/zh/#funding-account-rest-api-withdrawal
   */
  postAssetWithdrawal = (params: {
    amt: string;
    fee: string;
    dest: string;
    ccy: string;
    chain?: string;
    toAddr: string;
    clientId?: string;
    rcvrInfo?: {
      walletType: string;
      exchId: string;
      rcvrFirstName: string;
      rcvrLastName: string;
    };
  }): Promise<{
    code: string;
    msg: string;
    data: Array<{
      amt: string;
      wdId: string;
      ccy: string;
      clientId: string;
      chain: string;
    }>;
  }> => this.request('POST', '/api/v5/asset/withdrawal', params);

  /**
   * 获取充值地址信息
   *
   * 获取各个币种的充值地址，包括曾使用过的老地址。
   *
   * 限速：6次/s
   * 限速规则：UserID
   *
   * https://www.okx.com/docs-v5/zh/#funding-account-rest-api-get-deposit-address
   */
  getAssetDepositAddress = (params: {
    ccy: string;
  }): Promise<{
    code: string;
    data: {
      chain: string;
      ctAddr: string;
      ccy: string;
      to: string;
      addr: string;
      verifiedName: string;
      selected: boolean;
    }[];
    msg: string;
  }> => this.request('GET', '/api/v5/asset/deposit-address', params);

  /**
   * 获取提币记录
   *
   * 根据币种，提币状态，时间范围获取提币记录，按照时间倒序排列，默认返回100条数据。
   * 支持Websocket订阅，参考 提币信息频道。
   *
   * 限速：6 次/s
   * 限速规则：UserID
   *
   * https://www.okx.com/docs-v5/zh/#funding-account-rest-api-get-withdrawal-history
   */
  getAssetWithdrawalHistory = (params: {
    ccy?: string;
    wdId?: string;
    clientId?: string;
    txId?: string;
    type?: string;
    state?: string;
    after?: string;
    before?: string;
    limit?: string;
  }): Promise<{
    code: string;
    msg: string;
    data: {
      chain: string;
      fee: string;
      feeCcy: string;
      ccy: string;
      clientId: string;
      amt: string;
      txId: string;
      from: string;
      areaCodeFrom: string;
      to: string;
      areaCodeTo: string;
      state: string;
      ts: string;
      nonTradableAsset: boolean;
      wdId: string;
    }[];
  }> => this.request('GET', '/api/v5/asset/withdrawal-history', params);

  /**
   * 获取充值记录
   *
   * 根据币种，充值状态，时间范围获取充值记录，按照时间倒序排列，默认返回 100 条数据。
   * 支持Websocket订阅，参考 充值信息频道。
   *
   * 限速：6次/s
   * 限速规则：UserID
   *
   * https://www.okx.com/docs-v5/zh/#funding-account-rest-api-get-deposit-history
   */
  getAssetDepositHistory = (params: {
    ccy?: string;
    depId?: string;
    state?: string;
    fromWdId?: string;
    txId?: string;
    type?: string;
    after?: string;
    before?: string;
    limit?: string;
  }): Promise<{
    code: string;
    msg: string;
    data: {
      actualDepBlkConfirm: string;
      amt: string;
      areaCodeFrom: string;
      ccy: string;
      chain: string;
      depId: string;
      from: string;
      fromWdId: string;
      state: string;
      to: string;
      ts: string;
      txId: string;
    }[];
  }> => this.request('GET', '/api/v5/asset/deposit-history', params);

  /**
   * 获取资金账户余额
   *
   * 获取资金账户所有资产列表，查询各币种的余额、冻结和可用等信息。
   *
   * 只返回余额大于0的币资产信息。
   *
   * 限速：6次/s
   * 限速规则：UserID
   *
   * https://www.okx.com/docs-v5/zh/#funding-account-rest-api-get-balance
   */
  getAssetBalances = (params: {
    ccy?: string;
  }): Promise<{
    code: string;
    msg: string;
    data: {
      availBal: string;
      bal: string;
      ccy: string;
      frozenBal: string;
    }[];
  }> => this.request('GET', '/api/v5/asset/balances', params);

  /**
   * 资金划转
   *
   * 调用时，API Key 需要有交易权限。
   *
   * 支持母账户的资金账户划转到交易账户，母账户到子账户的资金账户和交易账户划转。
   *
   * 子账户默认可转出至母账户，划转到同一母账户下的其他子账户，需要先调用 设置子账户主动转出权限 接口进行授权。
   *
   * 请求失败不代表划转失败，建议以获取资金划转状态接口返回的状态为准。
   *
   * 限速：2 次/s
   * 限速规则：UserID + Currency
   *
   * https://www.okx.com/docs-v5/zh/#funding-account-rest-api-funds-transfer
   */
  postAssetTransfer = (params: {
    ccy: string;
    type?: string;
    amt: string;
    from: string;
    to: string;
    subAcct?: string;
    loanTrans?: boolean;
    omitPosRisk?: string;
    clientId?: string;
  }): Promise<{
    code: string;
    msg: string;
    data: {
      transId: string;
      ccy: string;
      clientId: string;
      from: string;
      amt: string;
      to: string;
    }[];
  }> => this.request('POST', '/api/v5/asset/transfer', params);

  /**
   * 查看账户余额
   *
   * 获取交易账户中资金余额信息。
   *
   * 免息额度和折算率都是公共数据，不在账户接口内展示
   *
   * 限速：10次/2s
   * 限速规则：UserID
   *
   * https://www.okx.com/docs-v5/zh/#trading-account-rest-api-get-balance
   */
  getAccountBalance = (params: {
    ccy?: string;
  }): Promise<{
    code: string;
    data: {
      adjEq: string;
      borrowFroz: string;
      details: {
        availBal: string;
        availEq: string;
        borrowFroz: string;
        cashBal: string;
        ccy: string;
        crossLiab: string;
        disEq: string;
        eq: string;
        eqUsd: string;
        fixedBal: string;
        frozenBal: string;
        imr: string;
        interest: string;
        isoEq: string;
        isoLiab: string;
        isoUpl: string;
        liab: string;
        maxLoan: string;
        mgnRatio: string;
        mmr: string;
        notionalLever: string;
        ordFrozen: string;
        rewardBal: string;
        spotInUseAmt: string;
        spotIsoBal: string;
        stgyEq: string;
        twap: string;
        uTime: string;
        upl: string;
        uplLiab: string;
      }[];
      imr: string;
      isoEq: string;
      mgnRatio: string;
      mmr: string;
      notionalUsd: string;
      ordFroz: string;
      totalEq: string;
      uTime: string;
      upl: string;
    }[];
    msg: string;
  }> => this.request('GET', '/api/v5/account/balance', params);

  /**
   * 查看持仓信息
   *
   * 获取该账户下拥有实际持仓的信息。账户为买卖模式会显示净持仓（net），账户为开平仓模式下会分别返回开多（long）或开空（short）的仓位。按照仓位创建时间倒序排列。
   *
   * 如果该 instId 拥有过仓位且当前持仓量为0，传 instId 时，如果当前存在有效的posId，会返回仓位信息，如果当前不存在有效的 posId 时，不会返回仓位信息；不传 instId 时，仓位信息不返回。
   *
   * 逐仓交易设置中，如果设置为自主划转模式，逐仓转入保证金后，会生成一个持仓量为0的仓位
   *
   * 限速：10次/2s
   * 限速规则：UserID
   *
   * https://www.okx.com/docs-v5/zh/#trading-account-rest-api-get-positions
   */
  getAccountPositions = (params: {
    instType?: string;
    instId?: string;
    posId?: string;
  }): Promise<{
    code: string;
    msg: string;
    data: {
      adl: string;
      availPos: string;
      avgPx: string;
      cTime: string;
      ccy: string;
      deltaBS: string;
      deltaPA: string;
      gammaBS: string;
      gammaPA: string;
      imr: string;
      instId: string;
      instType: string;
      interest: string;
      idxPx: string;
      last: string;
      usdPx: string;
      bePx: string;
      lever: string;
      liab: string;
      liabCcy: string;
      liqPx: string;
      markPx: string;
      margin: string;
      mgnMode: string;
      mgnRatio: string;
      mmr: string;
      notionalUsd: string;
      optVal: string;
      pTime: string;
      pos: string;
      posCcy: string;
      posId: string;
      posSide: string;
      spotInUseAmt: string;
      spotInUseCcy: string;
      thetaBS: string;
      thetaPA: string;
      tradeId: string;
      bizRefId: string;
      bizRefType: string;
      quoteBal: string;
      baseBal: string;
      baseBorrowed: string;
      baseInterest: string;
      quoteBorrowed: string;
      quoteInterest: string;
      uTime: string;
      upl: string;
      uplLastPx: string;
      uplRatio: string;
      uplRatioLastPx: string;
      vegaBS: string;
      vegaPA: string;
      realizedPnl: string;
      pnl: string;
      fee: string;
      fundingFee: string;
      liqPenalty: string;
      closeOrderAlgo: {
        algoId: string;
        slTriggerPx: string;
        slTriggerPxType: string;
        tpTriggerPx: string;
        tpTriggerPxType: string;
        closeFraction: string;
      }[];
    }[];
  }> => this.request('GET', '/api/v5/account/positions', params);

  /**
   * 赚币
   * GET / 查看项目
   *
   * 限速：3次/s
   * 限速规则：UserID
   */
  getFinanceStakingDeFiOffers = (params: {
    productId?: string;
    protocolType?: string;
    ccy?: string;
  }): Promise<{
    code: string;
    msg: string;
    data: {
      ccy: string;
      productId: string;
      protocol: string;
      protocolType: string;
      term: string;
      apy: string;
      earlyRedeem: boolean;
      investData: {
        ccy: string;
        bal: string;
        minAmt: string;
        maxAmt: string;
      }[];
      earningData: {
        ccy: string;
        earningType: string;
      }[];
      state: string;
      earningCcy?: string[];
    }[];
  }> => this.request('GET', '/api/v5/finance/staking-defi/offers', params);

  /**
   * 赚币
   * GET / 查看活跃订单
   *
   * 限速：3次/s
   * 限速规则：UserID
   */
  getFinanceStakingDeFiOrdersActive = (params: {
    productId?: string;
    protocolType?: string;
    ccy?: string;
    state?: string;
  }): Promise<{
    code: string;
    msg: string;
    data: {
      ordId: string;
      state: string;
      ccy: string;
      protocol: string;
      protocolType: string;
      term: string;
      apy: string;
      investData: {
        ccy: string;
        amt: string;
        minAmt?: string;
        maxAmt?: string;
      }[];
      earningData: {
        ccy: string;
        earningType: string;
        earnings: string;
      }[];
      purchasedTime: string;
      estSettlementTime: string;
      cancelRedemptionDeadline: string;
      tag: string;
      earningCcy?: string[];
    }[];
  }> => this.request('GET', '/api/v5/finance/staking-defi/orders-active', params);

  /**
   * 下单
   *
   * 只有当您的账户有足够的资金才能下单。
   *
   * 限速：60次/2s
   *
   * 跟单交易带单产品的限速：4次/2s
   *
   * 限速规则（期权以外）：UserID + Instrument ID
   *
   * 限速规则（只限期权）：UserID + Instrument Family
   *
   * https://www.okx.com/docs-v5/zh/#order-book-trading-trade-post-place-order
   */
  postTradeOrder = (params: {
    instId: string;
    tdMode: string;
    ccy?: string;
    clOrdId?: string;
    tag?: string;
    side: string;
    posSide?: string;
    ordType: string;
    sz: string;
    px?: string;
    pxUsd?: string;
    pxVol?: string;
    reduceOnly?: string;
    tgtCcy?: string;
    banAmend?: string;
    quickMgnType?: string;
    stpId?: string;
    stpMode?: string;
    attachAlgoOrds?: Array<{
      attachAlgoClOrdId?: string;
      tpTriggerPx?: string;
      tpOrdPx?: string;
      tpOrdKind?: string;
      slTriggerPx?: string;
      slOrdPx?: string;
      tpTriggerPxType?: string;
      slTriggerPxType?: string;
      sz?: string;
      amendPxOnTriggerType?: string;
    }>;
  }): Promise<{
    code: string;
    msg: string;
    data: {
      clOrdId: string;
      ordId: string;
      tag: string;
      sCode: string;
      sMsg: string;
    }[];
    inTime: string;
    outTime: string;
  }> => this.request('POST', '/api/v5/trade/order', params);

  /**
   * 获取未成交订单列表
   *
   * 获取当前账户下所有未成交订单信息
   *
   * 限速：60次/2s
   * 限速规则：UserID
   *
   * https://www.okx.com/docs-v5/zh/#order-book-trading-trade-get-order-list
   */
  getTradeOrdersPending = (params: {
    instType?: string;
    uly?: string;
    instFamily?: string;
    instId?: string;
    ordType?: string;
    state?: string;
    after?: string;
    before?: string;
    limit?: string;
  }): Promise<{
    code: string;
    msg: string;
    data: {
      accFillSz: string;
      avgPx: string;
      cTime: string;
      category: string;
      ccy: string;
      clOrdId: string;
      fee: string;
      feeCcy: string;
      fillPx: string;
      fillSz: string;
      fillTime: string;
      instId: string;
      instType: string;
      lever: string;
      ordId: string;
      ordType: string;
      pnl: string;
      posSide: string;
      px: string;
      pxUsd: string;
      pxVol: string;
      pxType: string;
      rebate: string;
      rebateCcy: string;
      side: string;
      attachAlgoClOrdId: string;
      slOrdPx: string;
      slTriggerPx: string;
      slTriggerPxType: string;
      attachAlgoOrds: any[];
      source: string;
      state: string;
      stpId: string;
      stpMode: string;
      sz: string;
      tag: string;
      tdMode: string;
      tgtCcy: string;
      tpOrdPx: string;
      tpTriggerPx: string;
      tpTriggerPxType: string;
      tradeId: string;
      reduceOnly: string;
      quickMgnType: string;
      algoClOrdId: string;
      algoId: string;
      isTpLimit: string;
      uTime: string;
    }[];
  }> => this.request('GET', '/api/v5/trade/orders-pending', params);

  /**
   * 撤单
   *
   * 撤销之前下的未完成订单。
   *
   * 限速：60次/2s
   *
   * 限速规则（期权以外）：UserID + Instrument ID
   *
   * 限速规则（只限期权）：UserID + Instrument Family
   *
   * https://www.okx.com/docs-v5/zh/#order-book-trading-trade-post-cancel-order
   */
  postTradeCancelOrder = (params: {
    instId: string;
    ordId?: string;
    clOrdId?: string;
  }): Promise<{
    code: string;
    msg: string;
    data: {
      clOrdId: string;
      ordId: string;
      sCode: string;
      sMsg: string;
    }[];
    inTime: string;
    outTime: string;
  }> => this.request('POST', '/api/v5/trade/cancel-order', params);

  /**
   * 查看子账户列表
   *
   * 仅适用于母账户。
   *
   * 限速：2次/2s
   *
   * 限速规则：UserID
   */
  getSubAccountList = (params?: {
    enable?: string;
    subAct?: string;
    after?: string;
    before?: string;
    limit?: string;
  }): Promise<{
    data: {
      type: string;
      enable: string;
      subAcct: string;
      uid: string;
      label: string;
      mobile: string;
      gAuth: boolean;
      frozenFunc: string[];
      canTransOut: boolean;
      ts: string;
    }[];
    code: string;
    msg: string;
  }> => this.request('GET', '/api/v5/users/subaccount/list', params);

  /**
   * 设置子账户主动转出权限
   *
   * 设置子账户转出权限（仅适用于母账户），默认可转出至母账户。
   *
   * 限速：1次/s
   *
   * 限速规则：UserID
   */
  postSetSubAccountTransferOut = (params: {
    subAcct: string;
    canTransOut: boolean;
  }): Promise<{
    subAcct: string;
    canTransOut: boolean;
  }> => this.request('POST', '/api/v5/users/subaccount/set-transfer-out', params);

  /**
   * 获取资金划转状态
   *
   * 获取最近2个星期内的资金划转状态数据
   *
   * 限速：10 次/s
   *
   * 限速规则：UserID
   */
  getAssetTransferState = (params: {
    transId?: string;
    clientId?: string;
    type?: string;
  }): Promise<{
    code: string;
    msg: string;
    data: {
      transId: string;
      clientId: string;
      ccy: string;
      amt: string;
      type: string;
      from: string;
      to: string;
      subAcct: string;
      // success | pending | failed
      state: string;
    }[];
  }> => this.request('GET', '/api/v5/asset/transfer-state', params);

  /**
   * 获取币种列表
   *
   * 获取当前用户KYC实体支持的币种列表。
   *
   * 限速：6 次/s
   *
   * 限速规则：UserID
   */
  getAssetCurrencies = (params?: {
    ccy?: string;
  }): Promise<{
    code: string;
    msg: string;
    data: {
      ccy: string;
      name: string;
      chain: string;
      canWd: boolean;
      canInternal: boolean;
      minWd: string;
      maxWd: string;
      wdTickSz: string;
      wdQuota: string;
      usedWdQuota: string;
      minFee: string;
      maxFee: string;
    }[];
  }> => this.request('GET', '/api/v5/asset/currencies', params);
}

