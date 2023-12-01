import { IPeriod, ITick } from '@yuants/protocol';
import { Observable, defer, filter, shareReplay, switchMap } from 'rxjs';
import './TerminalList';
import { terminal$ } from './create-connection';
export { terminal$ } from './create-connection';

export const useTick = (() => {
  const hub: Record<string, Observable<ITick>> = {};
  return (datasource_id: string, product_id: string) =>
    (hub[[datasource_id, product_id].join('\n')] ??= defer(() => terminal$).pipe(
      filter((x): x is Exclude<typeof x, null> => !!x),
      switchMap((terminal) => terminal.useTick(datasource_id, product_id)),
      shareReplay(1),
    ));
})();

export const usePeriod = (() => {
  const hub: Record<string, Observable<IPeriod>> = {};
  return (datasource_id: string, product_id: string, period_in_sec: number) =>
    (hub[[datasource_id, product_id, period_in_sec].join('\n')] ??= defer(() => terminal$).pipe(
      filter((x): x is Exclude<typeof x, null> => !!x),
      switchMap((terminal) => terminal.usePeriod(datasource_id, product_id, period_in_sec)),
      shareReplay(1),
    ));
})();
