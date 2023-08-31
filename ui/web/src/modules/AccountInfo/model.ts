import { BehaviorSubject, defer, shareReplay, switchMap } from 'rxjs';
import { terminal$ } from '../../common/create-connection';
import { AccountPerformanceUnit, IAccountPerformance } from '@yuants/kernel';

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
