import { decodePath } from '@yuants/data-model';
import { IProduct } from '@yuants/protocol';
import { useAgent, useEffect, useMemo } from './basic-set';
import { useParamSchema } from './params-set';

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
 * Use parameter as Product
 * @param key - parameter's name
 * @public
 */
export const useParamProduct = (key: string): IProduct => {
  const productKey = useParamSchema<string>(key, {
    type: 'string',
    format: 'product-key',
  });

  const { datasource_id, product_id } = useMemo(() => {
    const [datasource_id = '', product_id = ''] = decodePath(productKey || '');
    return { datasource_id, product_id };
  }, []);
  return useProduct(datasource_id, product_id);
};
