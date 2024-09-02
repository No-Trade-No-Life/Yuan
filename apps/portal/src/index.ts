import { formatTime, UUID } from '@yuants/data-model';
import { readDataRecords, Terminal } from '@yuants/protocol';
import { batchGroupBy, switchMapWithComplete } from '@yuants/utils';
import {
  defer,
  distinctUntilChanged,
  from,
  groupBy,
  map,
  mergeMap,
  Observable,
  OperatorFunction,
  pipe,
  repeat,
  retry,
  tap,
  toArray,
} from 'rxjs';

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

/**
 * list and watch a source of items, and apply consumer to each newly added item,
 * the consumer should return an observable that completes when the item is fully processed,
 *
 * consumer will be cancelled when the item is removed.
 *
 * @param hashKey - hash key function to group items
 * @param consumer - consumer function to process each item
 * @returns
 */
const listWatch = <T, K>(
  hashKey: (item: T) => string,
  consumer: (item: T) => Observable<K>,
): OperatorFunction<T[], K> => {
  return pipe(
    batchGroupBy(hashKey),
    mergeMap((group) =>
      group.pipe(
        // Take first but not complete until group complete
        distinctUntilChanged(() => true),
        switchMapWithComplete(consumer),
      ),
    ),
  );
};

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
