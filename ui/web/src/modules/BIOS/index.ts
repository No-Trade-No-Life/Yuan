// Basic Input Output System (BIOS)
// First thing to run when the computer is turned on
// Depends on modules:
// 1. FileSystem
// 1. Workspace is set up

import { dirname, join, resolve } from 'path-browserify';
import {
  EMPTY,
  ReplaySubject,
  catchError,
  defer,
  delayWhen,
  filter,
  firstValueFrom,
  from,
  lastValueFrom,
  mergeMap,
  of,
  tap,
  toArray,
} from 'rxjs';
import { loadExtension } from '../Extensions/utils';
import { FsBackend$, bundleCode, fs, workspaceRoot$ } from '../FileSystem';
import { FileSystemHandleBackend } from '../FileSystem/backends/FileSystemHandleBackend';
import { InMemoryBackend } from '../FileSystem/backends/InMemoryBackend';
import { fullLog$, log } from './log';

defer(async () => {
  fullLog$.next('');
  log('BIOS START');
  return Date.now();
})
  .pipe(
    delayWhen(() =>
      defer(async () => {
        const url = new URL(window.location.href);
        const from_npm = url.searchParams.get('from_npm');
        if (from_npm) {
          const scope = url.searchParams.get('scope');
          const package_name = url.searchParams.get('name');
          const version = url.searchParams.get('version');
          log(`SETUP WORKSPACE FROM NPM, SCOPE=${scope}, PACKAGE=${package_name}, VERSION=${version}`);
          log('USING IN-MEMORY WORKSPACE');
          FsBackend$.next(new InMemoryBackend(`${scope ? `@${scope}/` : ''}${package_name}-${version}`));
          if (!package_name || !version) {
            return;
          }
          const res = await fetch(
            `https://registry.npmjs.org/${
              scope ? `@${scope}/` : ''
            }${package_name}/-/${package_name}-${version}.tgz`,
          );
          log('FETCHED', res.status);
          const blob = await res.blob();
          log('BLOB SIZE', blob.size, 'BYTES');
          const files = await Modules.Extensions.loadTgzBlob(blob);
          log(`EXTRACTING ${files.length} FILES...`);
          for (const file of files) {
            log('EXTRACTING FILE', file.filename);
            // ISSUE: filename inside tarball has a prefix 'package/'
            const filename = resolve('/', file.filename.replace(/^package\//, ''));
            await fs.ensureDir(dirname(filename));
            await fs.writeFile(filename, file.blob);
          }
          log('FILES EXTRACTED');
          return;
        }
        log('WORKSPACE CHECKING FILE SYSTEM HANDLE');
        const root = await firstValueFrom(workspaceRoot$.pipe(filter((v) => v !== undefined)));
        if (root) {
          log('WORKSPACE ROOT EXISTS', root.name);
          FsBackend$.next(new FileSystemHandleBackend(root));
          return 0;
        }
        log('NO WORKSPACE ROOT, USING IN-MEMORY WORKSPACE');
        FsBackend$.next(new InMemoryBackend());
      }).pipe(
        toArray(),
        tap({
          subscribe: () => log('WORKSPACE INITIALIZING'),
          error: (err) => log('WORKSPACE ERROR', err),
          finalize: () => log('WORKSPACE READY'),
        }),
      ),
    ),
    // load extensions from package.json
    delayWhen(() =>
      defer(async () => {
        const json: {
          yuan?: {
            extensions?: Array<{ name: string; main: string }>;
          };
        } = JSON.parse(await fs.readFile('package.json'));
        if (!json.yuan?.extensions) return;
        await lastValueFrom(
          from(json.yuan.extensions).pipe(
            mergeMap((x) =>
              defer(async () => {
                const requireContext = {
                  ...Libs,
                  '@yuants/ui-web': Modules,
                };

                const code = await bundleCode(x.main, Object.keys(requireContext));

                Object.assign(globalThis, { requireContext });

                const module = new Function('globals', `return ${code}`)(requireContext);
                return module;
              }).pipe(
                tap({
                  next: (module) => {
                    log(`EXTENSION "${x.name}" LOADED`);
                  },
                  error: (e) => {
                    log(`EXTENSION "${x.name}" ERROR`, e);
                  },
                }),
              ),
            ),
          ),
        );
      }).pipe(
        tap({
          subscribe: () => log('EXTENSION LOCAL INITIALIZING'),
          finalize: () => log('EXTENSION LOCAL READY'),
          error: (err) => log('EXTENSION LOCAL ERROR', err),
        }),
        catchError(() => EMPTY),
        toArray(),
      ),
    ),

    // load extensions from /.Y/extensions
    delayWhen(() =>
      defer(() => fs.readdir('/.Y/extensions'))
        .pipe(
          mergeMap((files) =>
            from(files).pipe(
              mergeMap((file) =>
                of(file).pipe(
                  mergeMap(async (file) => {
                    log('LOADING EXTENSION', file);
                    const dirname = join('/.Y/extensions', file);
                    const stat = await fs.stat(dirname);
                    if (stat.isDirectory()) {
                      const packageJson = JSON.parse(await fs.readFile(join(dirname, 'package.json')));
                      await loadExtension(packageJson.name);
                    }
                    log('LOADING EXTENSION COMPLETE', file);
                  }),
                  tap({
                    error: (err) => log('LOADING EXTENSION ERROR', file, err),
                  }),
                  catchError(() => EMPTY),
                ),
              ),
              toArray(),
            ),
          ),
        )
        .pipe(
          tap({
            subscribe: () => log('EXTENSIONS INITIALIZING'),
            finalize: () => log('EXTENSIONS READY'),
            error: (err) => log('EXTENSIONS ERROR', err),
          }),
          catchError(() => EMPTY),
          toArray(),
        ),
    ),
    tap({
      next: (t) => log('BIOS COMPLETE IN', Date.now() - t, 'MS'),
      error: (err) => log('BIOS ERROR', err),
    }),
  )
  .subscribe(() => {
    //
    ready$.next(true);
  });

/**
 * A subject that emits a single value when the workspace is ready.
 * @public
 */
export const ready$ = new ReplaySubject(1);
export * from './BIOS';
export * from './createPersistBehaviorSubject';
