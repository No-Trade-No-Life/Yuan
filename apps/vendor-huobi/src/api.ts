import { formatTime } from '@yuants/data-model';
import { IConnection, createConnectionWs } from '@yuants/protocol';
import '@yuants/protocol/lib/services';
import '@yuants/protocol/lib/services/order';
import '@yuants/protocol/lib/services/transfer';

import { Subject, filter, map, share, tap } from 'rxjs';

import zlib from 'zlib';

// @ts-ignore
import CryptoJS from 'crypto-js';
interface IHuobiParams {
  auth: { access_key: string; secret_key: string };
}

const createConnectionGzipWS = <T = any>(URL: string): IConnection<T> => {
  const conn = createConnectionWs(URL);
  const input$ = conn.input$.pipe(
    map((msg) => zlib.gunzipSync(msg)),
    map((msg) => msg.toString()),
    map((msg) => JSON.parse(msg)),
    share(),
  );

  const output$ = new Subject<any>();
  output$.pipe(map((msg) => JSON.stringify(msg))).subscribe(conn.output$);
  return {
    input$,
    output$,
    connection$: conn.connection$,
  };
};

export class HuobiClient {
  swap_api_root = 'api.hbdm.com';
  spot_api_root = 'api.huobi.pro';

  spot_ws: IConnection<any>;

  constructor(public params: IHuobiParams) {
    this.spot_ws = createConnectionGzipWS(`wss://${this.spot_api_root}/ws`);
    this.spot_ws.input$
      .pipe(
        //
        filter((v) => v.ping),
        tap((v) => {
          this.spot_ws.output$.next({ pong: v.ping });
        }),
      )
      .subscribe();
  }

  async request(method: string, path: string, api_root: string, params?: any) {
    const requestParams = `AccessKeyId=${
      this.params.auth.access_key
    }&SignatureMethod=HmacSHA256&SignatureVersion=2&Timestamp=${encodeURIComponent(
      new Date().toISOString().split('.')[0],
    )}${
      method === 'GET' && params !== undefined
        ? `&${Object.entries(params)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join('&')}`
        : ''
    }`;

    const body = method === 'GET' ? '' : JSON.stringify(params);

    const requestString = `${method}\n${api_root}\n${path}\n${requestParams}`;

    const str = CryptoJS.enc.Base64.stringify(
      CryptoJS.HmacSHA256(requestString, this.params.auth.secret_key),
    );

    const url = new URL(`https://${api_root}${path}?${requestParams}&Signature=${encodeURIComponent(str)}`);
    // url.searchParams.sort();
    console.info(formatTime(Date.now()), method, url.href, body);
    const res = await fetch(url.href, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body || undefined,
    });

