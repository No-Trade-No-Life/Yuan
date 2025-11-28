import { HmacSHA256, UUID, encodeBase64, formatTime } from '@yuants/utils';
import { Subject, filter, firstValueFrom, mergeMap, of, shareReplay, throwError, timeout, timer } from 'rxjs';

/**
 * API: https://www.bitget.com/zh-CN/api-doc/common/intro
 */
export class CoinExClient {
  noAuth = true;
  constructor(
    public config: {
      auth: {
        access_key: string;
        secret_key: string;
      };
    },
  ) {
    if (config.auth.access_key && config.auth.secret_key) {
      this.noAuth = false;
    }
  }

  async request(method: string, path: string, params?: any) {
    const url = new URL('https://api.coinex.com');
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
    const signData = method + url.pathname + url.search + body + timestamp;
    const str = encodeBase64(
      await HmacSHA256(new TextEncoder().encode(signData), new TextEncoder().encode(secret_key)),
    );

    const headers = {
      'Content-Type': 'application/json',
      'X-COINEX-KEY': this.config.auth.access_key!,
      'X-COINEX-SIGN': str,
      'X-COINEX-TIMESTAMP': timestamp,
    };

    console.info(formatTime(Date.now()), method, url.href, JSON.stringify(headers), body, signData);
    const res = await fetch(url.href, {
      method,
      headers,
      body: body || undefined,
    });

    return res.json();
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

  /**
   * @param method - GET, POST, PUT, DELETE
   * @param path - api path
   * @param flowControl - period in ms, limit in count
   * @param params - request params/body
   * @returns
   */
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
   * 获取市场资金费率
   *
   * https://docs.coinex.com/api/v2/zh/futures/market/http/list-market-funding-rate
   */
  getFuturesFundingRate = async (params?: {
    market?: string;
  }): Promise<{
    code: number;
    message: string;
    data: {
      market: string;
      mark_price: string;
      latest_funding_rate: string;
      next_funding_rate: string;
      max_funding_time: string;
      min_funding_time: string;
      latest_funding_time: number;
      next_funding_time: number;
    }[];
  }> => this.requestWithFlowControl('GET', '/v2/futures/funding-rate', { period: 1000, limit: 400 }, params);

  /**
   * 获取市场资金费率历史记录
   *
   * https://docs.coinex.com/api/v2/zh/futures/market/http/list-market-funding-rate-history
   */
  getFuturesFundingRateHistory = async (params: {
    market: string;
    start_time?: number;
    end_time?: number;
    page?: number;
    limit?: number;
  }): Promise<{
    code: number;
    message: string;
    pagination: {
      has_next: boolean;
    };
    data: {
      market: string;
      funding_time: number;
      theoretical_funding_rate: string;
      actual_funding_rate: string;
    }[];
  }> =>
    this.requestWithFlowControl(
      'GET',
      '/v2/futures/funding-rate-history',
      { period: 1000, limit: 400 },
      params,
    );

  /**
   * 获取市场状态
   *
   * https://docs.coinex.com/api/v2/zh/futures/market/http/list-market
   */
  getFuturesMarket = async (params?: {
    market?: string;
  }): Promise<{
    code: number;
    message: string;
    data: {
      market: string;
      contract_type: string;
      maker_fee_rate: string;
      taker_fee_rate: string;
      min_amount: string;
      base_ccy: string;
      quote_ccy: string;
      base_ccy_precision: number;
      quote_ccy_precision: number;
      leverage: number[];
      open_interest_volume: string;
    }[];
  }> => this.request('GET', '/v2/futures/market', params);

  /**
   * 获取市场行情
   *
   * https://docs.coinex.com/api/v2/zh/futures/market/http/list-market-ticker
   */
  getFuturesTicker = async (params?: {
    market?: string;
  }): Promise<{
    code: number;
    message: string;
    data: {
      market: string;
      last: string;
      open: string;
      close: string;
      high: string;
      low: string;
      volume: string;
      value: string;
      volume_sell: string;
      volume_buy: string;
      index_price: string;
      mark_price: string;
      period: number;
    }[];
  }> => this.request('GET', '/v2/futures/ticker', params);
}

export const client = new CoinExClient({
  auth: {
    access_key: process.env.ACCESS_KEY!,
    secret_key: process.env.SECRET_KEY!,
  },
});
