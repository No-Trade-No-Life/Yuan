import { request } from './client';

const buildInfoRequestBody = <P extends Record<string, unknown>>(type: string, params?: P) => ({
  ...(params ?? {}),
  type,
});

export const buildUserPerpetualsAccountSummaryRequestBody = (params: { user: string }) =>
  buildInfoRequestBody('clearinghouseState', params);

/**
 * Get user's perpetual account summary including positions, margin, and portfolio information
 * API Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals#retrieve-users-perpetuals-account-summary
 * API Endpoint: POST /info (type: clearinghouseState)
 * @param params - Query parameters
 * @param params.user - User's wallet address
 * @returns Promise resolving to account summary with margin information, positions, and portfolio details
 */
export const getUserPerpetualsAccountSummary = (params: { user: string }) =>
  request<{
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
        leverage: { type: string; value: number };
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
  }>('POST', 'info', buildUserPerpetualsAccountSummaryRequestBody(params));

export const buildPerpetualsMetaDataRequestBody = (params?: { dex?: string }) =>
  buildInfoRequestBody('meta', params ?? {});

/**
 * Get perpetual market metadata including available assets, their specifications, and margin tiers
 * API Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals#retrieve-perpetuals-metadata
 * API Endpoint: POST /info (type: meta)
 * @param params - Optional query parameters
 * @param params.dex - Optional DEX identifier
 * @returns Promise resolving to universe of perpetual assets and margin configuration
 */
export const getPerpetualsMetaData = (params?: { dex?: string }) =>
  request<{
    universe: {
      name: string;
      szDecimals: number;
      maxLeverage: number;
      onlyIsolated?: boolean;
      isDelisted?: boolean;
    }[];
    marginTables: [
      number,
      {
        description: string;
        marginTiers: {
          lowerBound: string;
          maxLeverage: number;
        }[];
      },
    ][];
  }>('POST', 'info', buildPerpetualsMetaDataRequestBody(params));

export const buildSpotMetaDataRequestBody = () => buildInfoRequestBody('spotMeta');

/**
 * Get spot market metadata including available tokens and trading pairs
 * API Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/spot#retrieve-spot-metadata
 * API Endpoint: POST /info (type: spotMeta)
 * @returns Promise resolving to spot universe with token information and pair configurations
 */
export const getSpotMetaData = () =>
  request<{
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
  }>('POST', 'info', buildSpotMetaDataRequestBody());

export const buildUserFundingHistoryRequestBody = (params: {
  user: string;
  startTime?: number;
  endTime?: number;
}) => buildInfoRequestBody('fundingHistory', params);

/**
 * Get user's funding rate payment history for perpetual positions
 * API Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals#retrieve-a-users-funding-history-or-non-funding-ledger-updates
 * API Endpoint: POST /info (type: fundingHistory)
 * @param params - Query parameters
 * @param params.user - User's wallet address
 * @param params.startTime - Optional start timestamp in milliseconds
 * @param params.endTime - Optional end timestamp in milliseconds
 * @returns Promise resolving to array of funding payment records with amounts and rates
 */
export const getUserFundingHistory = (params: { user: string; startTime?: number; endTime?: number }) =>
  request<
    {
      time: number;
      hash: string;
      delta: { type: string; coin: string; usdc: string; szi: string; fundingRate: string };
    }[]
  >('POST', 'info', buildUserFundingHistoryRequestBody(params));

export const buildUserTokenBalancesRequestBody = (params: { user: string }) =>
  buildInfoRequestBody('spotClearinghouseState', params);

/**
 * Get user's token balances for both spot and perpetual accounts
 * API Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/spot#retrieve-a-users-token-balances
 * API Endpoint: POST /info (type: spotClearinghouseState)
 * @param params - Query parameters
 * @param params.user - User's wallet address
 * @returns Promise resolving to array of token balances with held and total amounts
 */
export const getUserTokenBalances = (params: { user: string }) =>
  request<{ balances: { coin: string; token: number; hold: string; total: string; entryNtl: string }[] }>(
    'POST',
    'info',
    buildUserTokenBalancesRequestBody(params),
  );

