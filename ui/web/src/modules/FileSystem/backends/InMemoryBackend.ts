import { dirname, relative } from 'path-browserify';
import { IFileSystemBackend, IFileSystemStatResult } from '../interfaces';

export class InMemoryBackend implements IFileSystemBackend {
  files: Record<string, { type: 'file'; contentBase64: string } | { type: 'dir' }> = { '/': { type: 'dir' } };

  async readdir(path: string): Promise<string[]> {
    const file = this.files[path];
    if (!file) {
      throw `ENOTDIR: not a directory, scandir '${path}'`;
    }
    if (file.type === 'file') {
      throw Error(`ENOTDIR: not a directory, scandir ${path}`);
    }

    return Object.keys(this.files)
      .filter((key) => key !== path && dirname(key) === path)
      .map((key) => relative(path, key));
  }
  async stat(path: string): Promise<IFileSystemStatResult> {
    const file = this.files[path];
    if (!file) {
      throw Error(`ENOENT: no such file or directory, stat ${path}`);
    }

    return {
      isFile: () => file.type === 'file',
      isDirectory: () => file.type === 'dir',
    };
  }
  async readFile(path: string): Promise<string> {
    return b64_to_utf8(await this.readFileAsBase64(path));
  }

  async readFileAsBase64(path: string): Promise<string> {
    const file = this.files[path];
    if (!file) {
      throw Error(`ENOENT: no such file or directory: ${path}`);
    }
    if (file.type === 'dir') {
      throw Error(`Cannot readFile from dir ${path}`);
    }
    return file.contentBase64;
  }
  async writeFile(path: string, content: FileSystemWriteChunkType): Promise<void> {
    if (content instanceof Blob) {
      this.files[path] = { type: 'file', contentBase64: await blobToBase64(content) };
      return;
    }

    if (typeof content === 'string') {
      this.files[path] = { type: 'file', contentBase64: utf8_to_b64(content) };
      return;
    }

    throw Error('Not Impleemented');
  }
  async mkdir(path: string): Promise<void> {
    const file = this.files[path];
    if (file) return;
    this.files[path] = { type: 'dir' };
  }
  async rm(path: string): Promise<void> {
    for (const key of Object.keys(this.files)) {
      if (relative(path, key).startsWith('..')) continue;
      delete this.files[key];
    }
  }
  async exists(path: string): Promise<boolean> {
    return !!this.files[path];
  }
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, _) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).replace(/^.+;base64,/, ''));
    reader.readAsDataURL(blob);
  });
}
function utf8_to_b64(str: string): string {
  return btoa(unescape(encodeURIComponent(str)));
}

function b64_to_utf8(str: string): string {
  return decodeURIComponent(escape(atob(str)));
}
