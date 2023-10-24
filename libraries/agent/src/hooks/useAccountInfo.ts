import { useAgent } from './basic-set';

/**
 * use Account Info
 * @public
 */
export const useAccountInfo = (account_id?: string) => {
  const agent = useAgent();
  return agent.accountInfoUnit.useAccount(
    account_id || agent.options.account_id,
    agent.options.currency,
    agent.options.leverage,
    agent.options.initial_balance,
  );
};
