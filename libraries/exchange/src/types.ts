import { IQuote } from '@yuants/data-quote';

/**
 * Quote 字段类型，排除掉 product_id, updated_at, datasource_id 三个字段
 * @public
 */
export type IQuoteField = Exclude<keyof IQuote, 'product_id' | 'updated_at' | 'datasource_id'>;

/**
 * Quote Service Metadata
 * @public
 */
export interface IQuoteServiceMetadata<K extends IQuoteField = IQuoteField> {
  product_id_prefix: string;
  fields: K[];
  max_products_per_request?: number;
}

/**
 * Quote Service Request from VEX to Vendor
 * @public
 */
export interface IQuoteServiceRequestByVEX {
  product_ids: string[];
  fields: IQuoteField[];
}
/**
 * 用于批量更新的数据结构
 * 结构为：
 * product_id -\> field_name (keyof IQuote) -\> [value: string, updated_at: number]
 * 这样设计的目的是为了减少更新的数据量，同时保留每个字段的更新时间
 *
 * 例如：
 * ```json
 * {
 *   "product_123": {
 *     "last_price": ["100.5", 1627890123456],
 *     "volume": ["1500", 1627890123456]
 *   },
 *   "product_456": {
 *     "last_price": ["200.0", 1627890123456]
 *   }
 * }
 * ```
 * @public
 */
export type IQuoteUpdateAction = Record<
  string,
  Partial<Record<IQuoteField, [value: string, updated_at: number]>>
>;
