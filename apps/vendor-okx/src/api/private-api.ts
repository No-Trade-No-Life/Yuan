import { encodeBase64, formatTime, HmacSHA256 } from '@yuants/utils';

/**
 * API v5: https://www.okx.com/docs-v5/#overview
 */

export interface ICredential {
  access_key: string;
  secret_key: string;
  passphrase: string;
}

export async function request(
  credential: ICredential,
  method: string,
  path: string,
  params?: Record<string, unknown>,
) {
  const url = new URL('https://www.okx.com');
  url.pathname = path;
  if (method === 'GET' && params) {
    for (const key in params) {
      url.searchParams.set(key, String(params[key]));
    }
  }
  const timestamp = formatTime(Date.now(), 'UTC').replace(' ', 'T');
  const secret_key = credential.secret_key;
  const body = method === 'GET' ? '' : JSON.stringify(params);
  const signData = timestamp + method + url.pathname + url.search + body;
  const str = encodeBase64(
    await HmacSHA256(
      //
      new TextEncoder().encode(signData),
      new TextEncoder().encode(secret_key),
    ),
  );

  const headers = {
    'Content-Type': 'application/json',
    'OK-ACCESS-KEY': credential.access_key,
    'OK-ACCESS-SIGN': str,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': credential.passphrase,
  };

  console.info(formatTime(Date.now()), method, url.href, JSON.stringify(headers), body, signData);
  const res = await fetch(url.href, {
    method,
    headers,
    body: body || undefined,
  });

  console.info(
    formatTime(Date.now()),
    'PrivateApiResponse',
    credential.access_key,
    method,
    url.href,
    res.status,
  );

  return res.json();
}

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
export function getAssetValuation(
  credential: ICredential,
  params?: {
    ccy?: string;
  },
): Promise<{
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
}> {
  return request(credential, 'GET', '/api/v5/asset/asset-valuation', params);
}

/**
 * 查看账户配置
 * 查看当前账户的配置信息。
 *
 * 限速：5次/2s
 * 限速规则：UserID
 *
 * https://www.okx.com/docs-v5/zh/#trading-account-rest-api-get-account-configuration
 */
export function getAccountConfig(credential: ICredential): Promise<{
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
    traderInsts: unknown[];
    spotRoleType: string;
    spotTraderInsts: unknown[];
    opAuth: string;
    kycLv: string;
    ip: string;
    perm: string;
    mainUid: string;
  }>;
  msg: string;
}> {
  return request(credential, 'GET', '/api/v5/account/config');
}

/**
 * 获取余币宝余额
 *
 * 限速：6次/s
 * 限速规则：UserID
 *
 * https://www.okx.com/docs-v5/zh/#financial-product-savings-get-saving-balance
 */
export function getFinanceSavingsBalance(
  credential: ICredential,
  params: {
    ccy?: string;
  },
): Promise<{
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
}> {
  return request(credential, 'GET', '/api/v5/finance/savings/balance', params);
}

/**
 * 余币宝申购/赎回
 *
 * 仅资金账户中的资产支持余币宝申购。
 *
 * 限速：6次/s
 *
 * 限速规则：UserID
 *
 * https://www.okx.com/docs-v5/zh/#financial-product-savings-post-savings-purchase-redemption
 */
