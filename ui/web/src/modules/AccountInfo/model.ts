import { AccountPerformanceUnit, IAccountPerformance } from '@yuants/kernel';
import { IAccountInfo } from '@yuants/protocol';
import { BehaviorSubject, Observable, defer, shareReplay, switchMap } from 'rxjs';
import { terminal$ } from '../Terminals';

export const useAccountInfo = (() => {
  const hub: Record<string, Observable<IAccountInfo>> = {};
  return (account_id: string) =>
    (hub[account_id] ??= defer(() => terminal$).pipe(
      switchMap((terminal) => terminal.useAccountInfo(account_id)),
      shareReplay(1),
    ));
})();

export const accountIds$ = defer(() => terminal$).pipe(
  switchMap((terminal) => terminal.accountIds$),
  shareReplay(1),
);

export interface IAccountFrame {
  timestamp_in_us: number;
  equity: number;
  balance: number;
  profit: number;
  margin: number;
  require: number;
}

export const accountFrameSeries$ = new BehaviorSubject<IAccountFrame[]>([]);
export const accountPerformance$ = new BehaviorSubject<IAccountPerformance>(
  AccountPerformanceUnit.makeInitAccountPerformance(''),
);
