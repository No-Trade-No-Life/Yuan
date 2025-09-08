import {
  BehaviorSubject,
  combineLatest,
  defer,
  map,
  Observable,
  of,
  repeat,
  retry,
  shareReplay,
  switchMap,
} from 'rxjs';
import { terminal$ } from '../Network';
import { IDeployment } from '@yuants/deploy';
import { requestSQL } from '@yuants/sql';

export const availableNodeUnitAddress$: Observable<string[]> = terminal$.pipe(
  switchMap(
    (terminal) =>
      terminal?.terminalInfos$.pipe(
        switchMap((terminalInfos) =>
          of(
            terminalInfos
              .map((info): string => {
                if (info.name !== '@yuants/node-unit') return '';
                const match = info.terminal_id.match(/^NodeUnit\/(\w+)$/);
                return match ? match[1] : '';
              })
              .filter(Boolean),
          ),
        ),
      ) || of([]),
  ),
  shareReplay(1),
);

export const refreshDeployments$ = new BehaviorSubject<void>(undefined);

export const deployments$ = combineLatest([terminal$, refreshDeployments$]).pipe(
  //
  switchMap(([terminal]) =>
    defer(() =>
      terminal ? requestSQL(terminal, `select * from deployment order by created_at desc`) : of([]),
    ).pipe(
      //
      map((x) => x as IDeployment[]),
      repeat({ delay: 2_000 }),
      retry({ delay: 2_000 }),
    ),
  ),
  shareReplay(1),
);
