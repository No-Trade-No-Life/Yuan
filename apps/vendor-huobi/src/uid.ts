import { createCache } from '@yuants/cache';
import { getAccount, getUid } from './api/private-api';

export const uidCache = createCache((key) => getUid(JSON.parse(key)));

const huobiAccounts = createCache((key) => getAccount(JSON.parse(key)));

export const superMarginAccountUidCache = createCache((key) =>
  huobiAccounts.query(key).then((x) => x?.data.find((v) => v.type === 'super-margin')?.id),
);

export const spotAccountUidCache = createCache((key) =>
  huobiAccounts.query(key).then((x) => x?.data.find((v) => v.type === 'spot')?.id),
);

export const getAccountIds = async (key: string) => {
  const uid = await uidCache.query(key);
  if (!uid) throw new Error('Failed to get UID');

  const account_id = `huobi/${uid}`;
  const SPOT_ACCOUNT_ID = `${account_id}/spot/usdt`;
  const SUPER_MARGIN_ACCOUNT_ID = `${account_id}/super-margin`;
  const SWAP_ACCOUNT_ID = `${account_id}/swap`;

  return {
    spot: SPOT_ACCOUNT_ID,
    superMargin: SUPER_MARGIN_ACCOUNT_ID,
    swap: SWAP_ACCOUNT_ID,
  };
};
