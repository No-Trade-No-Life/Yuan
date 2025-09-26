import { Terminal } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';
import { client } from './api';

// API Interface definitions
export interface IAPITokenInfo {
  tokenSymbol: string;
  tokenLogo: string;
  coinAmount: string;
  currencyAmount: string;
  tokenPrecision: number;
  tokenAddress: string;
  network: string;
}

export interface IAPIRangeInfo {
  lowerPrice: string;
  upperPrice: string;
  token0Symbol: string;
  token1Symbol: string;
}

export interface IAPIUnclaimFeesDefiTokenInfo {
  baseDefiTokenInfos: IAPITokenInfo[];
  currencyAmount: string;
}

export interface IAPIPosition {
  rangeInfo: IAPIRangeInfo;
  tokenId: string;
  positionName: string;
  positionStatus: string;
  assetsTokenList: IAPITokenInfo[];
  unclaimFeesDefiTokenInfo: IAPIUnclaimFeesDefiTokenInfo[];
  totalValue: string;
}

export interface IAPIInvestTokenBalance {
  investmentName: string;
  investmentKey: string;
  feeRate: string;
  investType: number;
  investName: string;
  positionList: IAPIPosition[];
  assetsTokenList: IAPITokenInfo[];
  rewardDefiTokenInfo: any[];
  totalValue: string;
}

export interface IAPINetworkHold {
  network: string;
  chainId: number;
  totalAssert: string;
  investTokenBalanceVoList: IAPIInvestTokenBalance[];
  availableRewards: any[];
  airDropRewardInfo: any[];
}

export interface IAPIWalletIdPlatformDetail {
  networkHoldVoList: IAPINetworkHold[];
  accountId: string;
}

const terminal = Terminal.fromNodeEnv();

// API method implementations
/**
 * 获取支持的链#
 *
 * 获取余额 API 支持的链信息。
 * 请求路径#
 *
 * GET https://web3.okx.com/api/v5/dex/balance/supported/chain
 *
 * API DOC: https://web3.okx.com/zh-hans/build/dev-docs/dex-api/dex-balance-chains#%E8%8E%B7%E5%8F%96%E6%94%AF%E6%8C%81%E7%9A%84%E9%93%BE
 *
 */
export const getBalanceSupportedChain = async (): Promise<{
  code: string;
  msg: string;
  data: Array<{
    name: string;
    logoUrl: string;
    shortName: string;
    chainIndex: string;
  }>;
}> => {
  const res: any = await terminal.client.requestForResponseData('OKXWeb3/request', {
    method: 'GET',
    path: '/api/v5/dex/balance/supported/chain',
    params: undefined,
  });
  return res;
};

/**
 * 获取总估值#
 *
 * 获取地址下全量代币和 Defi 资产总余额。
 * 请求地址#
 *
 * GET https://web3.okx.com/api/v6/dex/balance/total-value-by-address
 *
 * API DOC: https://web3.okx.com/zh-hans/build/dev-docs/dex-api/dex-balance-total-value#%E8%8E%B7%E5%8F%96%E6%80%BB%E4%BC%B0%E5%80%BC
 */
export const getBalanceTotalValueByAddress = async (params: {
  address: string;
  chains: string;
  assetType?: string;
  excludeRiskToken?: string;
}): Promise<{
  code: string;
  msg: string;
  data: {
    totalValue: string;
  }[];
}> => {
  const res: any = await terminal.client.requestForResponseData('OKXWeb3/request', {
    method: 'GET',
    path: '/api/v5/dex/balance/total-value-by-address',
    params,
  });
  return res;
};

/**
 * 获取所有代币余额
 *
 * 根据钱包地址获取所有代币的余额信息。
 * 请求路径#
 *
 * GET https://web3.okx.com/api/v5/dex/balance/all-token-balances-by-address
 *
 * API DOC: https://web3.okx.com/zh-hans/build/dev-docs/dex-api/dex-balance-total-token-balances#%E8%8E%B7%E5%8F%96%E8%B5%84%E4%BA%A7%E6%98%8E%E7%BB%86
 */
