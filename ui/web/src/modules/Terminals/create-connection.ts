import { Terminal } from '@yuants/protocol';
import { Observable, filter, shareReplay, switchMap } from 'rxjs';
import { currentHostConfig$ } from '../Workbench/model';

export const terminal$ = currentHostConfig$.pipe(
  filter(
    (config): config is Exclude<typeof config, undefined | null> =>
      !!(config && config.host_url && config.terminal_id),
  ),
  switchMap((config) => {
    return new Observable<Terminal>((subscriber) => {
      const terminal = new Terminal(config.host_url, {
        terminal_id: config.terminal_id,
        name: 'Workbench GUI',
        status: 'OK',
      });
      subscriber.next(terminal);
      return () => {
        terminal.dispose();
        subscriber.complete();
      };
    });
  }),
  shareReplay(1),
);

terminal$.forEach((terminal) => {
  const connection = terminal._conn;

  // for DEBUG
  connection.connection$.forEach((conn) => Object.assign(globalThis, { _conn: conn }));

  Object.assign(globalThis, { terminal });
});
