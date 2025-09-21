import { IDeployment } from '@yuants/deploy';
import { requestSQL } from '@yuants/sql';
import {
  BehaviorSubject,
  combineLatest,
  concat,
  defer,
  filter,
  from,
  map,
  Observable,
  of,
  repeat,
  retry,
  shareReplay,
  switchMap,
  toArray,
} from 'rxjs';
import { terminal$ } from '../Network';

export const availableNodeUnit$: Observable<
  Array<{ node_unit_address: string; node_unit_name: string; node_unit_version: string }>
> = terminal$.pipe(
  switchMap(
    (terminal) =>
      terminal?.terminalInfos$.pipe(
        switchMap((terminalInfos) =>
          from(terminalInfos).pipe(
            map((info) => info.tags || {}),
            filter((tags) => tags.node_unit === 'true'),
            map((tags) => ({
              node_unit_address: tags.node_unit_address || '',
              node_unit_name: tags.node_unit_name || '',
              node_unit_version: tags.node_unit_version || '',
            })),
            toArray(),
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
    concat(
      of(undefined),
      defer(() =>
        terminal
          ? requestSQL<IDeployment[]>(terminal, `select * from deployment order by created_at desc`)
          : of([] as IDeployment[]),
      ).pipe(
        //
        repeat({ delay: 2_000 }),
        retry({ delay: 2_000 }),
      ),
    ),
  ),
  shareReplay(1),
);
