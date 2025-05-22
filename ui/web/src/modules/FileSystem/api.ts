import { dirname } from 'path-browserify';
import { ReplaySubject, first, firstValueFrom, mergeMap } from 'rxjs';
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
