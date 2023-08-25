import { IProduct } from '@yuants/protocol';
import { decodePath } from '../utils';
import { useAgent, useEffect, useMemo } from './basic-set';

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
    agent.productDataUnit.mapProductIdToProduct[product_id] || {
      datasource_id,
      product_id,
    }
  );
};
/**
 * 使用参数 (品种)
 * @param key - 参数名
 * @public
 */
export const useParamProduct = (key: string): IProduct => {
  const agent = useAgent();
  useEffect(() => {
    agent.paramsSchema.properties![key] = {
      type: 'string',
      format: 'product-key',
    };
  }, []);

  const { datasource_id, product_id } = useMemo(() => {
    const [datasource_id = '', product_id = ''] = decodePath(agent.params[key] || '');
    return { datasource_id, product_id };
  }, [agent.params[key]]);
  return useProduct(datasource_id, product_id);
};
