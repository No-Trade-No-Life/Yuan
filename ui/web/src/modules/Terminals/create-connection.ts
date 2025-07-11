import { Terminal } from '@yuants/protocol';
import { UUID } from '@yuants/utils';
import { useObservableState } from 'observable-hooks';
import { Observable, filter, shareReplay, switchMap } from 'rxjs';
import { currentHostConfig$ } from '../Workbench/model';

export const terminal$: Observable<Terminal | null> = currentHostConfig$.pipe(
  filter((config): config is Exclude<typeof config, undefined> => config !== undefined),
  switchMap((config) => {
    return new Observable<Terminal | null>((subscriber) => {
      if (!config) {
        subscriber.next(null);
        return;
      }
      const terminal = new Terminal(config.host_url, {
        terminal_id: `@GUI/${UUID()}`,
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
  // for DEBUG
  Object.assign(globalThis, { terminal });
});

export const useTerminal = () => useObservableState(terminal$);
