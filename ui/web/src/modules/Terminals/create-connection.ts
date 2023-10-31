import { Terminal } from '@yuants/protocol';
import { debounceTime, first, map, shareReplay } from 'rxjs';
import { currentHostConfig$ } from '../Workbench/model';

export const terminal$ = currentHostConfig$.pipe(
  debounceTime(100),
  first((config) => !!(config?.host_url && config.terminal_id)),
  map(
    (config) =>
      new Terminal(config?.host_url!, {
        terminal_id: config?.terminal_id!,
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
