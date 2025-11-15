import { request } from './client';

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
  }>('POST', 'info', { ...params, type: 'clearinghouseState' });

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
  }>('POST', 'info', { ...(params ?? {}), type: 'meta' });

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
  }>('POST', 'info', { type: 'spotMeta' });

export const getUserFundingHistory = (params: { user: string; startTime?: number; endTime?: number }) =>
  request<
    {
      time: number;
      hash: string;
      delta: { type: string; coin: string; usdc: string; szi: string; fundingRate: string };
    }[]
  >('POST', 'info', { ...params, type: 'fundingHistory' });

export const getUserTokenBalances = (params: { user: string }) =>
  request<{ balances: { coin: string; token: number; hold: string; total: string; entryNtl: string }[] }>(
    'POST',
    'info',
    {
      ...params,
      type: 'tokenBalances',
    },
  );

export const getUserOpenOrders = (params: { user: string }) =>
  request<{ coin: string; limitPx: string; oid: number; side: string; sz: string; timestamp: number }[]>(
    'POST',
    'info',
    {
      ...params,
      type: 'openOrders',
    },
  );

export const getHistoricalFundingRates = (params: { coin: string; startTime: number; endTime?: number }) =>
  request<{ coin: string; fundingRate: string; premium: string; time: number }[]>('POST', 'info', {
    ...params,
    type: 'fundingHistory',
  });

export const getAllMids = () => request<Record<string, string>>('POST', 'info', { type: 'allMids' });

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
  >('POST', 'info', { type: 'metaAndAssetCtxs' });

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
  >('POST', 'info', { type: 'candleSnapshot', ...params });