export function postFinanceSavingsPurchaseRedempt(
  credential: ICredential,
  params: {
    ccy: string;
    amt: string;
    side: string;
    rate: string;
  },
): Promise<{
  code: string;
  msg: string;
  data: {
    ccy: string;
    amt: string;
    side: string;
    rate: string;
  }[];
}> {
  return request(credential, 'POST', '/api/v5/finance/savings/purchase-redempt', params);
}

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
export function postAssetWithdrawal(
  credential: ICredential,
  params: {
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
  },
): Promise<{
  code: string;
  msg: string;
  data: Array<{
    amt: string;
    wdId: string;
    ccy: string;
    clientId: string;
    chain: string;
  }>;
}> {
  return request(credential, 'POST', '/api/v5/asset/withdrawal', params);
}

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
export function getAssetDepositAddress(
  credential: ICredential,
  params: {
    ccy: string;
  },
): Promise<{
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
}> {
  return request(credential, 'GET', '/api/v5/asset/deposit-address', params);
}

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
export function getAssetWithdrawalHistory(
  credential: ICredential,
  params: {
    ccy?: string;
    wdId?: string;
    clientId?: string;
    txId?: string;
    type?: string;
    state?: string;
    after?: string;
    before?: string;
    limit?: string;
  },
): Promise<{
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
}> {
  return request(credential, 'GET', '/api/v5/asset/withdrawal-history', params);
}

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
export function getAssetDepositHistory(
  credential: ICredential,
  params: {
    ccy?: string;
    depId?: string;
    state?: string;
    fromWdId?: string;
    txId?: string;
    type?: string;
    after?: string;
    before?: string;
    limit?: string;
  },
): Promise<{
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
}> {
  return request(credential, 'GET', '/api/v5/asset/deposit-history', params);
}

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
export function getAssetBalances(
  credential: ICredential,
  params: {
    ccy?: string;
  },
): Promise<{
  code: string;
  msg: string;
  data: {
    availBal: string;
    bal: string;
    ccy: string;
    frozenBal: string;
  }[];
}> {
  return request(credential, 'GET', '/api/v5/asset/balances', params);
}

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
export function postAssetTransfer(
  credential: ICredential,
  params: {
    ccy: string;
    type?: string;
    amt: string;
    from: string;
    to: string;
    subAcct?: string;
    loanTrans?: boolean;
    omitPosRisk?: string;
    clientId?: string;
  },
): Promise<{
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
}> {
  return request(credential, 'POST', '/api/v5/asset/transfer', params);
}

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
export function getAccountBalance(
  credential: ICredential,
  params: {
    ccy?: string;
  },
): Promise<{
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
      openAvgPx: string;
      spotUpl: string;
      accAvgPx: string;
      totalPnl: string;
      spotBal: string;
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
}> {
  return request(credential, 'GET', '/api/v5/account/balance', params);
}

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
export function getAccountPositions(
  credential: ICredential,
  params: {
    instType?: string;
    instId?: string;
    posId?: string;
  },
): Promise<{
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
}> {
  return request(credential, 'GET', '/api/v5/account/positions', params);
}

/**
 * 获取最大可下单数量
 *
 * 获取最大可买卖/开仓数量，可对应下单时的 sz 字段
 *
 * 限速：20次/2s
 * 限速规则：UserID
 *
 * https://www.okx.com/docs-v5/zh/#trading-account-rest-api-get-maximum-tradable-size
 */
export function getAccountMaxSize(
  credential: ICredential,
  params: {
    instId: string;
    tdMode: string;
    ccy?: string;
    px?: string;
    leverage?: string;
    tradeQuoteCcy?: string;
  },
): Promise<{
  code: string;
  msg: string;
  data: Array<{
    instId: string;
    ccy: string;
    maxBuy: string;
    maxSell: string;
  }>;
}> {
  return request(credential, 'GET', '/api/v5/account/max-size', params);
}

/**
 * 赚币
 * GET / 查看项目
 *
 * 限速：3次/s
 * 限速规则：UserID
 */
export function getFinanceStakingDeFiOffers(
  credential: ICredential,
  params: {
    productId?: string;
    protocolType?: string;
    ccy?: string;
  },
): Promise<{
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
}> {
  return request(credential, 'GET', '/api/v5/finance/staking-defi/offers', params);
}

/**
 * 赚币
 * GET / 查看活跃订单
 *
 * 限速：3次/s
 * 限速规则：UserID
 */
export function getFinanceStakingDeFiOrdersActive(
  credential: ICredential,
  params: {
    productId?: string;
    protocolType?: string;
    ccy?: string;
    state?: string;
  },
): Promise<{
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
}> {
  return request(credential, 'GET', '/api/v5/finance/staking-defi/orders-active', params);
}

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
export function postTradeOrder(
  credential: ICredential,
  params: {
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
  },
): Promise<{
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
}> {
  return request(credential, 'POST', '/api/v5/trade/order', params);
}

