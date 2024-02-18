import { ITick } from '@yuants/data-model';
import { RealtimeTickLoadingUnit } from '@yuants/kernel';
import { useAgent, useEffect, useProduct } from '.';

/**
 * Use Tick
 * @public
 */
export const useTick = (account_id: string, datasource_id: string, product_id: string): ITick | undefined => {
  const agent = useAgent();

  useProduct(datasource_id, product_id);

  useEffect(() => {
    agent.kernel.findUnit(RealtimeTickLoadingUnit)?.addTickTask(datasource_id, product_id, account_id);
  }, []);

  return agent.tickDataUnit.getTick(account_id, product_id);
};
