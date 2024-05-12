import { formatTime } from '@yuants/data-model';
// @ts-ignore
import CryptoJS from 'crypto-js';
interface IGateParams {
  auth: { access_key: string; secret_key: string };
}

export class GateClient {
  api_root = 'api.gateio.ws/api/v4';
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
    console.debug('###', signData, '###');
    const str = CryptoJS.enc.Hex.stringify(CryptoJS.HmacSHA512(signData, secret_key));

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      KEY: this.params.auth.access_key!,
      SIGN: str,
      Timestamp: `${timestamp}`,
    };

    console.info(formatTime(Date.now()), method, url.href, JSON.stringify(headers), body, signData);
    const res = await fetch(url.href, {
      method,
      headers,
      body: body || undefined,
    });
    const retStr = await res.text();

    try {
      return JSON.parse(retStr);
    } catch (e) {
      console.error(formatTime(Date.now()), 'RequestFailed', path, JSON.stringify(params), retStr);
      throw e;
    }
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
}

(async () => {
  if (process.env.NODE_ENV === 'development') {
    const client = new GateClient({
      auth: {
        access_key: process.env.ACCESS_KEY!,
        secret_key: process.env.SECRET_KEY!,
      },
    });

    console.info(JSON.stringify(await client.getAccountDetail()));
  }
})();
