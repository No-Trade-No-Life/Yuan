import { IAccountInfo, IAccountInfoInput } from './interface';

/**
 * Wrap account information input into complete account information.
 * @param data - Input account information
 * @returns Wrapped account information with calculated fields
 * @public
 */
export const wrapAccountInfoInput = (data: IAccountInfoInput): IAccountInfo => {
  const positions = data.positions;
  const profit = positions.reduce((acc, cur) => acc + (cur.floating_profit || 0), 0);
  // 立即推送最新的数据
  return {
    updated_at: data.updated_at,
    account_id: data.account_id,
    money: {
      currency: data.money.currency,
      equity: data.money.equity,
      free: data.money.free,
      profit: profit,
      balance: data.money.equity - profit,
      used: data.money.equity - data.money.free,
    },
    positions: positions,
  };
};