/**
 * 修改订单
 *
 * 修改当前未成交的挂单
 *
 * 限速：60次/2s
 *
 * 跟单交易带单员带单产品的限速：4个/2s
 *
 * 限速规则：User ID + Instrument ID
 *
 * 权限：交易
 *
 * 该接口限速同时受到 子账户限速 及 基于成交比率的子账户限速 限速规则的影响。
 *
 * https://www.okx.com/docs-v5/zh/#order-book-trading-trade-post-amend-order
 */
export function postTradeAmendOrder(
  credential: ICredential,
  params: {
    instId: string;
    cxIOnFail?: boolean;
    ordId?: string;
    clOrdId?: string;
    reqId?: string;
    newSz?: string;
    newPx?: string;
    newPxUsd?: string;
    newPxVol?: string;
    attachAlgoOrds?: Array<{
      attachAlgoId?: string;
      attachAlgoClOrdId?: string;
      newTpTriggerPx?: string;
      newTpOrdPx?: string;
      newTpOrdKind?: string;
      newSlTriggerPx?: string;
      newSlOrdPx?: string;
      newTpTriggerPxType?: string;
      newSlTriggerPxType?: string;
      sz?: string;
      amendPxOnTriggerType?: string;
    }>;
  },
): Promise<{
  code: string;
  msg: string;
  data: {
    clOrdId: string;
    ordId: string;
    ts: string;
    reqId: string;
    sCode: string;
    sMsg: string;
  }[];
  inTime: string;
  outTime: string;
}> {
  return request(credential, 'POST', '/api/v5/trade/amend-order', params);
}

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
export function getTradeOrdersPending(
  credential: ICredential,
  params: {
    instType?: string;
    uly?: string;
    instFamily?: string;
    instId?: string;
    ordType?: string;
    state?: string;
    after?: string;
    before?: string;
    limit?: string;
  },
): Promise<{
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
    attachAlgoOrds: unknown[];
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
}> {
  return request(credential, 'GET', '/api/v5/trade/orders-pending', params);
}

/**
 * 获取历史订单记录（近七天）
 *
 * 获取最近7天挂单，且完成的订单数据，包括7天以前挂单，但近7天才成交的订单数据。按照订单创建时间倒序排序。
 *
 * 已经撤销的未成交单 只保留2小时
 * 限速：40次/2s
 * 限速规则：User ID
 */
export function getTradeOrdersHistory(
  credential: ICredential,
  params: {
    instType: string;
    uly?: string;
    instFamily?: string;
    instId?: string;
    ordType?: string;
    state?: string;
    category?: string;
    after?: string;
    before?: string;
    begin?: string;
    end?: string;
    limit?: string;
  },
): Promise<{
  code: string;
  msg: string;
  data: Array<{
    instType: string;
    instId: string;
    tgtCcy: string;
    ccy: string;
    ordId: string;
    clOrdId: string;
    tag: string;
    px: string;
    pxUsd: string;
    pxVol: string;
    pxType: string;
    sz: string;
    ordType: string;
    side: string;
    posSide: string;
    tdMode: string;
    accFillSz: string;
    fillPx: string;
    tradeId: string;
    fillSz: string;
    fillTime: string;
    avgPx: string;
    state: string;
    lever: string;
    attachAlgoClOrdId: string;
    tpTriggerPx: string;
    tpTriggerPxType: string;
    tpOrdPx: string;
    slTriggerPx: string;
    slTriggerPxType: string;
    slOrdPx: string;
    attachAlgoOrds: unknown[];
    linkedAlgoOrd: unknown[];
    stpId: string;
    stpMode: string;
    feeCcy: string;
    fee: string;
    rebateCcy: string;
    source: string;
    rebate: string;
    pnl: string;
    category: string;
    reduceOnly: string;
    cancelSource: string;
    cancelSourceReason: string;
    algoClOrdId: string;
    algoId: string;
    isTpLimit: string;
    uTime: string;
    cTime: string;
    tradeQuoteCcy: string;
  }>;
}> {
  return request(credential, 'GET', '/api/v5/trade/orders-history', params);
}

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
export function postTradeCancelOrder(
  credential: ICredential,
  params: {
    instId: string;
    ordId?: string;
    clOrdId?: string;
  },
): Promise<{
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
}> {
  return request(credential, 'POST', '/api/v5/trade/cancel-order', params);
}

