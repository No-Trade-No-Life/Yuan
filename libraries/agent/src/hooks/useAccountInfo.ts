import { useAgent } from './basic-set';

/**
 * use Account Info
 * @public
 */
export const useAccountInfo = (options?: {
  account_id?: string;
  currency?: string;
  leverage?: number;
  initial_balance?: number;
}) => {
  const agent = useAgent();
  const account_id = options?.account_id || agent.kernel.id + '-default';
  const currency = options?.currency || 'YYY';
  const leverage = options?.leverage || 1;
  const initial_balance = options?.initial_balance || 0;

  return agent.accountInfoUnit.useAccount(account_id, currency, leverage, initial_balance);
};
