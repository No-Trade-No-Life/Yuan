import { BehaviorSubject } from 'rxjs';
import { InMemoryBackend } from './backends/InMemoryBackend';
import { IFileSystemBackend } from './interfaces';

export const FsBackend$ = new BehaviorSubject<IFileSystemBackend>(new InMemoryBackend('default'));

FsBackend$.subscribe(() => {
  console.info('FileSystem backend changed:', FsBackend$.value.name);
  fetch('/ui-web.generated.d.ts')
    .then((res) => res.text())
    .then(async (content) => {
      // ISSUE: 写入到 node_modules/@yuants/ui-web/index.d.ts
      await fs.ensureDir('/node_modules/@yuants/ui-web');
      await fs.writeFile('/node_modules/@yuants/ui-web/index.d.ts', content);
    });
});

export const fs: IFileSystemBackend = {
  name: 'ProxyFS',
  stat: (...args) => FsBackend$.value.stat(...args),
  readdir: (...args) => FsBackend$.value.readdir(...args),
  writeFile: (...args) => FsBackend$.value.writeFile(...args),
  readFile: (...args) => FsBackend$.value.readFile(...args),
  readFileAsBase64: (...args) => FsBackend$.value.readFileAsBase64(...args),
  readFileAsBlob: (...args) => FsBackend$.value.readFileAsBlob(...args),
  mkdir: (...args) => FsBackend$.value.mkdir(...args),
  rm: (...args) => FsBackend$.value.rm(...args),
  exists: (...args) => FsBackend$.value.exists(...args),
  ensureDir: (...args) => FsBackend$.value.ensureDir(...args),
  createReadableStream: function (path: string): Promise<ReadableStream> {
    return FsBackend$.value.createReadableStream(path);
  },
  createWritableStream: function (path: string): Promise<WritableStream> {
    return FsBackend$.value.createWritableStream(path);
  },
};

Object.assign(globalThis, { fs, FsBackend$ });
