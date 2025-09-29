import { IQuote } from '@yuants/data-quote';
import { Terminal } from '@yuants/protocol';
import { writeToSQL } from '@yuants/sql';
import { encodePath } from '@yuants/utils';
import { groupBy, mergeMap, scan, Subject } from 'rxjs';

export const quoteToWrite$ = new Subject<Partial<IQuote> & Pick<IQuote, 'datasource_id' | 'product_id'>>();

quoteToWrite$
  .pipe(
    groupBy((x) => encodePath(x.datasource_id, x.product_id)),
    mergeMap((group$) => {
      return group$.pipe(
        //
        scan((acc, cur) => Object.assign(acc, cur), {} as Partial<IQuote>),
      );
    }),
    writeToSQL({
      terminal: Terminal.fromNodeEnv(),
      writeInterval: 1000,
      tableName: 'quote',
      conflictKeys: ['datasource_id', 'product_id'],
    }),
  )
  .subscribe();
