import { createCache } from '@yuants/cache';
import { getAccount, getUid } from '../api/private-api';

export const uidCache = createCache((key) => getUid(JSON.parse(key)));

const huobiAccounts = createCache((key) => getAccount(JSON.parse(key)));

export const superMarginAccountUidCache = createCache((key) =>
  huobiAccounts.query(key).then((x) => x?.data.find((v) => v.type === 'super-margin')?.id),
);

export const spotAccountUidCache = createCache((key) =>
  huobiAccounts.query(key).then((x) => x?.data.find((v) => v.type === 'spot')?.id),
);