export const buildUserOpenOrdersRequestBody = (params: { user: string }) =>
  buildInfoRequestBody('openOrders', params);

/**
 * Get user's currently open orders across all markets
 * API Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint#open-orders
 * API Endpoint: POST /info (type: openOrders)
 * @param params - Query parameters
 * @param params.user - User's wallet address
 * @returns Promise resolving to array of open order details with prices, sizes, and timestamps
 */
export const getUserOpenOrders = (params: { user: string }) =>
  request<{ coin: string; limitPx: string; oid: number; side: string; sz: string; timestamp: number }[]>(
    'POST',
    'info',
    buildUserOpenOrdersRequestBody(params),
  );

export const buildHistoricalFundingRatesRequestBody = (params: {
  coin: string;
  startTime: number;
  endTime?: number;
}) => buildInfoRequestBody('fundingHistory', params);

/**
 * Get historical funding rates for a specific perpetual asset
 * API Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals#retrieve-historical-funding-rates
 * API Endpoint: POST /info (type: fundingHistory)
 * @param params - Query parameters
 * @param params.coin - Asset symbol (e.g., "BTC", "ETH")
 * @param params.startTime - Start timestamp in milliseconds
 * @param params.endTime - Optional end timestamp in milliseconds
 * @returns Promise resolving to array of historical funding rate records
 */
export const getHistoricalFundingRates = (params: { coin: string; startTime: number; endTime?: number }) =>
  request<{ coin: string; fundingRate: string; premium: string; time: number }[]>(
    'POST',
    'info',
    buildHistoricalFundingRatesRequestBody(params),
  );

export const buildAllMidsRequestBody = () => buildInfoRequestBody('allMids');

/**
 * Get current mid prices for all tradable assets
 * API Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint#retrieve-mids-for-all-coins
 * API Endpoint: POST /info (type: allMids)
 * @returns Promise resolving to record of asset symbols mapped to their mid prices
 */
export const getAllMids = () => request<Record<string, string>>('POST', 'info', buildAllMidsRequestBody());

export const buildMetaAndAssetCtxsRequestBody = () => buildInfoRequestBody('metaAndAssetCtxs');

/**
 * Get metadata and asset contexts (prices, funding, OI) for all perpetuals
 * API Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals#retrieve-perpetuals-asset-contexts-includes-mark-price-current-funding-open-interest-etc.
 * API Endpoint: POST /info (type: metaAndAssetCtxs)
 * @returns Promise resolving to metadata and current asset contexts
 */
export const getMetaAndAssetCtxs = () =>
  request<
    [
      {
        universe: {
          name: string;
          szDecimals: number;
          maxLeverage: number;
          onlyIsolated?: boolean;
          isDelisted?: boolean;
        }[];
      },
      {
        dayNtlVlm: string;
        funding: string;
        impactPxs: [string, string];
        markPx: string;
        midPx: string;
        openInterest: string;
        oraclePx: string;
        premium: string;
        prevDayPx: string;
      }[],
    ]
  >('POST', 'info', buildMetaAndAssetCtxsRequestBody());

export const buildCandleSnapshotRequestBody = (params: {
  req: { coin: string; interval: string; startTime: number; endTime: number };
}) => buildInfoRequestBody('candleSnapshot', params);

/**
 * Get candle/K-line data for a specific asset and time range
 * API Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint#candle-snapshot
 * API Endpoint: POST /info (type: candleSnapshot)
 * @param params - Query parameters
 * @param params.req - Request object with candle parameters
 * @param params.req.coin - Asset symbol
 * @param params.req.interval - Time interval (e.g., "1m", "5m", "1h", "1d")
 * @param params.req.startTime - Start timestamp in milliseconds
 * @param params.req.endTime - End timestamp in milliseconds
 * @returns Promise resolving to candle data with OHLCV information
 */
export const getCandleSnapshot = (params: {
  req: { coin: string; interval: string; startTime: number; endTime: number };
}) =>
  request<
    {
      T: number;
      c: string;
      h: string;
      i: string;
      l: string;
      o: string;
      n: number;
      s: string;
      t: number;
      v: string;
    }[]
  >('POST', 'info', buildCandleSnapshotRequestBody(params));
