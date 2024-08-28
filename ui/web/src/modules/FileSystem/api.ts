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
const b64toBlob = (b64Data: string, contentType = '', sliceSize = 512) => {
  const byteCharacters = atob(b64Data);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);

    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  const blob = new Blob(byteArrays, { type: contentType });
  return blob;
};
const readAsBlob = async (path: string): Promise<Blob> => {
  const backend = await firstValueFrom(FsBackend$);
  const base64 = await backend.readFileAsBase64(path);
  return b64toBlob(base64);
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
  readAsBlob: (path: string) => Promise<Blob>;
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
  readAsBlob,
};

Object.assign(globalThis, { fs, FsBackend$ });
