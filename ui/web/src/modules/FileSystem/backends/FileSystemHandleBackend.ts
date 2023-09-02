// import { Modal } from '@douyinfe/semi-ui';
import { basename, dirname } from 'path-browserify';
import { Subject, filter, firstValueFrom, mergeMap, shareReplay } from 'rxjs';
import { IFileSystemBackend, IFileSystemStatResult } from '../interfaces';

export class FileSystemHandleBackend implements IFileSystemBackend {
  private request$ = new Subject<void>();
  private response$ = this.request$.pipe(
    mergeMap(async () => {
      try {
        if ((await this.root.queryPermission({ mode: 'readwrite' })) === 'granted') {
          return true;
        }
        // await new Promise<void>((resolve, reject) => {
        //   Modal.confirm({
        //     title: '文件系统授权',
        //     content: '请授权文件系统访问权限',
        //     onOk: () => {
        //       resolve();
        //     },
        //     onCancel: () => {
        //       reject();
        //     }
        //   });
        // });
        await this.root.requestPermission({ mode: 'readwrite' });
        return true;
      } catch (e) {}
    }, 1),
    filter((v) => !!v),
    shareReplay(1),
  );
  constructor(private root: FileSystemDirectoryHandle) {}

  private async resolveHandle(path: string): Promise<FileSystemHandle | null> {
    this.request$.next();
    await firstValueFrom(this.response$);
    const paths = path.split('/').filter(Boolean);
    let ptr = this.root;
    for (const name of paths) {
      if (!ptr) {
        return null;
      }
      let isFound = false;
      for await (const [_name, _handle] of ptr.entries()) {
        if (name === _name) {
          isFound = true;
          if (_handle instanceof FileSystemDirectoryHandle) {
            ptr = _handle;
          } else {
            return _handle;
          }
        }
      }
      if (!isFound) {
        return null;
      }
    }
    return ptr;
  }

  async readdir(path: string): Promise<string[]> {
    const handle = await this.resolveHandle(path);
    if (!(handle instanceof FileSystemDirectoryHandle)) {
      throw `ENOTDIR: not a directory, scandir '${path}'`;
    }
    const ret: string[] = [];
    for await (const [childName, childHandle] of handle.entries()) {
      ret.push(childName);
    }
    return ret;
  }
  async stat(path: string): Promise<IFileSystemStatResult> {
    const handle = await this.resolveHandle(path);
    if (!handle) {
      throw `ENOENT: no such file or directory, stat '${path}'`;
    }
    return {
      //
      isFile: () => handle.kind === 'file',
      isDirectory: () => handle.kind === 'directory',
    };
  }
  async readFile(path: string): Promise<string> {
    const file = await this.getFile(path);
    return file.text();
  }

  private async getFile(path: string) {
    const handle = await this.resolveHandle(path);
    if (handle === null) {
      throw `ENOENT: no such file or directory, stat '${path}'`;
    }
    if (!(handle instanceof FileSystemFileHandle)) {
      throw `EISDIR: illegal operator on a directory, open '${path}'`;
    }
    const file = await handle.getFile();
    return file;
  }

  async readFileAsBase64(path: string): Promise<string> {
    const file = await this.getFile(path);
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        if (typeof reader.result === 'string') {
          // reader.result === 'data:<MIME TYPES>:base64,'
          const base64 = reader.result.replace(/^.+base64,/, '');
          // console.info('base64', _path, base64);
          resolve(base64);
        }
      });
      reader.readAsDataURL(file);
    });
  }
  async writeFile(path: string, content: FileSystemWriteChunkType): Promise<void> {
    const dirFilename = dirname(path);
    const dirHandle = await this.resolveHandle(dirFilename);
    if (dirHandle === null) {
      throw `ENOENT: no such file or directory, open "${path}"`;
    }
    if (!(dirHandle instanceof FileSystemDirectoryHandle)) {
      throw `ENOTDIR: not a directory, open "${path}"`;
    }
    let handle = await this.resolveHandle(path);
    if (handle === null) {
      handle = await dirHandle.getFileHandle(basename(path), { create: true });
    }
    if (!(handle instanceof FileSystemFileHandle)) {
      throw `EISDIR: illegal operation on a directory, open "${path}"`;
    }
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
  }
  async mkdir(path: string): Promise<void> {
    const dirFilename = dirname(path);
    const dirHandle = await this.resolveHandle(dirFilename);
    if (dirHandle === null) {
      throw `ENOENT: no such file or directory, open "${path}"`;
    }
    if (!(dirHandle instanceof FileSystemDirectoryHandle)) {
      throw `ENOTDIR: not a directory, open "${path}"`;
    }
    let handle = await this.resolveHandle(path);
    if (handle !== null) {
      throw `EEXIST: file already exists, mkdir "${path}"`;
    }
    await dirHandle.getDirectoryHandle(basename(path), { create: true });
  }
  async rm(path: string): Promise<void> {
    const dirFilename = dirname(path);
    const dirHandle = await this.resolveHandle(dirFilename);
    if (dirHandle === null) {
      throw `ENOENT: no such file or directory, open "${path}"`;
    }
    if (!(dirHandle instanceof FileSystemDirectoryHandle)) {
      throw `ENOTDIR: not a directory, open "${path}"`;
    }
    await dirHandle.removeEntry(basename(path), { recursive: true });
  }
  async exists(path: string): Promise<boolean> {
    const handle = await this.resolveHandle(path);
    return handle !== null;
  }
}
