import { formatTime } from '@yuants/utils';
import { ReplaySubject, delayWhen, filter, first } from 'rxjs';
import { createFileSystemBehaviorSubject } from '../FileSystem';
import { hostUrl$ } from '../Terminals';

export interface IHostConfigItem {
  //
  name: string;
  host_url: string;
}

export const hostConfigList$ = createFileSystemBehaviorSubject<IHostConfigItem[]>('host-config-list', []);

export const currentHostConfig$ = createFileSystemBehaviorSubject<IHostConfigItem | null>(
  'current-host-config',
  null,
);

currentHostConfig$.subscribe((config) => {
  if (config !== undefined) {
    hostUrl$.next(config?.host_url || null);
  }
});

export const initAction$ = new ReplaySubject<{ type: string; payload: any }>(1);

const tryParseHref = () => {
  try {
    const url = new URL(window.location.href);
    const query = url.searchParams.get('q');
    if (query) {
      const action = JSON.parse(window.atob(query));
      if (typeof action === 'object' && typeof action.type === 'string') {
        initAction$.next(action);
      }
    }
  } catch (e) {}
};

tryParseHref();

initAction$.subscribe((action) => {
  console.info('q', JSON.stringify(action));
});

initAction$
  .pipe(
    //
    filter(
      (action): action is { type: string; payload: { name: string; URL: string } } =>
        action.type === 'ConfigHost',
    ),
    // ISSUE: wait currentHostConfig$ loaded
    delayWhen(() => currentHostConfig$.pipe(first((v) => v !== undefined))),
    delayWhen(() => hostConfigList$.pipe(first((v) => v !== undefined))),
  )
  .subscribe((action) => {
    console.info(formatTime(Date.now()), `Parsed host from URL: ${action.payload.URL}`);
    const theConfig = hostConfigList$.value?.find((item) => item.host_url === action.payload.URL);
    if (theConfig) {
      console.info(formatTime(Date.now()), `Host existed ${theConfig.name} ${theConfig.host_url}`);
      currentHostConfig$.next(theConfig);
    } else {
      const config: IHostConfigItem = {
        host_url: action.payload.URL,
        name: action.payload.name,
      };

      hostConfigList$.next([...(hostConfigList$.value || []), config]);
      currentHostConfig$.next(config);
    }
  });
