import { formatTime, UUID } from '@yuants/data-model';
import { readDataRecords, Terminal } from '@yuants/protocol';
import { listWatch } from '@yuants/utils';
import { defer, from, groupBy, map, mergeMap, Observable, repeat, retry, tap, toArray } from 'rxjs';

const internalTerminal = new Terminal(process.env.HOST_URL!, {
  terminal_id: `Portal/Internal/${UUID()}`,
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

defer(() =>
  readDataRecords(internalTerminal, {
    type: 'portal_relation',
  }),
)
  .pipe(
    //
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
    retry({ delay: 5000 }),
    repeat({ delay: 30_000 }),
  )
  .pipe(
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
            terminal.dispose();
          };
        });
      },
    ),
    tap(({ externalTerminal, services }) => {
      console.info(
        formatTime(Date.now()),
        `SetupServices: ${externalTerminal.host_url}`,
        `[${services.map((v) => `${v.direction}/${v.type}:${v.method}`).join(', ')}]`,
      );
      for (const service of services) {
        const [fromTerminal, toTerminal] =
          service.direction === 'export'
            ? [internalTerminal, externalTerminal]
            : [externalTerminal, internalTerminal];

        if (service.type === 'request' && service.method) {
          toTerminal.provideService(service.method, service.schema, (msg) =>
            fromTerminal.requestService(msg.method!, msg.req),
          );
        }
        if (service.type === 'channel') {
          toTerminal.provideChannel(service.schema, (msg) => fromTerminal.consumeChannel(msg));
        }
      }
    }),
  )
  .subscribe();
