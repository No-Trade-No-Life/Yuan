import { UUID } from '@yuants/utils';
import { get, set } from 'idb-keyval';
import { BehaviorSubject, map } from 'rxjs';
import { IWorkspace } from './model';

const WORKSPACE_KEY = 'workspaces';

/**
 * Workspaces is a list of workspaces that have been opened in the past.
 */
export const workspaces$ = new BehaviorSubject<Map<string, IWorkspace> | undefined>(undefined);

get(WORKSPACE_KEY).then((workspaces) => {
  workspaces$.next(workspaces || new Map());
});

export const currentWorkspaceId = new URL(document.location.href).searchParams.get('workspace') || '';

export const openWorkspace = (workspace_id: string, target = '_self') => {
  const url = new URL(document.location.href);
  const mode = url.searchParams.get('mode'); // keep mode param after reload
  url.search = '';
  url.searchParams.set('workspace', workspace_id);
  if (mode) {
    url.searchParams.set('mode', mode);
  }
  window.open(url.toString(), target);
};

export const saveWorkspace = async (workspace: IWorkspace) => {
  const nextMap = new Map(workspaces$.value).set(workspace.id, workspace);
  await set(WORKSPACE_KEY, nextMap);
  workspaces$.next(nextMap);
};

export const removeWorkspace = async (workspace_id: string) => {
  const nextMap = new Map(workspaces$.value);
  nextMap.delete(workspace_id);
  await set(WORKSPACE_KEY, nextMap);
  workspaces$.next(nextMap);
};

export const currentWorkspace$ = workspaces$.pipe(
  map((workspaces) => {
    if (!workspaces) return undefined; // not loaded yet
    if (workspaces.size === 0) return null; // no workspaces
    const current = workspaces.get(currentWorkspaceId);
    if (current) {
      return current;
    }
    return null;
  }),
);

/**
 * Create a local workspace
 * @returns A promise that resolves to the created workspace
 */
export const createLocalWorkspace = async (): Promise<IWorkspace> => {
  const root = await showDirectoryPicker({
    mode: 'readwrite',
  });
  await root.requestPermission({ mode: 'readwrite' });
  const id = UUID();
  const name = prompt('Workspace Name', id) || id;
  const type = 'local';
  const workspace = { id, name, type, directoryHandle: root };

  await saveWorkspace(workspace);
  return workspace;
};
