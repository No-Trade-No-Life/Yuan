import { getAccountDetail, ICredential } from '../../api/private-api';

export interface IAccountIds {
  uid: string;
  future: string;
  spot: string;
  unified: string;
}

const mapKeyToIds = new Map<string, Promise<IAccountIds>>();

const getCacheKey = (credential: ICredential) => credential.access_key;

export const getAccountIds = (credential: ICredential): Promise<IAccountIds> => {
  const cacheKey = getCacheKey(credential);
  if (!mapKeyToIds.has(cacheKey)) {
    const promise = getAccountDetail(credential)
      .then((detail) => {
        const uid = `${detail.user_id}`;
        return {
          uid,
          future: `gate/${uid}/future/USDT`,
          spot: `gate/${uid}/spot/USDT`,
          unified: `gate/${uid}/unified/USDT`,
        };
      })
      .catch((error) => {
        mapKeyToIds.delete(cacheKey);
        throw error;
      });
    mapKeyToIds.set(cacheKey, promise);
  }
  return mapKeyToIds.get(cacheKey)!;
};
