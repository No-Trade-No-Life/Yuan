import { IAccountInfo, IPeriod, IProduct, ITick } from '@yuants/protocol';
import { Observable, defer, shareReplay, switchMap } from 'rxjs';
import { terminal$ } from './create-connection';

export const useAccountInfo = (() => {
  const hub: Record<string, Observable<IAccountInfo>> = {};
  return (account_id: string) =>
    (hub[account_id] ??= defer(() => terminal$).pipe(
      switchMap((terminal) => terminal.useAccountInfo(account_id)),
      shareReplay(1),
    ));
})();

export const useTick = (() => {
  const hub: Record<string, Observable<ITick>> = {};
  return (datasource_id: string, product_id: string) =>
    (hub[[datasource_id, product_id].join('\n')] ??= defer(() => terminal$).pipe(
      switchMap((terminal) => terminal.useTick(datasource_id, product_id)),
      shareReplay(1),
    ));
})();

export const usePeriod = (() => {
  const hub: Record<string, Observable<IPeriod>> = {};
  return (datasource_id: string, product_id: string, period_in_sec: number) =>
    (hub[[datasource_id, product_id, period_in_sec].join('\n')] ??= defer(() => terminal$).pipe(
      switchMap((terminal) => terminal.usePeriod(datasource_id, product_id, period_in_sec)),
      shareReplay(1),
    ));
})();

export const useProducts = (() => {
  const hub: Record<string, Observable<IProduct[]>> = {};
  return (datasource_id: string) =>
    (hub[datasource_id] ??= defer(() => terminal$).pipe(
      switchMap((terminal) => terminal.useProducts(datasource_id)),
      shareReplay(1),
    ));
})();
