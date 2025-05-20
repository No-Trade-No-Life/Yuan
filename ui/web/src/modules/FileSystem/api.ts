import { get, set } from 'idb-keyval';
import { dirname } from 'path-browserify';
import { BehaviorSubject, ReplaySubject, combineLatest, first, firstValueFrom, mergeMap, timer } from 'rxjs';
import { IFileSystemBackend } from './interfaces';

export const FsBackend$ = new ReplaySubject<IFileSystemBackend>(1);

FsBackend$.subscribe(() => {
  fetch('/ui-web.generated.d.ts')
    .then((res) => res.text())
    .then(async (content) => {
      // ISSUE: 写入到 node_modules/@yuants/ui-web/index.d.ts
      await fs.ensureDir('/node_modules/@yuants/ui-web');
      await fs.writeFile('/node_modules/@yuants/ui-web/index.d.ts', content);
    });
});

const ensureDir = async (path: string): Promise<void> => {
  if (path === '/') {
    return;
  }
  await ensureDir(dirname(path));
  const backend = await firstValueFrom(FsBackend$);
  if (await backend.exists(path)) {
    return;
  }
  await backend.mkdir(path);
};

const createPersistBehaviorSubject = <T>(key: string, initialValue: T) => {
  const subject$ = new BehaviorSubject<T | undefined>(undefined);
  get(key).then((value) => {
    if (value !== undefined) {
      subject$.next(value);
    } else {
      subject$.next(initialValue);
    }
    subject$.subscribe((newVal) => {
      set(key, newVal);
    });
  });
  return subject$;
};

export const workspaceRoot$ = createPersistBehaviorSubject(
  'workspace-root',
  null as FileSystemDirectoryHandle | null,
);
export const historyWorkspaceRoot$ = createPersistBehaviorSubject(
  'history-workspace-root',
  [] as FileSystemDirectoryHandle[],
);

combineLatest([workspaceRoot$, historyWorkspaceRoot$.pipe(first((x) => x !== undefined))]).subscribe(
  async ([root, history]) => {
    console.info('WorkspaceRoot', root, history);
    if (root && history) {
      for (const h of history) {
        const isSame = await h.isSameEntry(root);
        if (isSame) return;
      }
      historyWorkspaceRoot$.next([...history, root]);
    }
  },
);

export const replaceWorkspaceRoot = async (root?: FileSystemDirectoryHandle) => {
  if (!root) {
    root = await showDirectoryPicker({
      mode: 'readwrite',
    });
    await root.requestPermission({ mode: 'readwrite' });
  }

  workspaceRoot$.next(root);
  await firstValueFrom(timer(1000));
  // REBOOT AFTER SETTING WORKSPACE ROOT
  const url = new URL(document.location.href);
  const mode = url.searchParams.get('mode'); // keep mode param after reload
  url.search = '';
  if (mode) {
    url.searchParams.set('mode', mode);
  }
  document.location.replace(url.toString());
};

export const fs: IFileSystemBackend & {
  ensureDir: (path: string) => Promise<void>;
} = {
  name: 'ProxyFS',
  stat: (...args) =>
    firstValueFrom(
      FsBackend$.pipe(
        first(),
        mergeMap((fs) => fs.stat(...args)),
      ),
    ),
  readdir: (...args) =>
    firstValueFrom(
      FsBackend$.pipe(
        first(),
        mergeMap((fs) => fs.readdir(...args)),
      ),
    ),
  writeFile: (...args) =>
    firstValueFrom(
      FsBackend$.pipe(
        first(),
        mergeMap((fs) => fs.writeFile(...args)),
      ),
    ),
  readFile: (...args) =>
    firstValueFrom(
      FsBackend$.pipe(
        first(),
        mergeMap((fs) => fs.readFile(...args)),
      ),
    ),
  readFileAsBase64: (...args) =>
    firstValueFrom(
      FsBackend$.pipe(
        first(),
        mergeMap((fs) => fs.readFileAsBase64(...args)),
      ),
    ),
  readFileAsBlob: (...args) =>
    firstValueFrom(
      FsBackend$.pipe(
        first(),
        mergeMap((fs) => fs.readFileAsBlob(...args)),
      ),
    ),
  mkdir: (...args) =>
    firstValueFrom(
      FsBackend$.pipe(
        first(),
        mergeMap((fs) => fs.mkdir(...args)),
      ),
    ),
  rm: (...args) =>
    firstValueFrom(
      FsBackend$.pipe(
        first(),
        mergeMap((fs) => fs.rm(...args)),
      ),
    ),
  exists: (...args) =>
    firstValueFrom(
      FsBackend$.pipe(
        first(),
        mergeMap((fs) => fs.exists(...args)),
      ),
    ),

  ensureDir,
};

Object.assign(globalThis, { fs, FsBackend$ });
