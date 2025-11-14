import { createCache } from '@yuants/cache';
import { getDefaultCredential } from './api/client';
import { getFApiV2Balance } from './api/private-api';

const credential = getDefaultCredential();

interface IAsterAccountProfile {
  uid: string;
}

export const accountProfileCache = createCache<IAsterAccountProfile>(async () => {
  const balances = await getFApiV2Balance(credential);
  const alias = balances[0]?.accountAlias;
  if (!alias) {
    throw new Error(`Unable to resolve Aster account alias from balance response: ${JSON.stringify(balances)}`);
  }
  return { uid: alias };
});

const requireProfile = async () => {
  const profile = await accountProfileCache.query('default');
  if (!profile) {
    throw new Error('Aster account profile cache returned empty result');
  }
  return profile;
};

export const getPerpetualAccountId = async () => {
  const { uid } = await requireProfile();
  return `aster/${uid}/perp`;
};

export const getSpotAccountId = async () => {
  const { uid } = await requireProfile();
  return `aster/${uid}/spot`;
};
