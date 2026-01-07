import { IFileSystemStatResult } from '../interfaces';
import { bs64toBlob } from '../utils';
import { BasicBackend } from './BasicBackend';

// @ts-ignore
const FileSystem = globalThis.Filer?.FileSystem;

export class IndexedDBBackend extends BasicBackend {
  name: string = 'IndexedDB';
  // @ts-ignore
  fs = FileSystem ? new FileSystem().promises : null;

  async readdir(path: string): Promise<string[]> {
    return this.fs.readdir(path);
  }
  async stat(path: string): Promise<IFileSystemStatResult> {
    const x = await this.fs.stat(path);
    const isDirectory = x.type === 'DIRECTORY';
    return {
      isFile: () => !isDirectory,
      isDirectory: () => isDirectory,
    };
  }
  async readFile(path: string): Promise<string> {
    return this.fs.readFile(path, 'utf8');
  }

  async readFileAsBlob(path: string): Promise<Blob> {
    return bs64toBlob(await this.readFileAsBase64(path));
  }

  async readFileAsBase64(path: string): Promise<string> {
    return bufferToBase64(await this.fs.readFile(path));
  }
  async writeFile(path: string, content: FileSystemWriteChunkType): Promise<void> {
    if (content instanceof Blob) {
      // @ts-ignore
      await this.fs.writeFile(path, Filer.Buffer.from(await content.arrayBuffer()));
    }

    await this.fs.writeFile(path, content);
  }
  async mkdir(path: string): Promise<void> {
    await this.fs.mkdir(path);
  }
  async rm(path: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
  async exists(path: string): Promise<boolean> {
    try {
      await this.fs.stat(path);
      return true;
    } catch (e) {
      return false;
    }
  }
}

async function bufferToBase64(buffer: Uint8Array) {
  // use a FileReader to generate a base64 data URI:
  const base64url = await new Promise<string>((r) => {
    const reader = new FileReader();
    reader.onload = () => r(reader.result as string);
    const arrayBuffer =
      buffer.buffer instanceof ArrayBuffer ? buffer.buffer : (buffer.slice().buffer as ArrayBuffer);
    reader.readAsDataURL(new Blob([arrayBuffer]));
  });
  // remove the `data:...;base64,` part from the start
  return base64url.slice(base64url.indexOf(',') + 1);
}
