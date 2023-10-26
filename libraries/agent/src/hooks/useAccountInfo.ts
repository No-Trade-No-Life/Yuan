import { useAgent } from './basic-set';

/**
 * use Account Info
 * @public
 */
export const useAccountInfo = (
  account_id: string,
  currency: string = 'YYY',
  leverage: number = 1,
  initial_balance: number = 0,
) => {
  const agent = useAgent();
  return agent.accountInfoUnit.useAccount(account_id, currency, leverage, initial_balance);
};
