import { IProduct } from '@yuants/data-model';
import { Observable, defer, of, shareReplay, switchMap } from 'rxjs';
import { terminal$ } from '../Terminals';

export const useProducts = (() => {
  const hub: Record<string, Observable<IProduct[]>> = {};
  return (datasource_id: string) =>
    (hub[datasource_id] ??= defer(() => terminal$).pipe(
      switchMap((terminal) => terminal?.useProducts(datasource_id) ?? of([])),
      shareReplay(1),
    ));
})();
