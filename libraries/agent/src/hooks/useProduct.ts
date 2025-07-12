import { IProduct } from '@yuants/data-product';
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
      name: '',
      quote_currency: '',
      value_scale: 1,
      value_scale_unit: '',
      volume_step: 1,
      price_step: 1,
      allow_long: true,
      allow_short: true,
      margin_rate: 1,
      base_currency: '',
      value_based_cost: 0,
      volume_based_cost: 0,
      max_position: 0,
      max_volume: 0,
    }
  );
};
