import { formatTime, UUID } from '@yuants/data-model';
// @ts-ignore
import CryptoJS from 'crypto-js';
import { filter, firstValueFrom, mergeMap, of, shareReplay, Subject, throwError, timeout, timer } from 'rxjs';
interface IGateParams {
  auth: { access_key: string; secret_key: string };
}

export class GateClient {
  constructor(public params: IGateParams) {}

  async request(method: string, path: string, params?: any) {
    const url = new URL('https://api.gateio.ws');
    url.pathname = path;
    if (method === 'GET') {
      for (const key in params) {
        url.searchParams.set(key, params[key]);
      }
    }
    if (!this.params.auth) {
      console.info(formatTime(Date.now()), method, url.href);
      const res = await fetch(url.href, { method });
      return res.json();
    }

    const timestamp = Date.now() / 1000;
    const secret_key = this.params.auth.secret_key;
    const body = method === 'GET' ? '' : JSON.stringify(params);
    const signData = `${method}\n${url.pathname}\n${url.searchParams}\n${CryptoJS.enc.Hex.stringify(
      CryptoJS.SHA512(body),
    )}\n${timestamp}`;
    const str = CryptoJS.enc.Hex.stringify(CryptoJS.HmacSHA512(signData, secret_key));

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      KEY: this.params.auth.access_key!,
      SIGN: str,
      Timestamp: `${timestamp}`,
    };

    console.info(formatTime(Date.now()), method, url.href, JSON.stringify(headers), body);
    const res = await fetch(url.href, {
      method,
      headers,
      body: body || undefined,
    });
    const retStr = await res.text();

