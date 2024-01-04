import { encodePath, formatTime, UUID } from '@yuants/data-model';
import {
  BehaviorSubject,
  defer,
  delayWhen,
  distinct,
  filter,
  first,
  map,
  mergeMap,
  ReplaySubject,
  toArray,
} from 'rxjs';
import { createPersistBehaviorSubject } from '../FileSystem/createPersistBehaviorSubject';

export interface IHostConfigItem {
  //
  name: string;
  host_url: string;
}

export const hostConfigList$ = createPersistBehaviorSubject<IHostConfigItem[]>('host-config-list', []);

export const currentHostConfig$ = createPersistBehaviorSubject<IHostConfigItem | null>(
  'current-host-config',
  null,
);

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

export const OHLCIdList$ = new BehaviorSubject<string[]>([]);

const PUBLIC_DATA_URL = 'https://y.ntnl.io/Yuan-Public-Data';

const mapDurationLiteralToPeriodInSec: Record<string, number> = {
  PT1M: 60,
  PT5M: 300,
  PT15M: 900,
  PT30M: 1800,
  PT1H: 3600,
  PT4H: 14400,
  P1D: 86400,
};

// for No-Host Mode
currentHostConfig$
  .pipe(
    //
    filter((x) => x === null),
    mergeMap(() => {
      // No-Host Mode
      return defer(() => fetch(`${PUBLIC_DATA_URL}/index`)).pipe(
        //

        mergeMap((x) => x.text()),
        mergeMap((x: string) => x.split('\n')),
        map((x) => {
          const [, product_id, duration_literal] = x.split('/');
          return encodePath('Y', product_id, mapDurationLiteralToPeriodInSec[duration_literal]);
        }),
        distinct(),
        toArray(),
      );
    }),
  )
  .subscribe((v) => {
    OHLCIdList$.next(v);
  });
