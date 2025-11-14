import { createCache } from '@yuants/cache';
import { getAccount, getDefaultCredential, getUid, ICredential } from './api/private-api';

const credential = getDefaultCredential();

export const akToCredential = new Map<string, ICredential>();

export const uidCache = createCache((ak) => getUid(akToCredential.get(ak) || credential));

const huobiAccounts = createCache((ak) => getAccount(akToCredential.get(ak) || credential));

export const superMarginAccountUidCache = createCache((ak) =>
  huobiAccounts.query(ak).then((x) => x?.data.find((v) => v.type === 'super-margin')?.id),
);

export const spotAccountUidCache = createCache((ak) =>
  huobiAccounts.query(ak).then((x) => x?.data.find((v) => v.type === 'spot')?.id),
);

export const getAccountIds = async (ak = '') => {
  const uid = await uidCache.query(ak);
  if (!uid) throw new Error('Failed to get UID');

  const account_id = `huobi/${uid}`;
  const SPOT_ACCOUNT_ID = `${account_id}/spot/usdt`;
  const SUPER_MARGIN_ACCOUNT_ID = `${account_id}/super-margin`;
  const SWAP_ACCOUNT_ID = `${account_id}/swap`;

  return {
    main: account_id,
    spot: SPOT_ACCOUNT_ID,
    superMargin: SUPER_MARGIN_ACCOUNT_ID,
    swap: SWAP_ACCOUNT_ID,
  };
};
