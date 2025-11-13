import { ICredential, getFinanceSavingsBalance } from '../api/private-api';
import { IAccountInfoCore } from './types';

export const getEarningAccountInfo = async (credential: ICredential): Promise<IAccountInfoCore> => {
  const offers = await getFinanceSavingsBalance(credential, {});
  const equity = offers.data.filter((x) => x.ccy === 'USDT').reduce((acc, x) => acc + +x.amt, 0);
  const free = equity;

  return {
    money: {
      currency: 'USDT',
      equity,
      free,
    },
    positions: [],
  };
};
