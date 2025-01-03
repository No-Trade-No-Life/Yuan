import { basename, dirname } from 'path-browserify';
import { Subject, filter, firstValueFrom, mergeMap, shareReplay } from 'rxjs';
import { IFileSystemBackend, IFileSystemStatResult } from '../interfaces';

export class FileSystemHandleBackend implements IFileSystemBackend {
  name: string;
  private request$ = new Subject<void>();
  private response$ = this.request$.pipe(
    mergeMap(async () => {
      try {
        if ((await this.root.queryPermission({ mode: 'readwrite' })) === 'granted') {
          return true;
        }

        await this.root.requestPermission({ mode: 'readwrite' });
        return true;
      } catch (e) {}
    }, 1),
    filter((v) => !!v),
    shareReplay(1),
  );
  constructor(private root: FileSystemDirectoryHandle) {
    this.name = root.name;
  }

  private mapPathToHandle = new Map<string, FileSystemHandle>();

  private async resolveHandle(path: string): Promise<FileSystemHandle | null> {
    const cached = this.mapPathToHandle.get(path);
    if (cached) {
      return cached;
    }
    this.request$.next();
    await firstValueFrom(this.response$);
    if (path === '/') {
      return this.root;
    }
    const dir = dirname(path);
    if (dir === path) {
      return this.root;
    }
    const base = basename(path);
    const dirHandle = await this.resolveHandle(dir);
    if (!(dirHandle instanceof FileSystemDirectoryHandle)) {
      return null;
    }
    try {
      const res = await dirHandle.getDirectoryHandle(base);
      this.mapPathToHandle.set(path, res);
      return res;
    } catch (e) {
      try {
        const res = await dirHandle.getFileHandle(base);
        this.mapPathToHandle.set(path, res);
        return res;
      } catch (e) {
        return null;
      }
    }
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

  async readFileAsBlob(path: string): Promise<Blob> {
    const file = await this.getFile(path);
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