/**
 * 查看子账户列表
 *
 * 仅适用于母账户。
 *
 * 限速：2次/2s
 *
 * 限速规则：UserID
 */
export function getSubAccountList(
  credential: ICredential,
  params?: {
    enable?: string;
    subAct?: string;
    after?: string;
    before?: string;
    limit?: string;
  },
): Promise<{
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
}> {
  return request(credential, 'GET', '/api/v5/users/subaccount/list', params);
}

/**
 * 设置子账户主动转出权限
 *
 * 设置子账户转出权限（仅适用于母账户），默认可转出至母账户。
 *
 * 限速：1次/s
 *
 * 限速规则：UserID
 */
export function postSetSubAccountTransferOut(
  credential: ICredential,
  params: {
    subAcct: string;
    canTransOut: boolean;
  },
): Promise<{
  subAcct: string;
  canTransOut: boolean;
}> {
  return request(credential, 'POST', '/api/v5/users/subaccount/set-transfer-out', params);
}

/**
 * 获取资金划转状态
 *
 * 获取最近2个星期内的资金划转状态数据
 *
 * 限速：10 次/s
 *
 * 限速规则：UserID
 *
 * https://www.okx.com/docs-v5/zh/#funding-account-rest-api-get-funds-transfer-state
 */
export function getAssetTransferState(
  credential: ICredential,
  params: {
    transId?: string;
    clientId?: string;
    type?: string;
  },
): Promise<{
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
}> {
  return request(credential, 'GET', '/api/v5/asset/transfer-state', params);
}

/**
 * 获取币种列表
 *
 * 获取当前用户KYC实体支持的币种列表。
 *
 * 限速：6 次/s
 *
 * 限速规则：UserID
 *
 * https://www.okx.com/docs-v5/zh/#funding-account-rest-api-get-currencies
 */
export function getAssetCurrencies(
  credential: ICredential,
  params?: {
    ccy?: string;
  },
): Promise<{
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
}> {
  return request(credential, 'GET', '/api/v5/asset/currencies', params);
}

/**
 * GET / 借贷信息
 * 限速：5次/2s
 * 限速规则：User ID
 * 权限：读取
 * HTTP请求
 *
 * https://www.okx.com/docs-v5/zh/#financial-product-flexible-loan-get-loan-info
 */
export function getFlexibleLoanInfo(credential: ICredential): Promise<{
  code: string;
  data: {
    collateralData: {
      amt: string;
      ccy: string;
    }[];
    collateralNotionalUsd: string;
    curLTV: string;
    liqLTV: string;
    loanData: {
      amt: string;
      ccy: string;
    }[];
    loanNotionalUsd: string;
    marginCallLTV: string;
    riskWarningData: {
      instId: string;
      liqPx: string;
    };
  }[];
  msg: string;
}> {
  return request(credential, 'GET', '/api/v5/finance/flexible-loan/loan-info');
}

/**
 * 账单流水查询（近七天）
 *
 *
 * 限速：5次/s
 *
 *
 * https://www.okx.com/docs-v5/zh/#trading-account-rest-api-get-bills-details-last-7-days
 */
