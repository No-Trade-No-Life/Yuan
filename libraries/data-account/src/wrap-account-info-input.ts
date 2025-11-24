import { IAccountInfo, IPosition } from './interface';

/**
 * Wrap account information input into complete account information.
 * @param data - Input account information
 * @returns Wrapped account information with calculated fields
 * @public
 */
export const wrapAccountInfoInput = (
  updated_at: number,
  account_id: string,
  positions: IPosition[],
): IAccountInfo => {
  const equity = positions.reduce((acc, cur) => acc + (cur.floating_profit || 0), 0);

  // 立即推送最新的数据
  return {
    updated_at: updated_at,
    account_id: account_id,
    money: {
      currency: '',
      equity: equity,
      free: equity,
      profit: equity,
      balance: 0,
      used: 0,
    },
    positions: positions,
  };
};
