import { Terminal } from '@yuants/protocol';
import { requestSQL } from '@yuants/sql';
import { formatTime, listWatch, UUID } from '@yuants/utils';
import {
  combineLatest,
  defer,
  filter,
  from,
  groupBy,
  map,
  mergeMap,
  Observable,
  repeat,
  retry,
  shareReplay,
  tap,
  toArray,
} from 'rxjs';

const internalTerminal = new Terminal(process.env.HOST_URL!, {
  terminal_id: `Portal/Internal/${UUID()}`,
  enable_WebRTC: process.env.ENABLE_WEBRTC === 'true',
  name: 'Portal-Internal',
});

interface IPortalRelation {
  external_host_url: string;
  type: 'request' | 'channel';
  direction: 'export' | 'import';
  method?: string;
  schema: any;
}

const portalTerminals$ = from(internalTerminal.terminalInfos$).pipe(
  mergeMap((x) =>
    from(x).pipe(
      //
      filter((xx) => xx.name === internalTerminal.terminalInfo.name),
      map((xx) => xx.terminal_id),
      toArray(),
      filter((x) => x.length > 0 && x.some((xx) => xx === internalTerminal.terminal_id)), // ISSUE: ignore setup-phrase no self
    ),
  ),
  shareReplay(1),
  tap((arr) => console.info(formatTime(Date.now()), 'FindPortals', arr.length)),
);

const portalRelation$ = defer(() =>
  requestSQL<IPortalRelation[]>(internalTerminal, `select * from portal_relation order by updated_at`),
).pipe(
  //
  retry({ delay: 5000 }),
  repeat({ delay: 30_000 }),
  shareReplay(1),
  tap((arr) => console.info(formatTime(Date.now()), 'FetchedPortalRelations', arr.length)),
);

const portalRelationsGroupByExternalHost$ = portalRelation$.pipe(
  mergeMap((x) =>
    from(x).pipe(
      groupBy((x) => x.external_host_url),
      mergeMap((group) =>
        group.pipe(
          //
          toArray(),
          map((v) => ({ host_url: group.key, items: v })),
        ),
      ),
      toArray(),
    ),
  ),
);

combineLatest([portalRelationsGroupByExternalHost$, portalTerminals$])
  .pipe(
    // Load balance: many portals in one host, sharing workload
    map(([list, portals]) => {
      const idx = portals.indexOf(internalTerminal.terminal_id);
      const N = list.length;
      const M = portals.length;
      const size = Math.floor(N / M) + (N % M > idx ? 1 : 0);
      const startIdx = Math.floor(N / M) * idx + Math.min(idx, N % M);
      const endIdx = startIdx + size;
      return list.slice(startIdx, endIdx);
    }),
  )
  .pipe(
    tap((arr) => console.info(formatTime(Date.now()), 'OwnsHostsCount', arr.length)),
    listWatch(
      (x) => x.host_url,
      (x) => {
        return new Observable<{ externalTerminal: Terminal; services: IPortalRelation[] }>((subscriber) => {
          console.info(formatTime(Date.now()), `SetupExternalTerminal: ${x.host_url}`);
          const terminal = new Terminal(
            x.host_url,
            {
              terminal_id: `Portal/External/${UUID()}`,
              name: 'Portal-External',
            },
            { disableTerminate: true, disableMetrics: true },
          );
          subscriber.next({ externalTerminal: terminal, services: x.items });
          return () => {
            console.info(formatTime(Date.now()), `DisposeExternalTerminal: ${x.host_url}`);
            terminal.dispose();
          };
        });
      },
      (a, b) => JSON.stringify(a) === JSON.stringify(b),
    ),
    tap(({ externalTerminal, services }) => {
      console.info(formatTime(Date.now()), `SetupServices: ${externalTerminal.host_url}`);
      for (const service of services) {
        const [fromTerminal, toTerminal] =
          service.direction === 'export'
            ? [internalTerminal, externalTerminal]
            : [externalTerminal, internalTerminal];

        if (service.type === 'request' && service.method) {
          console.info(formatTime(Date.now()), `SetupService: ${service.method}`);
          toTerminal.provideService(service.method, service.schema, (msg) =>
            fromTerminal.requestService(msg.method!, msg.req),
          );
        }
      }
    }),
  )
  .subscribe();
