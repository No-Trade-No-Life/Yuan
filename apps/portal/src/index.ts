import { formatTime, UUID } from '@yuants/data-model';
import { readDataRecords, Terminal } from '@yuants/protocol';
import { listWatch } from '@yuants/utils';
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

declare module '@yuants/data-model/lib/DataRecord' {
  interface IDataRecordTypes {
    portal_relation: IPortalRelation;
  }
}

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
  readDataRecords(internalTerminal, {
    type: 'portal_relation',
    options: {
      sort: [['updated_at', 1]],
    },
  }),
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
      groupBy((x) => x.origin.external_host_url),
      mergeMap((group) =>
        group.pipe(
          //
          map((v) => v.origin),
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
          const terminal = new Terminal(x.host_url, {
            terminal_id: `Portal/External/${UUID()}`,
            name: 'Portal-External',
          });
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
        externalTerminal.provideService('Terminate', {}, async (msg) => {
          return {
            res: {
              code: 403,
              message: `You are not allowed to terminate this terminal`,
            },
          };
        });
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
        if (service.type === 'channel') {
          console.info(formatTime(Date.now()), `SetupChannel: ${service.method}`);
          toTerminal.provideChannel(service.schema, (msg) => fromTerminal.consumeChannel(msg));
        }
      }
    }),
  )
  .subscribe();
