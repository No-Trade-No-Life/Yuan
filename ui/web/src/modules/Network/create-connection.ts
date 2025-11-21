import { Terminal } from '@yuants/protocol';
import { BehaviorSubject, Observable, shareReplay, switchMap } from 'rxjs';

const url = new URL(window?.location.href ?? 'https://y.ntnl.io');
const isDev = url.searchParams.get('mode') === 'development';

export const hostUrl$ = new BehaviorSubject<string | null>(null);

export const terminal$: Observable<Terminal | null> = hostUrl$.pipe(
  switchMap((host_url) => {
    return new Observable<Terminal | null>((subscriber) => {
      if (!host_url) {
        subscriber.next(null);
        return;
      }
      const terminal = new Terminal(
        host_url,
        {
          name: 'Workbench GUI' + (typeof window === 'undefined' ? `(worker)` : ''),
        },
        {
          verbose: isDev,
        },
      );
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
