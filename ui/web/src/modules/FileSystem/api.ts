import { get, set } from 'idb-keyval';
import { dirname } from 'path-browserify';
import { BehaviorSubject, ReplaySubject, first, firstValueFrom, mergeMap } from 'rxjs';
import { FileSystemHandleBackend } from './backends/FileSystemHandleBackend';
import { InMemoryBackend } from './backends/InMemoryBackend';
import { IFileSystemBackend } from './interfaces';

export const FsBackend$ = new ReplaySubject<IFileSystemBackend>(1);

FsBackend$.subscribe(() => {
  fetch('/ui-web.generated.d.ts')
    .then((res) => res.text())
    .then((content) => fs.writeFile('/ui-web.generated.d.ts', content));
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

workspaceRoot$.subscribe((root) => {
  if (root) {
    console.info('Using FileSystemHandleBackend', root.name);
    FsBackend$.next(new FileSystemHandleBackend(root));
  } else if (root === null) {
    console.info('Using InMemoryBackend');
    FsBackend$.next(new InMemoryBackend());
  }
});

export const fs: IFileSystemBackend & {
  ensureDir: (path: string) => Promise<void>;
} = {
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
