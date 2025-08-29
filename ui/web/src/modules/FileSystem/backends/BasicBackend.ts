import { dirname } from 'path-browserify';
import { IFileSystemBackend, IFileSystemStatResult } from '../interfaces';

export class BasicBackend implements IFileSystemBackend {
  createWritableStream(path: string): Promise<WritableStream> {
    throw new Error('Method not implemented.');
  }
  createReadableStream(path: string): Promise<ReadableStream> {
    throw new Error('Method not implemented.');
  }

  name: string = 'BasicBackend';
  readdir(path: string): Promise<string[]> {
    throw new Error('Method not implemented.');
  }
  stat(path: string): Promise<IFileSystemStatResult> {
    throw new Error('Method not implemented.');
  }
  readFile(path: string): Promise<string> {
    throw new Error('Method not implemented.');
  }
  readFileAsBase64(path: string): Promise<string> {
    throw new Error('Method not implemented.');
  }
  readFileAsBlob(path: string): Promise<Blob> {
    throw new Error('Method not implemented.');
  }
  writeFile(path: string, content: FileSystemWriteChunkType): Promise<void> {
    throw new Error('Method not implemented.');
  }
  mkdir(path: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
  rm(path: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
  exists(path: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  async ensureDir(path: string): Promise<void> {
    if (path === '/') {
      return;
    }
    await this.ensureDir(dirname(path));
    if (await this.exists(path)) {
      return;
    }
    await this.mkdir(path);
  }
}