export function getAccountBills(
  credential: ICredential,
  params?: {
    instType?: string;
    instId?: string;
    ccy?: string;
    mgnMode?: 'isolated' | 'cross';
    ctType?: 'linear' | 'inverse';
    type?: AccountBillType;
    subType?: string;
    after?: string; //请求此id之前（更旧的数据）的分页内容，传的值为对应接口的billId
    before?: string; //请求此id之后（更新的数据）的分页内容，传的值为对应接口的billId
    begin?: string; //筛选的开始时间戳 ts，Unix 时间戳为毫秒数格式，如 1597026383085
    end?: string;
    limit?: string; //分页返回的结果集数量，最大为100，不填默认返回100条
  },
): Promise<{
  code: string;
  msg: string;
  data: {
    instType: string;
    billId: string;
    type: string;
    subType: string;
    ts: string;
    balChg: string;
    posBalChg: string;
    bal: string;
    posBal: string;
    sz: string;
    px: string;
    ccy: string;
    pnl: string;
    fee: string;
    mgnMode: 'isolated' | 'cross' | 'cash' | '';
    instId: string;
    ordId: string;
    execType: string;
    from: string;
    to: string;
    notes: string;
    interest: string;
    tag: string;
    fillTime: string;
    tradeId: string;
    clOrdId: string;
    fillIdxPx: string;
    fillMarkPx: string;
    fillPxVol: string;
    fillPxUsd: string;
    fillMarkVol: string;
    fillFwdPx: string;
  }[];
}> {
  return request(credential, 'GET', '/api/v5/account/bills', params);
}

/**
 * 账单流水查询（近三个月）
 *
 *
 * 限速：5次/2s
 *
 *
 * https://www.okx.com/docs-v5/zh/#trading-account-rest-api-get-bills-details-last-3-months
 */
export function getAccountBillsArchive(
  credential: ICredential,
  params?: {
    instType?: string;
    instId?: string;
    ccy?: string;
    mgnMode?: 'isolated' | 'cross';
    ctType?: 'linear' | 'inverse';
    type?: AccountBillType;
    subType?: string;
    after?: string; //请求此id之前（更旧的数据）的分页内容，传的值为对应接口的billId
    before?: string; //请求此id之后（更新的数据）的分页内容，传的值为对应接口的billId
    begin?: string; //筛选的开始时间戳 ts，Unix 时间戳为毫秒数格式，如 1597026383085
    end?: string;
    limit?: string; //分页返回的结果集数量，最大为100，不填默认返回100条
  },
): Promise<{
  code: string;
  msg: string;
  data: {
    instType: string;
    billId: string;
    type: string;
    subType: string;
    ts: string;
    balChg: string;
    posBalChg: string;
    bal: string;
    posBal: string;
    sz: string;
    px: string;
    ccy: string;
    pnl: string;
    fee: string;
    mgnMode: 'isolated' | 'cross' | 'cash' | '';
    instId: string;
    ordId: string;
    execType: string;
    from: string;
    to: string;
    notes: string;
    interest: string;
    tag: string;
    fillTime: string;
    tradeId: string;
    clOrdId: string;
    fillIdxPx: string;
    fillMarkPx: string;
    fillPxVol: string;
    fillPxUsd: string;
    fillMarkVol: string;
    fillFwdPx: string;
  }[];
}> {
  return request(credential, 'GET', '/api/v5/account/bills-archive', params);
}

/**
 * POST /  网格策略委托下单
 * 限速：20次/2s
 * 限速规则：User ID + Instrument ID
 * 权限：交易
 * HTTP请求
 *
 * https://www.okx.com/docs-v5/zh/?language=shell#order-book-trading-grid-trading-post-place-grid-algo-order
 */
export function postGridAlgoOrder(
  credential: ICredential,
  params: {
    instId: string;
    algoOrdType: string;
    maxPx: string;
    minPx: string;
    gridNum: string;
    runType?: string;
    tpTriggerPx?: string;
    slTriggerPx?: string;
    algoClOrdId?: string;
    tag?: string;
    profitSharingRatio?: string;
    triggerParams?: {
      triggerAction: string;
      triggerStrategy: string;
      timeframe?: string;
      thold?: string;
      triggerCond?: string;
      timePeriod?: string;
      delaySeconds?: string;
      triggerPx?: string;
      stopType?: string;
    }[];
  } & Grid,
): Promise<{
  code: string;
  msg: string;
  data: {
    algoId: string;
    algoClOrdId: string;
    sCode: string;
    sMsg: string;
    tag: string;
  }[];
}> {
  return request(credential, 'POST', '/api/v5/tradingBot/grid/order-algo', params);
}

