import { IDataRecord, IProduct } from '@yuants/data-model';

/**
 * Map product to data record
 * The product may be updated
 * Cannot be safely cached
 *
 * @public
 */
export const wrapProduct = (product: IProduct): IDataRecord<IProduct> => ({
  id: `${product.datasource_id}-${product.product_id}`,
  type: `product`,
  created_at: null,
  updated_at: Date.now(),
  frozen_at: null,
  tags: {
    datasource_id: product.datasource_id,
    product_id: product.product_id,
    quote_currency: product.quote_currency || '',
    base_currency: product.base_currency || '',
  },
  origin: product,
});
