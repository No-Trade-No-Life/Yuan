import { IAccountPerformance } from '@yuants/kernel';
import { useAccountInfo as _useAccountInfo } from '@yuants/data-account';
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
              from(Object.values(terminalInfo.serviceInfo || {})).pipe(
                mergeMap((serviceInfo) => {
                  if (serviceInfo.method === 'SubscribeChannel/AccountInfo') {
                    if (typeof serviceInfo.schema.properties?.channel_id === 'object') {
                      if (typeof serviceInfo.schema.properties?.channel_id.const === 'string') {
                        return of(serviceInfo.schema.properties?.channel_id.const);
                      }
                      if (typeof serviceInfo.schema.properties?.channel_id.allOf === 'object') {
                        for (const item of serviceInfo.schema.properties?.channel_id.allOf) {
                          // @ts-ignore
                          if (typeof item?.const === 'string') {
                            // @ts-ignore
                            return of(item?.const);
                          }
                        }
                      }
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
