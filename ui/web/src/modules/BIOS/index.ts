// Basic Input Output System (BIOS)
// First thing to run when the computer is turned on

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
  fromEvent,
  lastValueFrom,
  merge,
  mergeMap,
  of,
  tap,
  toArray,
} from 'rxjs';
import versionCompare from 'version-compare';
import versionSatisfy from 'version-range';
import { loadExtension, loadTgzBlob } from '../Extensions/utils';
import { FsBackend$, bundleCode, fs } from '../FileSystem';
import { FileSystemHandleBackend } from '../FileSystem/backends/FileSystemHandleBackend';
import { InMemoryBackend } from '../FileSystem/backends/InMemoryBackend';
import { currentWorkspace$ } from '../FileSystem/workspaces';
import { supabase } from '../SupaBase';
import { fullLog$, log } from './log';

defer(async () => {
  fullLog$.next('');
  log('BIOS START');
  log('USER-AGENT', navigator.userAgent);
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
          await loadInmemoryWorkspaceFromNpm(scope, package_name, version);
          return;
        }
        const from_github = url.searchParams.get('from_github');
        if (from_github) {
          const owner = url.searchParams.get('owner');
          const repo = url.searchParams.get('repo');
          const ref = url.searchParams.get('ref');
          const sub_path = url.searchParams.get('sub_path');
          // ISSUE: auth_token in URL is not safe
          const auth_token = prompt('GitHub Auth Token if needed');
          if (!owner) throw new Error('NO OWNER');
          if (!repo) throw new Error('NO REPO');
          if (!ref) throw new Error('NO REF');
          await loadInmemoryWorkspaceFromGitHub({ owner, repo, ref, sub_path, auth_token });
          return;
        }
        log('WORKSPACE CHECKING FILE SYSTEM HANDLE');
        const workspace = await firstValueFrom(currentWorkspace$.pipe(filter((v) => v !== undefined)));
        const root = workspace?.directoryHandle;
        if (root) {
          log('WORKSPACE ROOT EXISTS', root.name);
          const granted = await root.queryPermission({ mode: 'readwrite' });
          log('WORKSPACE PERMISSION', granted);
          if (granted !== 'granted') {
            log('WORKSPACE NEED PERMISSION: PRESS ANY KEY OR CLICK TO CONTINUE');
            await firstValueFrom(merge(fromEvent(document, 'keydown'), fromEvent(document, 'mousedown')));
            await root.requestPermission({ mode: 'readwrite' });
          }
          FsBackend$.next(new FileSystemHandleBackend(root));
          return;
        }
        log('FALLBACK TO THE LATEST @yuants/dist-origin WORKSPACE');
        try {
          await loadInmemoryWorkspaceFromNpm('yuants', 'dist-origin', null);
          return;
        } catch (e) {
          log('WORKSPACE @yuants/dist-origin INITIALIZATION ERROR', e);
        }
        log('ENSURE LANDING BY USING EMPTY IN-MEMORY WORKSPACE');
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
        } = JSON.parse(await fs.readFile('/package.json'));
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
  .subscribe({
    complete: () => ready$.next(true),
    error: (err) => {
      error$.next(err);
    },
  });

/**
 * A subject that emits a single value when the workspace is ready.
 * @public
 */
export const ready$ = new ReplaySubject(1);
export const error$ = new ReplaySubject(1);
export * from './createPersistBehaviorSubject';

async function loadInmemoryWorkspaceFromNpm(
  scope: string | null,
  package_name: string | null,
  version: string | null,
) {
  log(`SETUP WORKSPACE FROM NPM, SCOPE=${scope}, PACKAGE=${package_name}, VERSION=${version}`);
  const full_package_name = scope ? `@${scope}/${package_name}` : package_name;

  log('CHECKING PACKAGE', full_package_name);
  const checkRes = await supabase.functions.invoke('npm-dist-checker', {
    body: {
      // @ts-ignore
      package_name: full_package_name,
    },
  });
  if (checkRes.error) {
    throw new Error(checkRes.error);
  }
  if (checkRes.data.code !== 0) {
    throw new Error(checkRes.data.message);
  }
  log('CHECK RESULT', JSON.stringify(checkRes));
  log('USING IN-MEMORY WORKSPACE');
  if (!package_name) {
    throw new Error('NO PACKAGE NAME');
  }

  for (const registry of ['https://registry.npmjs.org', 'https://registry.npmmirror.com']) {
    log('TRYING NPM REGISTRY', registry);
    try {
      log('FETCHING PACKAGE META');
      const packageMeta: {
        versions: {
          [version: string]: any;
        };
      } = await fetch(`${registry}/${scope ? `@${scope}/` : ''}${package_name}`).then((res) => res.json());

      const allVersions = Object.keys(packageMeta.versions).sort(versionCompare).reverse();
      log('ALL VERSIONS', JSON.stringify(allVersions));

      const availableVersions = allVersions.filter((x) =>
        version !== null ? versionSatisfy(x, version) : true,
      );
      log('MATCHED VERSIONS', JSON.stringify(availableVersions));

      const selectedVersion = availableVersions[0];

      if (!selectedVersion) {
        throw new Error('NO MATCHED VERSION');
      }

      log('SELECTED VERSION', selectedVersion);
      FsBackend$.next(new InMemoryBackend(`${full_package_name}: ${selectedVersion}`));
      log('FETCHING PACKAGE TARBALL');
      const res = await fetch(
        `${registry}/${scope ? `@${scope}/` : ''}${package_name}/-/${package_name}-${selectedVersion}.tgz`,
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
    } catch (err) {
      log('ERROR', err);
      continue;
    }
  }
  throw new Error('LOAD PACKAGE FAILED');
}

// ISSUE: use cors-proxy to avoid CORS issue
const mapUrlToCorsProxy = (url: string): string => {
  const urlObj = new URL('https://makcbuwrvhmfggzvhtux.supabase.co/functions/v1/cors-proxy');
  urlObj.searchParams.set('url', url);
  return urlObj.toString();
};

async function loadInmemoryWorkspaceFromGitHub(ctx: {
  owner: string;
  repo: string;
  ref: string;
  sub_path: string | null;
  auth_token: string | null;
}) {
  FsBackend$.next(new InMemoryBackend(`${ctx.owner}/${ctx.repo}@${ctx.ref}`));

  const res = await fetch(
    mapUrlToCorsProxy(`https://api.github.com/repos/${ctx.owner}/${ctx.repo}/tarball/${ctx.ref}`),
    ctx.auth_token
      ? {
          headers: {
            // Accept: 'application/vnd.github+json',
            // 'X-GitHub-Api-Version': '2022-11-28',
            Authorization: `Bearer ${ctx.auth_token}`,
          },
        }
      : undefined,
  );

  const blob = await res.blob();
  log('BLOB SIZE', blob.size, 'BYTES');
  const files = await loadTgzBlob(blob);
  log(`EXTRACTING ${files.length} FILES...`);
  for (const file of files) {
    if (!file.isFile) continue;
    let filename = resolve('/', file.filename.replace(/^[^/]+\//, ''));
    if (ctx.sub_path && !filename.startsWith(ctx.sub_path)) continue;
    if (ctx.sub_path) {
      filename = filename.slice(ctx.sub_path.length);
    }

    log('EXTRACTING FILE', filename);
    await fs.ensureDir(dirname(filename));
    await fs.writeFile(filename, file.blob);
  }
}
