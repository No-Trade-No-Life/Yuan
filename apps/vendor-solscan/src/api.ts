import { formatTime } from '@yuants/utils';
import { defer, firstValueFrom, mergeMap, tap } from 'rxjs';

/**
 * API Client V2 for Solscan Pro API
 *
 * Pro API V2 is a paid API service provided by Solscan.
 *
 * Rate Limit: 1000 requests per minute
 * @see https://solscan.io/apis
 */
export class ProApiV2Client {
  constructor(public token: string) {}

  private _request<T>(path: string, params: any): Promise<T> {
    // All Methods are GET
    const url = new URL(`https://pro-api.solscan.io/v2.0${path}`);
    for (const key in params) {
      url.searchParams.set(key, params[key]);
    }

    const theURL = url.toString();
    return firstValueFrom(
      defer(() =>
        fetch(theURL, {
          headers: {
            token: this.token,
          },
        }),
      ).pipe(
        tap((res) => {
          console.info(formatTime(Date.now()), 'ProV2', 'Response', theURL, 'Status', res.status);
        }),
        mergeMap((res) => res.json()),
        tap({
          subscribe: () => console.info(formatTime(Date.now()), 'ProV2', 'Request', theURL),
          next: (v) => console.info(formatTime(Date.now()), 'ProV2', 'Response', theURL, JSON.stringify(v)),
        }),
      ),
    );
  }

  /**
   * Get the metadata of a token
   *
   * https://pro-api.solscan.io/pro-api-docs/v2.0/reference/v2-token-meta
   */
  getTokenMeta = (params: { address: string }) =>
    this._request<{
      success: boolean;
      data: {
        address: string;
        name: string;
        symbol: string;
        icon: string;
        decimals: number;
        holder: number;
        creator: string;
        create_tx: string;
        created_time: number;
        metadata: {
          name: string;
          image: string;
          symbol: string;
          description: string;
          twitter: string;
          website: string;
        };
        mint_authority: string | null;
        freeze_authority: string | null;
        supply: string;
        price: number;
        volume_24h: number;
        market_cap: number;
        market_cap_rank: number;
        price_change_24h: number;
      };
    }>('/token/meta', params);

  /**
   * Get token accounts of an account
   *
   * https://pro-api.solscan.io/pro-api-docs/v2.0/reference/v2-account-token-accounts
   */
  getAccountTokenAccounts = (params: {
    address: string;
    type: 'token' | 'nft';
    page?: number;
    page_size?: number;
    hide_zero?: boolean;
  }): Promise<{
    success: boolean;
    data: {
      token_account: string;
      token_address: string;
      amount: number;
      token_decimals: number;
      owner: string;
    }[];
  }> => this._request('/account/token-accounts', params);

  /**
   * Get the list of transactions of an account
   *
   * https://pro-api.solscan.io/pro-api-docs/v2.0/reference/v2-account-transactions
   */
  getAccountTransactions = (params: {
    address: string;
    before?: string;
    limit?: number;
  }): Promise<{
    success: boolean;
    data: {
      slot: number;
      fee: number;
      status: string;
      signer: string[];
      block_time: number;
      tx_hash: string;
      parsed_instructions: {
        type: string;
        program: string;
        program_id: string;
      }[];
      program_ids: string[];
      time: Date;
    }[];
  }> => this._request('/account/transactions', params);

  /**
   * Get the details of an account
   *
   * https://pro-api.solscan.io/pro-api-docs/v2.0/reference/v2-account-detail
   */
  getAccountDetail = (params: {
    address: string;
  }): Promise<{
    success: boolean;
    data: {
      account: string;
      lamports: number;
      type: string;
      executable: boolean;
      owner_program: string;
      rent_epoch: number;
      is_oncurve: boolean;
    };
  }> => this._request('/account/detail', params);
}
