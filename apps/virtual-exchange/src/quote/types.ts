import { IQuote } from '@yuants/data-quote';
import { IQuoteServiceMetadata } from '@yuants/exchange';

export type IQuoteKey = Exclude<keyof IQuote, 'datasource_id' | 'product_id' | 'updated_at'>;

/**
 * 用于批量更新的数据结构
 * 结构为：
 * product_id -> field_name (keyof IQuote) -> [value: string, updated_at: number]
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
  Partial<Record<IQuoteKey, [value: string, updated_at: number]>>
>;
export interface IQuoteState {
  update: (action: IQuoteUpdateAction) => void;
  dumpAsObject: () => IQuoteUpdateAction;
  getValueTuple: (product_id: string, field: IQuoteKey) => [string, number] | undefined;
  filter: (product_ids: string[], fields: IQuoteKey[], updated_at: number) => IQuoteUpdateAction;
  /**
   * 过滤并获取指定产品和字段的值，即便对应字段不存在或未更新也会返回空字符串
   *
   * @param product_ids
   * @param fields
   * @returns
   */
  filterValues: <K extends IQuoteKey>(
    product_ids: string[],
    fields: K[],
  ) => Record<string, Record<K, string>>;
}

export interface IQuoteProviderInstance {
  terminal_id: string;
  service_id: string;
}

/**
 * A "provider group" is a capability signature of `GetQuotes`.
 * Multiple vendor terminals may provide the same capability; VEX load-balances across instances.
 */
export interface IQuoteProviderGroup {
  group_id: string;
  meta: IQuoteServiceMetadata;
  mapTerminalIdToInstance: Map<string, IQuoteProviderInstance>;
}

export interface IQuoteRequire {
  product_id: string;
  field: IQuoteKey;
}
