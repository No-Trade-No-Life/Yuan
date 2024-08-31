export interface IFileSystemStatResult {
  isFile: () => boolean;
  isDirectory: () => boolean;
}
export interface IFileSystemBackend {
  readdir(path: string): Promise<string[]>;
  stat(path: string): Promise<IFileSystemStatResult>;
  readFile(path: string): Promise<string>;
  readFileAsBase64(path: string): Promise<string>;
  readFileAsBlob(path: string): Promise<Blob>;
  writeFile(path: string, content: FileSystemWriteChunkType): Promise<void>;
  mkdir(path: string): Promise<void>;
  rm(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}
