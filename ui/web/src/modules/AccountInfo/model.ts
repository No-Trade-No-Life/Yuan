import { decodePath } from '@yuants/data-model';
import { IAccountPerformance } from '@yuants/kernel';
import { useAccountInfo as _useAccountInfo } from '@yuants/protocol';
import {
  BehaviorSubject,
  EMPTY,
  defer,
  distinct,
  from,
  map,
  mergeMap,
  of,
  shareReplay,
  switchMap,
  toArray,
} from 'rxjs';
import { terminal$ } from '../Terminals';

export const useAccountInfo = (account_id: string) =>
  terminal$.pipe(switchMap((terminal) => (terminal ? _useAccountInfo(terminal, account_id) : EMPTY)));

export const accountIds$ = defer(() => terminal$).pipe(
  switchMap(
    (terminal) =>
      (terminal ? from(terminal.terminalInfos$) : of([])).pipe(
        mergeMap((terminals) =>
          from(terminals).pipe(
            mergeMap((terminalInfo) =>
              from(terminalInfo.channelIdSchemas || []).pipe(
                mergeMap((channelIdSchema) => {
                  if (typeof channelIdSchema.const === 'string') {
                    const [type, accountId] = decodePath(channelIdSchema.const);
                    if (type === 'AccountInfo' && accountId) {
                      return of(accountId);
                    }
                  }
                  return EMPTY;
                }),
              ),
            ),
            distinct(),
            toArray(),
            map((arr) => arr.sort()),
          ),
        ),
        shareReplay(1),
      ) ?? of([]),
  ),
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
