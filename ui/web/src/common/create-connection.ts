import { Terminal } from '@yuants/protocol';
import { debounceTime, first, map, shareReplay } from 'rxjs';
import { currentHostConfig$ } from '../modules/Workbench/model';

export const terminal$ = currentHostConfig$.pipe(
  debounceTime(100),
  first((config) => !!(config?.HV_URL && config.TERMINAL_ID)),
  map(
    (config) =>
      new Terminal(config?.HV_URL!, {
        terminal_id: config?.TERMINAL_ID!,
        name: 'Workbench GUI',
        status: 'OK',
      }),
  ),
  shareReplay(1),
);

terminal$.forEach((terminal) => {
  const connection = terminal._conn;

  // for DEBUG
  connection.connection$.forEach((conn) => Object.assign(globalThis, { _conn: conn }));

  Object.assign(globalThis, { terminal });
});
