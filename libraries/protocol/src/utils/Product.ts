import { IDataRecord, IProduct } from '@yuants/data-model';
import { observableToAsyncIterable } from '@yuants/utils';
import { Observable, defer, from, map, mergeMap, repeat, retry, shareReplay, timeout, toArray } from 'rxjs';
import { IQueryProductsRequest } from '../services/pull';
import { Terminal } from '../terminal';
import { readDataRecords } from './DataRecord';

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

/**
 * @public
 */
export const queryProducts = (terminal: Terminal, req: IQueryProductsRequest) =>
  observableToAsyncIterable(
    defer(() =>
      readDataRecords(terminal, { type: 'product', tags: { datasource_id: req.datasource_id! } }),
    ).pipe(
      mergeMap((x) => from(x).pipe(map((dataRecord) => dataRecord.origin))),
      toArray(),
    ),
  );

/**
 * @public
 */
export const useProducts = (() => {
  const hub: Record<string, Observable<IProduct[]>> = {};
  return (terminal: Terminal, datasource_id: string) =>
    observableToAsyncIterable(
      (hub[datasource_id] ??= defer(() =>
        queryProducts(terminal, {
          datasource_id,
        }),
      ).pipe(
        //
        timeout(60000),
        retry({ delay: 1000 }),
        repeat({ delay: 86400_000 }),
        shareReplay(1),
      )),
    );
})();