    const retStr = await res.text();
    // console.info(formatTime(Date.now()), 'response', url.href, retStr);
    try {
      return JSON.parse(retStr);
    } catch (e) {
      console.error(formatTime(Date.now()), 'huobiRequestFailed', path, JSON.stringify(params), retStr);
      throw e;
    }
  }

  // swap_ws = new WebSocket(new URL(`wss://${this.swap_api_root}/linear-swap-ws`));

  getAccount(): Promise<{
    status: string;
    data: {
      id: number;
      type: string;
      state: string;
      subtype: string;
    }[];
  }> {
    // https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec40743-7773-11ed-9966-0242ac110003
    return this.request('GET', '/v1/account/accounts', this.spot_api_root);
  }

  getPerpetualContractSymbols(params?: {
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
      dilivery_date: string;
    }[];
    ts: string;
  }> {
    // https://www.htx.com/zh-cn/opend/newApiPages/?id=8cb72f34-77b5-11ed-9966-0242ac110003
    return this.request('GET', '/linear-swap-api/v1/swap_contract_info', this.swap_api_root, params);
  }

  getSpotSymbols(): Promise<{
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
    // https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec47f16-7773-11ed-9966-0242ac110003
    return this.request('GET', '/v2/settings/common/symbols', this.spot_api_root);
  }

  getUid(): Promise<{ data: number; code: number }> {
    // https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec491c9-7773-11ed-9966-0242ac110003
    return this.request('GET', '/v2/user/uid', this.spot_api_root);
  }

  getUnifiedAccountInfo(): Promise<{
    status: string;
    code: number;
    msg: string;
    data: {
      margin_asset: string;
      margin_balance: number;
      cross_margin_static: number;
      cross_profit_unreal: number;
      withdraw_available: number;
    }[];
  }> {
    // https://www.htx.com/zh-cn/opend/newApiPages/?id=10000073-77b7-11ed-9966-0242ac110003
    return this.request('GET', '/linear-swap-api/v3/unified_account_info', this.swap_api_root);
  }

  getSwapCrossPositionInfo(params?: {
    contract_code?: string;
    pair?: string;
    contract_type: string;
  }): Promise<{
    status: string;
    ts: number;
    data: {
      contract_code: string;
      contract_type: string;
      direction: string;
      margin_mode: string;
      volume: number;
      available: number;
      cost_hold: number;
      last_price: number;
      profit_unreal: number;
      lever_rate: number;
    }[];
  }> {
    // https://www.htx.com/zh-cn/opend/newApiPages/?id=8cb74963-77b5-11ed-9966-0242ac110003
    return this.request('POST', '/linear-swap-api/v1/swap_cross_position_info', this.swap_api_root, params);
  }

  getSwapOpenOrders(): Promise<{
    status: string;
    data: {
      orders: {
        order_id_str: string;
        contract_code: string;
        order_price_type: string;
        direction: string;
        offset: string;
        volume: number;
        created_at: number;
        price: number;
        trade_volume: number;
      }[];
    };
  }> {
    // https://www.htx.com/zh-cn/opend/newApiPages/?id=8cb784d4-77b5-11ed-9966-0242ac110003
    return this.request('POST', '/linear-swap-api/v1/swap_cross_openorders', this.swap_api_root);
  }

  getSpotAccountBalance(account_uid: number): Promise<{
    status: string;
    data: {
      list: {
        currency: string;
        balance: string;
        type: string;
      }[];
    };
  }> {
    // https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec40922-7773-11ed-9966-0242ac110003
    return this.request('GET', `/v1/account/accounts/${account_uid}/balance`, this.spot_api_root);
  }

  getCrossMarginLoanInfo(): Promise<{
    status: string;
    code: number;
    data: {
      currency: string;
      'loanable-amt': string;
    }[];
  }> {
    // https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec41863-7773-11ed-9966-0242ac110003
    return this.request('GET', '/v1/cross-margin/loan-info', this.spot_api_root);
  }

  getSpotTick(params: { symbol: string }): Promise<{
    status: string;
    tick: {
      close: number;
    };
  }> {
    // https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec3fc25-7773-11ed-9966-0242ac110003
    return this.request('GET', `/market/detail/merged`, this.spot_api_root, params);
  }

  /**
   * 【通用】批量获取合约资金费率
   *
   * 接口权限: 读取
   *
   * 限频: 其他非行情类的公开接口，比如获取指数信息，限价信息，交割结算、平台持仓信息等，所有用户都是每个IP3秒最多240次请求（所有该IP的非行情类的公开接口请求共享3秒240次的额度）
   *
   * 接口描述: 该接口支持全仓模式和逐仓模式
   *
   * https://www.htx.com/zh-cn/opend/newApiPages/?id=8cb71b45-77b5-11ed-9966-0242ac110003
   */
  getSwapBatchFundingRate = (params: {
    contract_code?: string;
  }): Promise<{
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
  }> => {
    // https://www.htx.com/zh-cn/opend/newApiPages/?id=8cb7a7b5-77b5-11ed-9966-0242ac110003
    return this.request('GET', `/linear-swap-api/v1/swap_batch_funding_rate`, this.swap_api_root, params);
  };

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
  getSwapMarketTrade = (params: {
    contract_code?: string;
    business_type?: string;
  }): Promise<{
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
  }> => this.request('GET', `/linear-swap-ex/market/trade`, this.swap_api_root, params);

  /**
   * 获得当前合约的总持仓量
   *
   * https://huobiapi.github.io/docs/usdt_swap/v1/cn/#3218e7531a
   */
  getSwapOpenInterest = (params: {
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
  }> => this.request('GET', '/linear-swap-api/v1/swap_open_interest', this.swap_api_root, params);

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
  getSwapMarketBbo = (params: {
    contract_code?: string;
  }): Promise<{
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
  }> => this.request('GET', `/linear-swap-ex/market/bbo`, this.swap_api_root, params);

  postSpotOrder(params: {
    symbol: string;
    'account-id': string;
    amount: string;
    market_amount?: string;
    'borrow-amount'?: string;
    type: string;
    'trade-purpose': string;
    price?: string;
    source: string;
  }): Promise<{ success: boolean; code: number; message: string }> {
    // https://www.htx.com/zh-cn/opend/newApiPages/?id=10000065-77b7-11ed-9966-0242ac110003
    return this.request('POST', `/v1/order/auto/place`, this.spot_api_root, params);
  }

  postSwapOrder(params: {
    contract_code: string;
    contract_type: string;
    price?: number;
    volume: number;
    offset: string;
    direction: string;
    lever_rate: number;
    order_price_type: string;
  }): Promise<{ status: string; ts: number; data: { order_id: number; order_id_str: string } }> {
    // https://www.htx.com/zh-cn/opend/newApiPages/?id=8cb77159-77b5-11ed-9966-0242ac110003
    return this.request('POST', '/linear-swap-api/v1/swap_cross_order', this.swap_api_root, params);
  }

  getSpotAccountDepositAddresses(params: { currency: string }): Promise<{
    code: number;
    message: string;
    data: {
      currency: string;
      chain: string;
      address: string;
    }[];
  }> {
    // https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec45fb7-7773-11ed-9966-0242ac110003
    return this.request('GET', `/v2/account/deposit/address`, this.spot_api_root, params);
  }

  getAccountLedger(params: { accountId: string; currency: string }): Promise<{
    status: string;
    data: {
      transactTime: number;
      transactAmt: number;
    }[];
  }> {
    // https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec4610b-7773-11ed-9966-0242ac110003
    return this.request('GET', `/v2/account/ledger`, this.spot_api_root, params);
  }

  postSuperMarginAccountTransferOut(params: {
    currency: string;
    amount: string;
  }): Promise<{ status: string; data: number }> {
    // https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec41ff0-7773-11ed-9966-0242ac110003
    return this.request('POST', `/v1/cross-margin/transfer-out`, this.spot_api_root, params);
  }

  postSuperMarginAccountTransferIn(params: {
    currency: string;
    amount: string;
  }): Promise<{ status: string; data: number }> {
    // https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec41f0e-7773-11ed-9966-0242ac110003
    return this.request('POST', `/v1/cross-margin/transfer-in`, this.spot_api_root, params);
  }

  postSpotAccountTransfer(params: {
    from: string;
    to: string;
    currency: string;
    amount: number;
    'margin-account': string;
  }): Promise<{ success: boolean; data: number; code: number; message: string }> {
    // https://www.htx.com/zh-cn/opend/newApiPages/?id=10000095-77b7-11ed-9966-0242ac110003
    return this.request('POST', `/v2/account/transfer`, this.spot_api_root, params);
  }

  postBorrow(params: { currency: string; amount: string }): Promise<{
    status: string;
    data: number;
  }> {
    // https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec41b5d-7773-11ed-9966-0242ac110003
    return this.request('POST', `/v1/cross-margin/orders`, this.spot_api_root, params);
  }

  postWithdraw(params: {
    address: string;
    amount: string;
    currency: string;
    fee: string;
    chain: string;
  }): Promise<{
    status: string;
    data: number;
  }> {
    // https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec42cfd-7773-11ed-9966-0242ac110003
    return this.request('POST', `/v1/dw/withdraw/api/create`, this.spot_api_root, params);
  }

  getDepositWithdrawHistory(params: {
    currency: string;
    type: string;
    from?: string;
    size?: string;
    direct?: string;
  }): Promise<{
    status: string;
    'error-code': string;
    'error-msg': string;
    data: {
      id: number;
      type: string;
      currency: string;
      'tx-hash': string;
      chain: string;
      amount: string;
      address: string;
      'address-tag': string;
      fee: string;
      state: string;
      'create-at': number;
      'update-at': number;
    }[];
  }> {
    // https://www.htx.com/zh-cn/opend/newApiPages/?id=7ec44f99-7773-11ed-9966-0242ac110003
    return this.request(`GET`, `/v1/query/deposit-withdraw`, this.spot_api_root, params);
  }

  /**
   * 获取合约的历史资金费率
   *
   * 接口权限: 读取
   *
   * https://www.htx.com/zh-cn/opend/newApiPages/?id=5d51f1f9-77b6-11ed-9966-0242ac110003
   */
  getSwapHistoricalFundingRate(params: {
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
    return this.request(
      'GET',
      `/linear-swap-api/v1/swap_historical_funding_rate`,
      this.swap_api_root,
      params,
    );
  }
}
