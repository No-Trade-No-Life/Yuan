import { createCache } from '@yuants/cache';
import { getAccountConfig, ICredential } from '../api/private-api';

export const accountConfigCache = createCache((key) => getAccountConfig(JSON.parse(key)), {
  expire: 1000_000, // 缓存 1000 秒
  swrAfter: 100_000, // 100 秒后后台刷新
});

const accountUidCache = createCache(async (key) => {
  const config = await accountConfigCache.query(key);
  return config?.data[0].uid;
});

const accountIdCache = createCache(async (key) => {
  const uid = await accountUidCache.query(key);
  if (!uid) throw new Error('Failed to get UID');
  return {
    trading: `okx/${uid}/trading`,
    strategy: `okx/${uid}/strategy`,
    loan: `okx/${uid}/loan/USDT`,
    earning: `okx/${uid}/earning/USDT`,
    funding: `okx/${uid}/funding/USDT`,
  };
});

export const getUid = async (credential: ICredential) => {
  return accountUidCache.query(JSON.stringify(credential));
};

export const getAccountIds = async (credential: ICredential) => {
  return accountIdCache.query(JSON.stringify(credential));
};

export const getTradingAccountId = async (credential: ICredential) =>
  getAccountIds(credential).then((x) => x!.trading);

export const getStrategyAccountId = async (credential: ICredential) =>
  getAccountIds(credential).then((x) => x!.strategy);

export const getLoanAccountId = async (credential: ICredential) =>
  getAccountIds(credential).then((x) => x!.loan);

export const getEarningAccountId = async (credential: ICredential) =>
  getAccountIds(credential).then((x) => x!.earning);

export const getFundingAccountId = async (credential: ICredential) =>
  getAccountIds(credential).then((x) => x!.funding);