/**
 * GET / 获取未完成网格策略委托单列表
 * 限速：20次/2s
 * 限速规则：User ID
 * 权限：读取
 * HTTP请求
 *
 * https://www.okx.com/docs-v5/zh/#order-book-trading-grid-trading-get-grid-algo-order-list
 */
export function getGridOrdersAlgoPending(
  credential: ICredential,
  param: {
    algoOrdType: 'grid' | 'contract_grid';
    algoId?: string;
    instId?: string;
    instType?: string;
    after?: string;
    before?: string;
    limit?: string;
  },
): Promise<{
  code: string;
  data: {
    algoId: string;
    algoClOrdId: string;
    instType: string;
    instId: string;
    cTime: string;
    uTime: string;
    algoOrdType: 'grid' | 'contract_grid';
    state: 'starting' | 'running' | 'stopping' | 'pending_signal' | 'no_close_position';
    rebateTrans: {
      rebate: string;
      rebateCcy: string;
    }[];
    triggerParams: {
      triggerAction: string;
      triggerStrategy: string;
      delaySeconds: string;
      triggerTime: string;
      triggerType: string;
      timeframe: string;
      thold: string;
      triggerCond: 'cross_up' | 'cross_down' | 'above' | 'below' | 'cross';
      timePeriod: string;
      triggerPx: string;
      stopType: string;
    }[];
    maxPx: string;
    minPx: string;
    gridNum: string;
    runType: '1' | '2';
    tpTriggerPx: string;
    slTriggerPx: string;
    arbitrageNum: string;
    totalPnl: string;
    pnlRatio: string;
    investment: string;
    gridProfit: string;
    floatProfit: string;
    cancelType: '0' | '1' | '2' | '3' | '4' | '5' | '6';
    stopType: '1' | '2';
    quoteSz: string;
    baseSz: SpotGrid;
    direction: string;
    basePos: string;
    sz: string;
    lever: string;
    actualLever: string;
    liqPx: string;
    uly: string;
    instFamily: string;
    ordFrozen: string;
    availEq: string;
    tag: string;
    profitSharingRatio: string;
    copyType: string;
    fee: string;
    fundingFee: string;
    tradeQuoteCcy: string;
  }[];
  msg: string;
}> {
  return request(credential, 'GET', '/api/v5/tradingBot/grid/orders-algo-pending', param);
}

/**
 * GET / 获取网格策略委托持仓
 * 限速：20次/2s
 * 限速规则：User ID
 * 权限：读取
 * HTTP请求
 *
 * https://www.okx.com/docs-v5/zh/#order-book-trading-grid-trading-get-grid-algo-order-positions
 */
export function getGridPositions(
  credential: ICredential,
  param: {
    algoOrdType: 'contract_grid';
    algoId: string;
  },
): Promise<{
  code: string;
  data: {
    algoId: string;
    algoClOrdId: string;
    instType: string;
    instId: string;
    cTime: string;
    uTime: string;
    avgPx: string;
    ccy: string;
    lever: string;
    liqPx: string;
    posSide: string;
    pos: string;
    mgnMode: string;
    mgnRatio: string;
    imr: string;
    mmr: string;
    upl: string;
    uplRatio: string;
    last: string;
    notionalUsd: string;
    adl: string;
    markPx: string;
  }[];
  msg: string;
}> {
  return request(credential, 'GET', '/api/v5/tradingBot/grid/positions', param);
}

type SpotGrid = {
  quoteSz?: string;
  baseSz?: string;
  tradeQuoteCcy?: string;
};

type SwapGrid = {
  sz: string;
  direction: string;
  lever: string;
  basePos?: string;
  tpRatio?: string;
  slRatio?: string;
};

type Grid = SpotGrid | SwapGrid;

type AccountBillType =
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | '11'
  | '12'
  | '13'
  | '14'
  | '15'
  | '16'
  | '22'
  | '24'
  | '26'
  | '27'
  | '28'
  | '29'
  | '30'
  | '32'
  | '33'
  | '34'
  | '250'
  | '251';
