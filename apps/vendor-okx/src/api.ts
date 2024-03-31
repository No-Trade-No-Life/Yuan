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
    data: Array<{
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
}
