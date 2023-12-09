import { IAccountPerformance } from '@yuants/kernel';
import { BehaviorSubject, EMPTY, defer, of, shareReplay, switchMap } from 'rxjs';
import { terminal$ } from '../Terminals';

export const useAccountInfo = (account_id: string) =>
  terminal$.pipe(switchMap((terminal) => terminal?.useAccountInfo(account_id) ?? EMPTY));

export const accountIds$ = defer(() => terminal$).pipe(
  switchMap((terminal) => terminal?.accountIds$ ?? of([])),
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

export const accountFrameSeries$ = new BehaviorSubject<Record<string, IAccountFrame[]>>({});
export const accountPerformance$ = new BehaviorSubject<Record<string, IAccountPerformance>>({});
