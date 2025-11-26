import { createCache } from '@yuants/cache';
import { getAccountDetail, ICredential } from '../../api/private-api';
import { encodePath } from '@yuants/utils';

export interface IAccountProfile {
  uid: string;
  future: string;
  spot: string;
  unified: string;
}

const PROFILE_TTL = 60_000;

const serializeCredential = (credential: ICredential) => JSON.stringify(credential);
const deserializeCredential = (key: string): ICredential => JSON.parse(key) as ICredential;

const accountProfileCache = createCache<IAccountProfile>(
  async (key: string) => {
    const credential = deserializeCredential(key);
    const detail = await getAccountDetail(credential);
    const uid = `${detail.user_id}`;
    return {
      uid,
      future: `gate/${uid}/future/USDT`,
      spot: `gate/${uid}/spot/USDT`,
      unified: `gate/${uid}/unified/USDT`,
    };
  },
  { expire: PROFILE_TTL },
);

export const resolveAccountProfile = async (credential: ICredential): Promise<IAccountProfile> => {
  const profile = await accountProfileCache.query(serializeCredential(credential));
  if (!profile) {
    throw new Error('Unable to resolve Gate account profile');
  }
  return profile;
};

export const getAccountIds = resolveAccountProfile;

export const getCredentialId = async (credential: ICredential): Promise<string> => {
  const spotAccountInfo = await resolveAccountProfile(credential);
  return encodePath('GATE', spotAccountInfo.uid);
};
