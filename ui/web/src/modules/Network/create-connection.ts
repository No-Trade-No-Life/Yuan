import { Terminal } from '@yuants/protocol';
import { UUID } from '@yuants/utils';
import { BehaviorSubject, Observable, shareReplay, switchMap } from 'rxjs';

export const hostUrl$ = new BehaviorSubject<string | null>(null);

export const terminal$: Observable<Terminal | null> = hostUrl$.pipe(
  switchMap((host_url) => {
    return new Observable<Terminal | null>((subscriber) => {
      if (!host_url) {
        subscriber.next(null);
        return;
      }
      const terminal = new Terminal(host_url, {
        terminal_id: `@GUI/${UUID()}`,
        name: 'Workbench GUI' + (typeof window === 'undefined' ? `(worker)` : ''),
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
