import { encodePath, formatTime } from '@yuants/data-model';
import { dirname, resolve } from 'path-browserify';
import {
  BehaviorSubject,
  ReplaySubject,
  defer,
  delayWhen,
  distinct,
  filter,
  first,
  firstValueFrom,
  map,
  mergeMap,
  toArray,
} from 'rxjs';
import { FsBackend$, createPersistBehaviorSubject, fs, workspaceRoot$ } from '../FileSystem';
import { InMemoryBackend } from '../FileSystem/backends/InMemoryBackend';

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

// initialize workspace from npm package
defer(async () => {
  const url = new URL(window.location.href);
  const from_npm = url.searchParams.get('from_npm');
  if (from_npm) {
    const scope = url.searchParams.get('scope');
    const package_name = url.searchParams.get('name');
    const version = url.searchParams.get('version');
    if (!package_name || !version) {
      return;
    }

    const res = await fetch(
      `https://registry.npmjs.org/${
        scope ? `@${scope}/` : ''
      }${package_name}/-/${package_name}-${version}.tgz`,
    );
    const blob = await res.blob();
    const files = await Modules.Extensions.loadTgzBlob(blob);
    workspaceRoot$.next(null); // Using InMemoryBackend
    await firstValueFrom(FsBackend$.pipe(filter((x) => x instanceof InMemoryBackend))); // ISSUE: wait for InMemoryBackend to be set
    for (const file of files) {
      // ISSUE: filename inside tarball has a prefix 'package/'
      const filename = resolve('/', file.filename.replace(/^package\//, ''));
      await fs.ensureDir(dirname(filename));
      await fs.writeFile(filename, file.blob);
    }
  }
}).subscribe();

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
