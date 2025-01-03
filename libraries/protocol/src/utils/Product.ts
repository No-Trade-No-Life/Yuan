import { IProduct } from '@yuants/data-model';
import { observableToAsyncIterable } from '@yuants/utils';
import { Observable, defer, map, mergeAll, repeat, retry, shareReplay, timeout, toArray } from 'rxjs';
import { Terminal } from '../terminal';
import { readDataRecords } from './DataRecord';

/**
 * @public
 */
export const useProducts = (() => {
  const hub: Record<string, Observable<IProduct[]>> = {};
  return (terminal: Terminal, datasource_id: string) =>
    observableToAsyncIterable(
      (hub[datasource_id] ??= defer(() =>
        readDataRecords(terminal, {
          type: 'product',
          tags: {
            datasource_id,
          },
        }),
      ).pipe(
        //
        mergeAll(),
        map((x) => x.origin),
        toArray(),
        timeout(60000),
        retry({ delay: 1000 }),
        repeat({ delay: 86400_000 }),
        shareReplay(1),
      )),
    );
})();
