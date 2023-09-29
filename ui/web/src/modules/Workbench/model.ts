import { encodePath } from '@yuants/agent';
import { formatTime, UUID } from '@yuants/data-model';
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
import { createPersistBehaviorSubject } from '../../common/utils';

export interface IHostConfigItem {
  //
  name: string;
  HV_URL: string;
  TERMINAL_ID: string;
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
    // ISSUE: 等 currentHostConfig$ 先加载完毕
    delayWhen(() => currentHostConfig$.pipe(first((v) => v !== undefined))),
    delayWhen(() => hostConfigList$.pipe(first((v) => v !== undefined))),
  )
  .subscribe((action) => {
    console.info(formatTime(Date.now()), `从URL中解析到主机地址: ${action.payload.URL}`);
    const theConfig = hostConfigList$.value?.find((item) => item.HV_URL === action.payload.URL);
    if (theConfig) {
      console.info(
        formatTime(Date.now()),
        `本地配置中已经存在相同的主机 ${theConfig.name} ${theConfig.HV_URL}`,
      );
      currentHostConfig$.next(theConfig);
    } else {
      const config: IHostConfigItem = {
        HV_URL: action.payload.URL,
        name: action.payload.name,
        TERMINAL_ID: `GUI/${UUID()}`,
      };

      hostConfigList$.next([...(hostConfigList$.value || []), config]);
      currentHostConfig$.next(config);
    }
  });

export const OHLCIdList$ = new BehaviorSubject<string[]>([]);

export const PublicDataURL$ = createPersistBehaviorSubject(
  'PublicDataURL',
  'https://y.ntnl.io/Yuan-Public-Data',
);

const mapDurationLiteralToPeriodInSec: Record<string, number> = {
  PT1M: 60,
  PT5M: 300,
  PT15M: 900,
  PT30M: 1800,
  PT1H: 3600,
  PT4H: 14400,
  P1D: 86400,
};

// for 无主机模式
currentHostConfig$
  .pipe(
    //
    filter((x) => x === null),
    mergeMap(() => {
      // 无主机模式
      return defer(() => fetch(`${PublicDataURL$.value || 'https://y.ntnl.io/Yuan-Public-Data'}/index`)).pipe(
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
