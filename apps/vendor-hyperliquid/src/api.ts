import { UUID, formatTime } from '@yuants/data-model';
// @ts-ignore
import { ethers } from 'ethers';
import { Subject, filter, firstValueFrom, mergeMap, of, shareReplay, throwError, timeout, timer } from 'rxjs';

/**
 * API: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/notation
 */
export class HyperliquidClient {
  private wallet: ethers.Wallet | undefined;
  public public_key: string | undefined;
  constructor(config: {
    auth?: {
      private_key: string;
    };
  }) {
    this.wallet = config.auth ? new ethers.Wallet(config.auth.private_key) : undefined;
    this.public_key = this.wallet?.address;
  }

  async request(method: string, path: string, params?: any) {
    const url = new URL('https://api.hyperliquid.xyz');

    url.pathname = path;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const body = method === 'GET' ? '' : JSON.stringify(params);
    // const str = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA256(signData, secret_key));

    console.info(formatTime(Date.now()), method, url.href, JSON.stringify(headers), body);
    const res = await fetch(url.href, {
      method,
      headers,
      body: body || undefined,
    });
    const retStr = await res.text();
    try {
      if (process.env.LOG_LEVEL === 'DEBUG') {
        console.debug(formatTime(Date.now()), 'HyperliquidResponse', path, JSON.stringify(params), retStr);
      }
      return JSON.parse(retStr);
    } catch (e) {
      console.error(formatTime(Date.now()), 'HyperliquidRequestFailed', path, JSON.stringify(params), retStr);
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
   * info
   *
   * https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals#retrieve-users-perpetuals-account-summary
   */
  getUserPerpetualsAccountSummary = (params: {
    user: string;
  }): Promise<{
    marginSummary: {
      accountValue: string;
      totalNtlPos: string;
      totalRawUsd: string;
      totalMarginUsed: string;
    };
    crossMarginSummary: {
      accountValue: string;
      totalNtlPos: string;
      totalRawUsd: string;
      totalMarginUsed: string;
    };
    crossMaintenanceMarginUsed: string;
    withdrawable: string;
    assetPositions: {
      type: string;
      position: {
        coin: string;
        szi: string;
        leverage: {
          type: string;
          value: number;
        };
        entryPx: string;
        positionValue: string;
        unrealizedPnl: string;
        returnOnEquity: string;
        liquidationPx: string;
        marginUsed: string;
        maxLeverage: number;
        cumFunding: {
          allTime: string;
          sinceOpen: string;
          sinceChange: string;
        };
      };
    }[];
    time: number;
  }> => this.request('POST', 'info', { ...params, type: 'clearinghouseState' });

  /**
   * info
   *
   * https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals#retrieve-perpetuals-metadata
   */
  getPerpetualsMetaData = (): Promise<{
    universe: {
      name: string;
      szDecimals: number;
      maxLeverage: number;
      onlyIsolated?: boolean;
      isDelisted?: boolean;
    }[];
  }> => this.request('POST', 'info', { type: 'meta' });

  /**
   * info
   *
   * https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/spot#retrieve-spot-metadata
   */
  getSpotMetaData = (): Promise<{
    tokens: {
      name: string;
      szDecimals: number;
      weiDecimals: number;
      index: number;
      tokenId: string;
      isCanonical: boolean;
      evmContract: null;
      fullName: null;
    }[];
    universe: {
      name: string;
      tokens: number[];
      index: number;
      isCanonical: boolean;
    }[];
  }> => this.request('POST', 'info', { type: 'spotMeta' });

  /**
   * info
   *
   * https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals#retrieve-a-users-funding-history-or-non-funding-ledger-updates
   */
  getUserFundingHistory = (params: {
    user: string;
    startTime?: number;
    endTime?: number;
  }): Promise<{
    time: number;
    hash: string;
    delta: {
      type: string;
      coin: string;
      usdc: string;
      szi: string;
      fundingRate: string;
    };
  }> => this.request('POST', 'info', { ...params, type: 'fundingHistory' });

  /**
   * info
   *
   * https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/spot#retrieve-spot-metadata
   */
  getUserTokenBalances = (params: {
    user: string;
  }): Promise<{
    balances: {
      coin: string;
      token: number;
      hold: string;
      total: string;
      entryNtl: string;
    }[];
  }> => this.request('POST', 'info', { ...params, type: 'tokenBalances' });
}
