/// <reference types="vite/client" />
declare function showDirectoryPicker(options?: {
  mode?: 'read' | 'readwrite';
}): Promise<FileSystemDirectoryHandle>;
declare interface FileSystemDirectoryHandle {
  requestPermission(options?: { mode?: 'read' | 'readwrite' }): Promise<string>;
  queryPermission(options?: { mode: 'read' | 'readwrite' }): Promise<'granted'>;
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  getFileHandle(name: string, options?: { create: boolean }): Promise<FileSystemFileHandle>;
}

declare const __COMMIT_HASH__: string;
declare const __BUILT_AT__: number;

// https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/wicg-file-system-access/index.d.ts
type WriteParams =
  | { type: 'write'; position?: number | undefined; data: BufferSource | Blob | string }
  | { type: 'seek'; position: number }
  | { type: 'truncate'; size: number };

type FileSystemWriteChunkType = BufferSource | Blob | string | WriteParams;

class FileSystemWritableFileStream extends WritableStream {
  write(data: FileSystemWriteChunkType): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}

interface FileSystemCreateWritableOptions {
  keepExistingData?: boolean | undefined;
}
declare interface FileSystemFileHandle {
  getFile(): Promise<File>;
  createWritable(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream>;
}

declare function showOpenFilePicker(): Promise<FileSystemFileHandle[]>;

declare function showSaveFilePicker(): Promise<FileSystemFileHandle>;
declare module 'lightweight-charts/dist/lightweight-charts.esm.development.js' {
  export * from 'lightweight-charts';
}

declare function gtag(...args: any[]);