export const getBalanceAllTokenBalancesByAddress = async (params: {
  address: string;
  chains?: string;
  excludeRiskToken?: string;
}): Promise<{
  code: string;
  msg: string;
  data: Array<{
    tokenAssets: Array<{
      chainIndex: string;
      tokenContractAddress: string;
      address: string;
      symbol: string;
      balance: string;
      rawBalance: string;
      tokenPrice: string;
      isRiskToken: boolean;
    }>;
  }>;
}> => {
  const res: any = await terminal.client.requestForResponseData('OKXWeb3/request', {
    method: 'GET',
    path: '/api/v5/dex/balance/all-token-balances-by-address',
    params,
  });
  return res;
};

/**
 * 获取 DeFi 用户资产平台列表
 *
 * 获取用户在各个 DeFi 平台的资产信息列表。
 * 请求路径#
 *
 * POST https://web3.okx.com/api/v5/defi/user/asset/platform/list
 *
 * API DOC: https://web3.okx.com/zh-hant/build/docs/waas/defi-api-reference-personal-asset-platform-list#%E6%9F%A5%E8%AF%A2%E7%94%A8%E6%88%B7%E5%85%A8%E7%BD%91%E6%8C%81%E4%BB%93%E5%88%97%E8%A1%A8
 */
export const getDefiUserAssetPlatformList = async (params: {
  walletAddressList: Array<{
    chainId: string;
    walletAddress: string;
  }>;
}): Promise<{
  code: number;
  msg: string;
  error_code: string;
  error_message: string;
  detailMsg: string;
  data: {
    walletIdPlatformList: Array<{
      platformList: Array<{
        platformName: string;
        analysisPlatformId: string;
        platformLogo: string;
        currencyAmount: string;
        isSupportInvest: string;
        platformUrl: string;
        networkBalanceVoList: Array<{
          network: string;
          networkLogo: string;
          chainId: string;
          currencyAmount: string;
        }>;
        investmentCount: string;
      }>;
    }>;
  };
}> => {
  const res: any = await terminal.client.requestForResponseData('OKXWeb3/request', {
    method: 'POST',
    path: '/api/v5/defi/user/asset/platform/list',
    params,
  });
  return res;
};

/**
 * 获取 DeFi 用户资产平台详情
 *
 * 获取用户在指定 DeFi 平台的详细资产信息。
 * 请求路径#
 *
 * POST https://web3.okx.com/api/v5/defi/user/asset/platform/detail
 *
 * API DOC: https://web3.okx.com/zh-hant/build/docs/waas/defi-api-reference-personal-asset-platform-detail#%E6%9F%A5%E8%AF%A2%E7%94%A8%E6%88%B7%E5%8D%8F%E8%AE%AE%E7%BB%B4%E5%BA%A6%E6%8C%81%E4%BB%93%E5%88%97%E8%A1%A8
 */
export const getDefiUserAssetPlatformDetail = async (params: {
  analysisPlatformId: string;
  accountIdInfoList: Array<{
    walletAddressList: Array<{
      chainId: string;
      walletAddress: string;
    }>;
  }>;
}): Promise<{
  code: number;
  msg: string;
  error_code: string;
  error_message: string;
  detailMsg: string;
  data: {
    walletIdPlatformDetailList: IAPIWalletIdPlatformDetail[];
    platformName: string;
    analysisPlatformId: number;
    platformLogo: string;
    platformUrl: string;
  };
}> => {
  const res: any = await terminal.client.requestForResponseData('OKXWeb3/request', {
    method: 'POST',
    path: '/api/v5/defi/user/asset/platform/detail',
    params,
  });
  return res;
};

terminal.server.provideService<{ method: string; path: string; params: any }, any>(
  'OKXWeb3/request',
  {
    required: ['method', 'path'],
    properties: {
      method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
      path: { type: 'string' },
      params: { type: 'object', additionalProperties: true },
    },
  },
  async (msg) => {
    console.info(formatTime(Date.now()), 'OKXWeb3/request', JSON.stringify(msg.req));
    const result = await client.request(msg.req.method!, msg.req!.path, msg.req!.params);
    console.info(formatTime(Date.now()), 'OKXWeb3/response', JSON.stringify(result));
    return {
      res: {
        code: result.code,
        message: result.msg,
        data: result,
      },
    };
  },
  {
    concurrent: 1,
    max_pending_requests: 10,
    egress_token_capacity: process.env.RATE_LIMIT_LIMIT ? Number(process.env.RATE_LIMIT_LIMIT) : 1,
    egress_token_refill_interval: process.env.RATE_LIMIT_REFILL_INTERVAL
      ? Number(process.env.RATE_LIMIT_REFILL_INTERVAL)
      : 1000,
  },
);
