export interface IWorkspace {
  id: string;
  name: string;
  type: string;
  directoryHandle?: FileSystemDirectoryHandle;
}
