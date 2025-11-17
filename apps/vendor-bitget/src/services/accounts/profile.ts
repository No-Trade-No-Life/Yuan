import { createCache } from '@yuants/cache';
import { getAccountInfo, getDefaultCredential, type ICredential } from '../../api/private-api';

export interface IAccountProfile {
  uid: string;
  parentId: string;
  isMainAccount: boolean;
}

export const resolveAccountProfile = async (credential: ICredential): Promise<IAccountProfile> => {
  const res = await getAccountInfo(credential);
  if (res.msg !== 'success') {
    throw new Error(`Bitget getAccountInfo failed: ${res.code} ${res.msg}`);
  }
  const data = res.data;
  if (!data?.userId) {
    throw new Error(`Bitget getAccountInfo returned invalid payload: ${JSON.stringify(data)}`);
  }
  const uid = data.userId;
  const parentId = `${data.parentId ?? data.userId}`;
  return { uid, parentId, isMainAccount: uid === parentId };
};

export const accountProfileCache = createCache<IAccountProfile>(() =>
  resolveAccountProfile(getDefaultCredential()),
);

const requireDefaultProfile = async (): Promise<IAccountProfile> => {
  const profile = await accountProfileCache.query('');
  if (!profile) {
    throw new Error('Unable to resolve Bitget account profile');
  }
  return profile;
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
