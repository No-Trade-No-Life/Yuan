import { createCache } from '@yuants/cache';
import { isApiError } from '../../api/client';
import { getSpotAccountInfo, ICredential } from '../../api/private-api';

interface IAccountProfile {
  uid: string;
}

const PROFILE_TTL = 60_000;
const serializeCredential = (credential: ICredential) => JSON.stringify(credential);
const deserializeCredential = (key: string): ICredential => JSON.parse(key) as ICredential;

const accountProfileCache = createCache<IAccountProfile>(
  async (key) => {
    const spotAccountInfo = await getSpotAccountInfo(deserializeCredential(key));
    if (isApiError(spotAccountInfo)) {
      throw new Error(spotAccountInfo.msg);
    }
    return { uid: `${spotAccountInfo.uid}` };
  },
  { expire: PROFILE_TTL },
);

export const resolveAccountProfile = async (credential: ICredential): Promise<IAccountProfile> => {
  const key = serializeCredential(credential);
  const profile = await accountProfileCache.query(key);
  if (!profile) {
    throw new Error('Unable to resolve Binance account profile');
  }
  return profile;
};

export const getCredentialId = async (credential: ICredential): Promise<string> => {
  const profile = await resolveAccountProfile(credential);
  return profile.uid;
};
