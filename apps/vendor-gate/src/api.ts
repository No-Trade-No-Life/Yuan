import { formatTime } from '@yuants/data-model';
import '@yuants/protocol/lib/services';
import '@yuants/protocol/lib/services/order';
import '@yuants/protocol/lib/services/transfer';

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
      console.error(formatTime(Date.now()), 'huobiRequestFailed', path, JSON.stringify(params), retStr);
      throw e;
    }
  }

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

  getAccountDetail(): Promise<{
    user_id: string;
    tier: number;
    key: {
      mode: number;
    };
    currency_pairs: string[];
    ip_whitelist: string[];
  }> {
    return this.request('GET', '/api/v4/account/detail');
  }

  getFuturePositions(
    params?: { holding?: boolean; limit?: number; offset?: number },
    quote_currency = 'usdt',
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
  > {
    return this.request('GET', `/api/v4/futures/${quote_currency}/positions`, params);
  }

  getFuturesOrders(
    params: {
      contract?: string;
      status: string;
      limit?: number;
      offset?: number;
      last_id?: number;
    },
    quote_currency = 'usdt',
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
    return this.request('GET', `/api/v4/futures/${quote_currency}/orders`, params);
  }
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
