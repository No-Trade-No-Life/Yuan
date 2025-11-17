import { isApiError } from '../../api/client';
import { getSpotAccountInfo, ICredential } from '../../api/private-api';

interface IAccountProfile {
  uid: string;
}

const cache = new Map<string, { profile: IAccountProfile; updated_at: number }>();
const PROFILE_TTL = 60_000;

export const resolveAccountProfile = async (credential: ICredential): Promise<IAccountProfile> => {
  const cacheKey = credential.access_key;
  const cached = cache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.updated_at < PROFILE_TTL) {
    return cached.profile;
  }
  const spotAccountInfo = await getSpotAccountInfo(credential);
  if (isApiError(spotAccountInfo)) {
    throw new Error(spotAccountInfo.msg);
  }
  const profile: IAccountProfile = { uid: `${spotAccountInfo.uid}` };
  cache.set(cacheKey, { profile, updated_at: now });
  return profile;
};
