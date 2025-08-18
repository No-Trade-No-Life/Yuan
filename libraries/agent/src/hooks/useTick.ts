import { RealtimeTickLoadingUnit } from '@yuants/kernel';
import { useAgent, useEffect, useProduct } from '.';
import { IQuote } from '../../../data-quote/lib';

/**
 * Use Tick
 * @public
 */
export const useTick = (
  account_id: string,
  datasource_id: string,
  product_id: string,
): IQuote | undefined => {
  const agent = useAgent();

  useProduct(datasource_id, product_id);

  useEffect(() => {
    agent.kernel.findUnit(RealtimeTickLoadingUnit)?.addTickTask(datasource_id, product_id, account_id);
  }, []);

  return agent.tickDataUnit.getTick(account_id, product_id);
};
