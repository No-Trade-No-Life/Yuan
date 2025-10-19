import { IServiceInfo, Terminal } from '@yuants/protocol';
import { requestSQL } from '@yuants/sql';
import { formatTime, listWatch, UUID } from '@yuants/utils';
import Ajv from 'ajv';
import {
  debounceTime,
  defer,
  filter,
  from,
  mergeMap,
  Observable,
  repeat,
  ReplaySubject,
  retry,
  share,
  switchMap,
  tap,
  toArray,
} from 'rxjs';

const internalTerminal = Terminal.fromNodeEnv();

interface IPortalConfig {
  id: string;
  external_host_url: string;
  is_import: boolean;
  filter_schema: any;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

const cacheTerminal$: Record<string, Observable<Terminal>> = {};
const useTerminal = (hostUrl: string) =>
  (cacheTerminal$[hostUrl] ??= new Observable<Terminal>((sub) => {
    const terminal = new Terminal(
      hostUrl,
      {
        terminal_id: `Portal/External/${UUID()}`,
        name: 'Portal-External',
      },
      { disableTerminate: true, disableMetrics: true },
    );
    sub.next(terminal);
    sub.add(() => {
      terminal.dispose();
    });
  }).pipe(
    //
    share({ resetOnRefCountZero: true, connector: () => new ReplaySubject(1) }),
  ));

const runService = (serviceInfo: IServiceInfo, target: Terminal, source: Terminal) =>
  new Observable((sub) => {
    const service = target.server.provideService(serviceInfo.method, serviceInfo.schema, (msg) =>
      source.client.requestService(serviceInfo.method, msg.req),
    );
    sub.add(() => {
      service.dispose();
    });
  }).pipe(
    tap({
      subscribe: () =>
        console.info(
          formatTime(Date.now()),
          'RunService',
          `service_id=${serviceInfo.service_id}, target=${target.terminal_id}, source=${source.terminal_id}`,
        ),
      finalize: () =>
        console.info(
          formatTime(Date.now()),
          'StopService',
          `service_id=${serviceInfo.service_id}, target=${target.terminal_id}, source=${source.terminal_id}`,
        ),
    }),
  );

const filterServiceInfoList = (
  terminal: Terminal,
  validator: (serviceInfo: IServiceInfo) => boolean,
): Observable<IServiceInfo[]> =>
  terminal.terminalInfos$.pipe(
    debounceTime(500),
    switchMap((terminalInfos) =>
      from(terminalInfos).pipe(
        mergeMap((terminalInfo) =>
          from(Object.values(terminalInfo.serviceInfo || {})).pipe(
            filter((serviceInfo) => validator(serviceInfo)),
          ),
        ),
        toArray(),
      ),
    ),
  );

const runPortalConfig = (config: IPortalConfig): Observable<any> => {
  console.info(formatTime(Date.now()), `RunPortalConfig: ${config.id}`);
  const validator = new Ajv({ strict: false, strictSchema: false }).compile(config.filter_schema);

  if (config.is_import) {
    return useTerminal(config.external_host_url).pipe(
      switchMap((externalTerminal) =>
        filterServiceInfoList(externalTerminal, validator).pipe(
          listWatch(
            (x) => x.service_id,
            (x) => runService(x, internalTerminal, externalTerminal),
          ),
        ),
      ),
    );
  }

  return filterServiceInfoList(internalTerminal, validator).pipe(
    listWatch(
      (x) => x.service_id,
      (x) =>
        useTerminal(config.external_host_url).pipe(
          switchMap((externalTerminal) => runService(x, externalTerminal, internalTerminal)),
        ),
    ),
  );
};

defer(() => requestSQL<IPortalConfig[]>(internalTerminal, `select * from portal_config where enabled = true`))
  .pipe(
    repeat({ delay: 5000 }),
    retry({ delay: 5000 }),
    listWatch(
      (x) => x.id,
      (x) =>
        defer(() => runPortalConfig(x)).pipe(
          repeat({ delay: 1000 }),
          retry({ delay: 1000 }),
          tap({
            subscribe: () => console.info(formatTime(Date.now()), 'StartPortalConfig', x.id),
            finalize: () => console.info(formatTime(Date.now()), 'StopPortalConfig', x.id),
          }),
        ),
      (a, b) => a.updated_at === b.updated_at,
    ),
  )
  .subscribe();
