import { IAccountInfo, IAccountMoney } from './interface';

/**
 * @public
 */
export const createEmptyAccountInfo = (
  account_id: string,
  currency: string,
  leverage: number = 1,
  initial_balance: number = 0,
): IAccountInfo => {
  const money: IAccountMoney = {
    currency,
    leverage,
    equity: initial_balance,
    balance: initial_balance,
    profit: 0,
    used: 0,
    free: 0,
  };
  return {
    updated_at: 0,
    account_id,
    money: money,
    positions: [],
  };
};
