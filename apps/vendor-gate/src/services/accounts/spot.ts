import { getSpotAccounts, ICredential } from '../../api/private-api';

export const getSpotAccountInfo = async (credential: ICredential, account_id: string) => {
  const res = await getSpotAccounts(credential);
  if (!Array.isArray(res)) {
    throw new Error('Failed to load spot balances');
  }
  const balance = Number(res.find((item) => item.currency === 'USDT')?.available ?? '0');
  return {
    account_id,
    money: {
      currency: 'USDT',
      equity: balance,
      free: balance,
    },
    positions: [],
  };
};
