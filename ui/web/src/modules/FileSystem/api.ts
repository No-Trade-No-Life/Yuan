import { dirname } from 'path-browserify';
import { BehaviorSubject } from 'rxjs';
import { FileSystemHandleBackend } from './backends/FileSystemHandleBackend';
import { IndexedDBBackend } from './backends/IndexedDBBackend';
import { createPersistBehaviorSubject } from './createPersistBehaviorSubject';
import { IFileSystemBackend } from './interfaces';

const createFileSystemApi = (backend: IFileSystemBackend) => {
  const ensureDir = async (path: string): Promise<void> => {
    if (path === '/') {
      return;
    }
    await ensureDir(dirname(path));
    if (await backend.exists(path)) {
      return;
    }
    await backend.mkdir(path);
  };
  return { ...backend, ensureDir };
};

export const FsBackend$ = new BehaviorSubject<IFileSystemBackend>(new IndexedDBBackend());
const FsFrontend$ = new BehaviorSubject(createFileSystemApi(FsBackend$.value));
FsBackend$.subscribe((backend) => {
  FsFrontend$.next(createFileSystemApi(backend));
});

const ensureDir = async (path: string): Promise<void> => {
  if (path === '/') {
    return;
  }
  await ensureDir(dirname(path));
  if (await FsBackend$.value.exists(path)) {
    return;
  }
  await FsBackend$.value.mkdir(path);
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
  const base64 = await FsBackend$.value.readFileAsBase64(path);
  return b64toBlob(base64);
};

export const workspaceRoot$ = createPersistBehaviorSubject(
  'workspace-root',
  null as FileSystemDirectoryHandle | null,
);

workspaceRoot$.subscribe((root) => {
  if (root) {
    FsBackend$.next(new FileSystemHandleBackend(root));
  }
});

export const fs: IFileSystemBackend & {
  ensureDir: (path: string) => Promise<void>;
  readAsBlob: (path: string) => Promise<Blob>;
} = {
  stat: (...args) => FsBackend$.value.stat(...args),
  readdir: (...args) => FsBackend$.value.readdir(...args),
  writeFile: (...args) => FsBackend$.value.writeFile(...args),
  readFile: (...args) => FsBackend$.value.readFile(...args),
  readFileAsBase64: (...args) => FsBackend$.value.readFileAsBase64(...args),
  mkdir: (...args) => FsBackend$.value.mkdir(...args),
  rm: (...args) => FsBackend$.value.rm(...args),
  exists: (...args) => FsBackend$.value.exists(...args),

  ensureDir,
  readAsBlob,
};

Object.assign(globalThis, { fs, FsBackend$ });
