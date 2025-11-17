import { createCache } from '@yuants/cache';
import { isApiError } from '../../api/client';
import { getSpotAccountInfo, ICredential } from '../../api/private-api';

interface IAccountProfile {
  uid: string;
}

const PROFILE_TTL = 60_000;
const credentialStore = new Map<string, ICredential>();

const accountProfileCache = createCache<IAccountProfile>(
  async (key) => {
    const credential = credentialStore.get(key);
    if (!credential) return undefined;
    const spotAccountInfo = await getSpotAccountInfo(credential);
    if (isApiError(spotAccountInfo)) {
      throw new Error(spotAccountInfo.msg);
    }
    return { uid: `${spotAccountInfo.uid}` };
  },
  { expire: PROFILE_TTL },
);

export const resolveAccountProfile = async (credential: ICredential): Promise<IAccountProfile> => {
  const key = credential.access_key;
  credentialStore.set(key, credential);
  const profile = await accountProfileCache.query(key);
  if (!profile) {
    throw new Error('Unable to resolve Binance account profile');
  }
  return profile;
};