    try {
      if (process.env.LOG_LEVEL === 'DEBUG') {
        console.debug(
          formatTime(Date.now()),
          'GateResponse',
          path,
          JSON.stringify(params),
          retStr,
          res.headers,
          res.status,
        );
      }
      return JSON.parse(retStr);
    } catch (e) {
      console.error(
        formatTime(Date.now()),
        'GateRequestFailed',
        path,
        JSON.stringify(params),
        retStr,
        res.headers,
        res.status,
      );
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
   * 获取用户账户信息
   *
   * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E8%8E%B7%E5%8F%96%E7%94%A8%E6%88%B7%E8%B4%A6%E6%88%B7%E4%BF%A1%E6%81%AF
   */
  getAccountDetail = (): Promise<{
    user_id: number;
    ip_whitelist: string[];
    currency_pairs: string[];
    key: {
      mode: number;
    };
    tier: number;
  }> => this.request('GET', '/api/v4/account/detail');

  getUnifiedAccounts(params?: { currency?: string }): Promise<{
    user_id: string;
    refresh_time: number;
    locket: boolean;
    balances: Record<
      string,
      {
        available: string;
        freeze: string;
        borrowed: string;
        negative_liab: string;
        futures_pos_liab: string;
        equity: string;
        total_freeze: string;
        total_liab: string;
        spot_in_use: string;
      }
    >;
    total: string;
    borrowed: string;
    total_initial_margin: string;
    total_margin_balance: string;
    total_maintenance_margin: string;
    total_initial_margin_rate: string;
    total_maintenance_margin_rate: string;
    total_avail_margin: string;
    unified_account_total: string;
    unified_account_total_liab: string;
    unified_account_total_equity: string;
    leverage: string;
    spot_order_loss: string;
    spot_hedge: boolean;
  }> {
    return this.request('GET', '/api/v4/unified/accounts', params);
  }

  /**
   * 查询所有的合约信息
   *
   * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E6%9F%A5%E8%AF%A2%E6%89%80%E6%9C%89%E7%9A%84%E5%90%88%E7%BA%A6%E4%BF%A1%E6%81%AF
   */
  getFuturesContracts = (
    settle: string,
    params?: { limit?: number; offset?: number },
  ): Promise<
    {
      name: string;
      type: string;
      quanto_multiplier: string;
      ref_discount_rate: string;
      order_price_deviate: string;
      maintenance_rate: string;
      mark_type: string;
      last_price: string;
      mark_price: string;
      index_price: string;
      funding_rate_indicative: string;
      mark_price_round: string;
      funding_offset: number;
      in_delisting: boolean;
      risk_limit_base: string;
      interest_rate: string;
      order_price_round: string;
      order_size_min: number;
      ref_rebate_rate: string;
      funding_interval: number;
      risk_limit_step: string;
      leverage_min: string;
      leverage_max: string;
      risk_limit_max: string;
      maker_fee_rate: string;
      taker_fee_rate: string;
      funding_rate: string;
      order_size_max: number;
      funding_next_apply: number;
      short_users: number;
      config_change_time: number;
      trade_size: number;
      position_size: number;
      long_users: number;
      funding_impact_value: string;
      orders_limit: number;
      trade_id: number;
      orderbook_id: number;
      enable_bonus: boolean;
      enable_credit: boolean;
      create_time: number;
      funding_cap_ratio: string;
    }[]
  > => this.request('GET', `/api/v4/futures/${settle}/contracts`, params);

  /**
   * 获取用户仓位列表
   *
   * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E8%8E%B7%E5%8F%96%E7%94%A8%E6%88%B7%E4%BB%93%E4%BD%8D%E5%88%97%E8%A1%A8
   */
  getFuturePositions = (
    quote_currency: string,
    params?: { holding?: boolean; limit?: number; offset?: number },
  ): Promise<
    {
      user: number;
      contract: string;
      size: number;
      leverage: string;
      risk_limit: string;
      leverage_max: string;
      maintenance_rate: string;
      value: string;
      margin: string;
      entry_price: string;
      mark_price: string;
      unrealised_pnl: string;
      realised_pnl: string;
      mode: string;
    }[]
  > => this.request('GET', `/api/v4/futures/${quote_currency}/positions`, params);

  /**
   * 查询合约订单列表
   *
   * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E6%9F%A5%E8%AF%A2%E5%90%88%E7%BA%A6%E8%AE%A2%E5%8D%95%E5%88%97%E8%A1%A8
   */
  getFuturesOrders(
    settle: string,
    params: {
      contract?: string;
      status: string;
      limit?: number;
      offset?: number;
      last_id?: number;
    },
  ): Promise<
    {
      id: string;
      contract: string;
      create_time: number;
      size: number;
      price: string;
      is_close: boolean;
      fill_price: boolean;
      text: string;
    }[]
  > {
    return this.request('GET', `/api/v4/futures/${settle}/orders`, params);
  }

  /**
   * 获取合约账号
   *
   * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E8%8E%B7%E5%8F%96%E5%90%88%E7%BA%A6%E8%B4%A6%E5%8F%B7
   */
  getFuturesAccounts = (
    settle: string,
  ): Promise<{
    user: number;
    currency: string;
    total: string;
    unrealised_pnl: string;
    position_margin: string;
    order_margin: string;
    available: string;
    point: string;
    bonus: string;
    in_dual_mode: boolean;
    enable_evolved_classic: boolean;
    history: {
      dnw: string;
      pnl: string;
      fee: string;
      refr: string;
      fund: string;
      point_dnw: string;
      point_fee: string;
      point_refr: string;
      bonus_dnw: string;
      bonus_offset: string;
    };
  }> => this.request('GET', `/api/v4/futures/${settle}/accounts`);

  /**
   * 合约交易下单
   *
   * 下单时指定的是合约张数 size ，而非币的数量，每一张合约对应的币的数量是合约详情接口里返回的 quanto_multiplier
   *
   * 0 成交的订单在撤单 10 分钟之后无法再获取到，会提到订单不存在
   *
   * 设置 reduce_only 为 true 可以防止在减仓的时候穿仓
   *
   * 单仓模式下，如果需要平仓，需要设置 size 为 0 ，close 为 true
   *
   * 双仓模式下，平仓需要使用 auto_size 来设置平仓方向，并同时设置 reduce_only 为 true，size 为 0
   *
   * 设置 stp_act 决定使用限制用户自成交的策略，详细用法参考body参数stp_act
   *
   * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E5%90%88%E7%BA%A6%E4%BA%A4%E6%98%93%E4%B8%8B%E5%8D%95
   */
  postFutureOrders = (
    settle: string,
    params: {
      contract: string;
      size: number;
      iceberg?: number;
      price?: string;
      close?: boolean;
      reduce_only?: boolean;
      tif?: string;
      text?: string;
      auto_size?: string;
      stp_act?: string;
    },
  ): Promise<{
    label?: string;
    message?: string;
    detail?: string;
    id: number;
    user: number;
    contract: string;
    create_time: number;
    size: number;
    iceberg: number;
    left: number;
    price: string;
    fill_price: string;
    mkfr: string;
    tkfr: string;
    tif: string;
    refu: number;
    is_reduce_only: boolean;
    is_close: boolean;
    is_liq: boolean;
    text: string;
    status: string;
    finish_time: number;
    finish_as: string;
    stp_id: number;
    stp_act: string;
    amend_text: string;
  }> => this.request('POST', `/api/v4/futures/${settle}/orders`, params);

  /**
   * 撤销单个订单
   *
   * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E6%92%A4%E9%94%80%E5%8D%95%E4%B8%AA%E8%AE%A2%E5%8D%95-2
   */
  deleteFutureOrders = (settle: string, order_id: string): Promise<{}> =>
    this.request('DELETE', `/api/v4/futures/${settle}/orders/${order_id}`);

  /**
   * 合约市场历史资金费率
   *
   * - Note: 该接口返回的数据是按照时间倒序排列的
   * - Note: limit 参数最大值为 1000
   * - Note: t 字段为秒级时间戳 (Unix Second)，r 字段为资金费率 (0-1 单位)
   *
   * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E5%90%88%E7%BA%A6%E5%B8%82%E5%9C%BA%E5%8E%86%E5%8F%B2%E8%B5%84%E9%87%91%E8%B4%B9%E7%8E%87
   */
  getFutureFundingRate = (
    settle: string,
    params: { contract: string; limit?: number },
  ): Promise<
    {
      t: number;
      r: string;
    }[]
  > => this.request('GET', `/api/v4/futures/${settle}/funding_rate`, params);

  /**
   * 提现
   *
   * POST /withdrawals
   *
   * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E6%8F%90%E7%8E%B0
   */
  postWithdrawals = (params: {
    withdraw_order_id?: string;
    amount: string;
    currency: string;
    address?: string;
    memo?: string;
    chain: string;
  }): Promise<{
    id: string;
    txid: string;
    withdraw_order_id: string;
    timestamp: number;
    amount: string;
    currency: string;
    address: string;
    memo: string;
    status: string;
    chain: string;
  }> => this.request('POST', '/api/v4/withdrawals', params);

  /**
   * 获取币种充值地址
   *
   * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E8%8E%B7%E5%8F%96%E5%B8%81%E7%A7%8D%E5%85%85%E5%80%BC%E5%9C%B0%E5%9D%80
   */
  getDepositAddress = (params: {
    currency: string;
  }): Promise<{
    currency: string;
    address: string;
    multichain_addresses: {
      chain: string;
      address: string;
      payment_id: string;
      payment_name: string;
      obtain_failed: boolean;
    }[];
  }> => this.request('GET', '/api/v4/wallet/deposit_address', params);

  /**
   * 创建新的子账户
   *
   * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E5%88%9B%E5%BB%BA%E6%96%B0%E7%9A%84%E5%AD%90%E8%B4%A6%E6%88%B7
   */
  getSubAccountList = (params?: {
    type?: string;
  }): Promise<
    {
      remark: string;
      login_name: string;
      password: string;
      email: string;
      state: number;
      type: number;
      user_id: number;
      create_time: number;
    }[]
  > => this.request('GET', '/api/v4/sub_accounts', params);

  /**
   * 获取充值记录
   *
   * 记录查询时间范围不允许超过 30 天
   *
   * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E8%8E%B7%E5%8F%96%E5%85%85%E5%80%BC%E8%AE%B0%E5%BD%95
   */
  getDepositHistory = (params?: {
    currency?: string;
    from?: number;
    to?: number;
    limit?: number;
    offset?: number;
  }): Promise<
    {
      id: string;
      txid: string;
      withdraw_order_id: string;
      timestamp: number;
      amount: string;
      currency: string;
      address: string;
      memo: string;
      status: string;
      chain: string;
    }[]
  > => this.request('GET', '/api/v4/wallet/deposits', params);

  /**
   * 获取提现记录
   *
   * 记录查询时间范围不允许超过 30 天
   *
   * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E8%8E%B7%E5%8F%96%E5%B8%81%E7%A7%8D%E5%85%85%E5%80%BC%E5%9C%B0%E5%9D%80
   */
  getWithdrawalHistory = (params?: {
    currency?: string;
    from?: number;
    to?: number;
    limit?: number;
    offset?: number;
  }): Promise<
    {
      id: string;
      txid: string;
      withdraw_order_id: string;
      timestamp: number;
      amount: string;
      currency: string;
      address: string;
      memo: string;
      status: string;
      chain: string;
    }[]
  > => this.request('GET', '/api/v4/wallet/withdrawals', params);

  /**
   * 获取现货交易账户列表
   *
   * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E8%8E%B7%E5%8F%96%E7%8E%B0%E8%B4%A7%E4%BA%A4%E6%98%93%E8%B4%A6%E6%88%B7%E5%88%97%E8%A1%A8
   */
  getSpotAccounts = (params?: {
    currency?: string;
  }): Promise<
    {
      currency: string;
      available: string;
      locked: string;
      update_id: string;
    }[]
  > => this.request('GET', '/api/v4/spot/accounts', params);

  /**
   * 交易账户互转
   *
   * POST /wallet/transfers
   *
   * 交易账户互转
   *
   * 个人交易账户之间的余额互转，目前支持以下互转操作：
   *
   * 现货账户 - 杠杆账户
   * 现货账户 - 永续合约账户
   * 现货账户 - 交割合约账户
   * 现货账户 - 全仓杠杆账户
   * 现货账户 - 期权账户
   *
   * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E4%BA%A4%E6%98%93%E8%B4%A6%E6%88%B7%E4%BA%92%E8%BD%AC
   */
  postWalletTransfer = (params: {
    currency: string;
    from: string;
    to: string;
    amount: string;
    currency_pair?: string;
    settle?: string;
  }): Promise<{
    tx_id: string;
  }> => this.request('POST', '/api/v4/wallet/transfers', params);

  /**
   * 查询合约市场深度信息
   *
   * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E6%9F%A5%E8%AF%A2%E5%90%88%E7%BA%A6%E5%B8%82%E5%9C%BA%E6%B7%B1%E5%BA%A6%E4%BF%A1%E6%81%AF
   */
  getFuturesOrderBook = (
    settle: string,
    params: {
      contract: string;
      interval?: string;
      limit?: number;
      with_id?: boolean;
    },
  ): Promise<{
    id: number;
    current: number;
    update: number;
    asks: {
      p: string;
      s: string;
    }[];
    bids: {
      p: string;
      s: string;
    }[];
  }> =>
    this.requestWithFlowControl(
      'GET',
      `/api/v4/futures/${settle}/order_book`,
      { period: 10000, limit: 200 },
      params,
    );

  /**
   * 获取所有合约交易行情统计
   *
   * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E8%8E%B7%E5%8F%96%E6%89%80%E6%9C%89%E5%90%88%E7%BA%A6%E4%BA%A4%E6%98%93%E8%A1%8C%E6%83%85%E7%BB%9F%E8%AE%A1
   */
  getFuturesTickers = (
    settle: string,
    params?: { contract?: string },
  ): Promise<
    {
      contract: string;
      last: string;
      change_percentage: string;
      total_size: string;
      low_24h: string;
      high_24h: string;
      volume_24h: string;
      volume_24h_btc: string;
      volume_24h_usd: string;
      volume_24h_base: string;
      volume_24h_quote: string;
      volume_24h_settle: string;
      mark_price: string;
      funding_rate: string;
      funding_rate_indicative: string;
      index_price: string;
      quanto_base_rate: string;
      basis_rate: string;
      basis_value: string;
      lowest_ask: string;
      highest_bid: string;
    }[]
  > => this.request('GET', `/api/v4/futures/${settle}/tickers`, params);

  /**
   * 获取统一账户最多可转出
   *
   * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E6%9F%A5%E8%AF%A2%E7%BB%9F%E4%B8%80%E8%B4%A6%E6%88%B7%E6%9C%80%E5%A4%9A%E5%8F%AF%E8%BD%AC%E5%87%BA
   */
  getUnifiedTransferable = (params: {
    currency: string;
  }): Promise<{
    currency: string;
    amount: string;
  }> => this.request('GET', `/api/v4/unified/transferable`, params);

  /**
   * 获取交易对 ticker 信息
   *
   * https://www.gate.io/docs/developers/apiv4/zh_CN/#%E6%9F%A5%E8%AF%A2%E5%8D%95%E4%B8%AA%E4%BA%A4%E6%98%93%E5%AF%B9%E8%AF%A6%E6%83%85
   */
  getSpotTickers = (params: {
    currency_pair?: string;
    timezone?: string;
  }): Promise<
    Array<{
      currency_pair: string;
      last: string;
      lowest_ask: string;
      lowest_size: string;
      highest_bid: string;
      highest_size: string;
      change_percentage: string;
      change_utc0: string;
      change_utc8: string;
      base_volume: string;
      quote_volume: string;
      high_24h: string;
      low_24h: string;
      etf_net_value: string;
      etf_pre_net_value: string;
      etf_pre_timestamp: string;
      etf_leverage: string;
    }>
  > => this.request('GET', `/api/v4/spot/tickers`, params);
}
