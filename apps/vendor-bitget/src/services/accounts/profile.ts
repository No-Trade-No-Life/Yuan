import { createCache } from '@yuants/cache';
import { getDefaultCredential } from '../../api/client';
import { getAccountSettings } from '../../api/private-api';
import { ICredential } from '../../api/types';

export interface IAccountProfile {
  uid: string;
  parentId: string;
  isMainAccount: boolean;
}

const PROFILE_TTL = 60_000;
const fetchAccountProfile = async (credential: ICredential): Promise<IAccountProfile> => {
  const res = await getAccountSettings(credential);
  if (res.msg !== 'success') {
    throw new Error(`Bitget getAccountSettings failed: ${res.code} ${res.msg}`);
  }
  const data = res.data;
  if (!data?.uid) {
    throw new Error(`Bitget getAccountSettings returned invalid payload: ${JSON.stringify(data)}`);
  }
  const uid = data.uid;
  const parentId = uid;
  return { uid, parentId, isMainAccount: true };
};

const serializeCredential = (credential: ICredential) => JSON.stringify(credential);
const deserializeCredential = (key: string): ICredential => JSON.parse(key) as ICredential;

export const accountProfileCache = createCache<IAccountProfile>(
  async (key) => {
    const credential = deserializeCredential(key);
    if (!credential) return undefined;
    return fetchAccountProfile(credential);
  },
  { expire: PROFILE_TTL },
);

export const resolveAccountProfile = async (credential: ICredential): Promise<IAccountProfile> => {
  const cacheKey = serializeCredential(credential);
  const profile = await accountProfileCache.query(cacheKey);
  if (!profile) {
    throw new Error('Unable to resolve Bitget account profile');
  }
  return profile;
};

const requireDefaultProfile = async (): Promise<IAccountProfile> => {
  return resolveAccountProfile(getDefaultCredential());
};

export const getFuturesAccountId = async () => {
  const { uid } = await requireDefaultProfile();
  return `bitget/${uid}/futures/USDT`;
};

export const getSpotAccountId = async () => {
  const { uid } = await requireDefaultProfile();
  return `bitget/${uid}/spot/USDT`;
};

export const getParentAccountId = async () => {
  const { parentId } = await requireDefaultProfile();
  return parentId;
};

export const getUid = async () => {
  const { uid } = await requireDefaultProfile();
  return uid;
};

export const isMainAccount = async () => {
  const { isMainAccount } = await requireDefaultProfile();
  return isMainAccount;
};
