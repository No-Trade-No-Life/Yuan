import { IProduct } from '@yuants/data-model';
import { useAgent, useEffect } from './basic-set';

/**
 * 使用品种信息
 * @param datasource_id - 数据源ID
 * @param product_id - 品种ID
 * @public
 */
export const useProduct = (datasource_id: string, product_id: string): IProduct => {
  const agent = useAgent();
  useEffect(() => {
    agent.productLoadingUnit?.productTasks.push({
      datasource_id,
      product_id,
    });
  }, []);
  return (
    agent.productDataUnit.getProduct(datasource_id, product_id) || {
      datasource_id,
      product_id,
    }
  );
};
