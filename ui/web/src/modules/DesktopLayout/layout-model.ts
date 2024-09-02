import { Toast } from '@douyinfe/semi-ui';
import { formatTime } from '@yuants/data-model';
import * as FlexLayout from 'flexlayout-react';
import hotkeys from 'hotkeys-js';
import { resolve } from 'path-browserify';
import { BehaviorSubject, bufferCount, combineLatest, first, map, Subject } from 'rxjs';
import { createPersistBehaviorSubject } from '../BIOS';
import { registerCommand } from '../CommandCenter';
import { fs } from '../FileSystem/api';
import { showForm } from '../Form';

const initialJson = (): FlexLayout.IJsonModel => ({
  global: {
    // FIXED: multiple-window will cause terminals conflict, so disable it
    tabEnableFloat: true,
  },
  layout: {
    type: 'row',
    weight: 100,
    children: [
      {
        type: 'tabset',
        children: [],
        active: true,
      },
    ],
  },
});

export const layoutModelJson$ = createPersistBehaviorSubject('layout', initialJson());

const layoutUpdate$ = new Subject<void>();

combineLatest([layoutModelJson$, layoutUpdate$]).subscribe(([json]) => {
  layoutModel$.next(FlexLayout.Model.fromJson(json!));
});

layoutModelJson$
  .pipe(
    bufferCount(2),
    first(([a, b]) => a === undefined && b !== undefined),
    map(([, b]) => b),
  )
  .subscribe((json) => {
    layoutUpdate$.next();
  });

export const layoutModel$ = new BehaviorSubject(FlexLayout.Model.fromJson(initialJson()));
layoutModel$.subscribe((layoutModel) => {
  Object.assign(globalThis, { layoutModel, Actions: FlexLayout.Actions });
});

registerCommand('Page.open', ({ type: pageKey, params = {}, parentId: _parentId }) => {
  Modules.Workbench.isShowHome$.next(false);
  const pageId = JSON.stringify({ pageKey, params });
  const model = layoutModel$.value;

  const theNode = model.getNodeById(pageId);
  if (theNode) {
    if (!theNode.isVisible()) {
      model.doAction(FlexLayout.Actions.selectTab(theNode.getId()));
    }
    return;
  }

  const parentId =
    _parentId ||
    model.getActiveTabset()?.getId() ||
    model
      .getRoot()
      .getChildren()
      .find((node) => node.getType() === 'tabset')
      ?.getId();
  if (!parentId) {
    console.info(formatTime(Date.now()), 'Page.open: NO PARENT');
    // NO PARENT: BAD REQUEST
    return;
  }
  model.doAction(
    FlexLayout.Actions.addNode(
      {
        id: pageId,
        type: 'tab',
        component: pageKey,
        enableRename: false,
        config: params,
      },
      parentId,
      FlexLayout.DockLocation.CENTER,
      -1,
      true,
    ),
  );
});

registerCommand('Page.select', ({ id: pageId }) => {
  const model = layoutModel$.value;
  const node = model.getNodeById(pageId);
  if (node) {
    if (!node.isVisible()) {
      model.doAction(FlexLayout.Actions.selectTab(pageId));
    }
  }
});

const closeCurrentTab = () => {
  const model = layoutModel$.value;
  const tabset = model.getActiveTabset();
  const nodeId = tabset?.getSelectedNode()?.getId();
  if (nodeId) {
    model.doAction(FlexLayout.Actions.deleteTab(nodeId));
  }
};

hotkeys('alt+w', function (event, handler) {
  // Prevent the default refresh event under WINDOWS system
  event.preventDefault();
  closeCurrentTab();
});

registerCommand('ResetLayout', () => {
  layoutModelJson$.next(initialJson());
  layoutUpdate$.next();
});

registerCommand('ClosePage', () => {
  closeCurrentTab();
});

registerCommand('Page.close', ({ pageId }) => {
  layoutModel$.value.doAction(FlexLayout.Actions.deleteTab(pageId));
});

registerCommand('Page.changeTitle', ({ pageId, title }) => {
  layoutModel$.value.doAction(FlexLayout.Actions.renameTab(pageId, title));
});

registerCommand('Layout.Save', async () => {
  try {
    const filename = await showForm<string>({ type: 'string', format: 'filename' });
    await fs.writeFile(resolve('/', filename), JSON.stringify(layoutModelJson$.value, null, 2));
    Toast.success('Layout saved');
  } catch (e) {
    Toast.error(`Failed to save layout: ${e}`);
  }
});

registerCommand('Layout.Load', async () => {
  try {
    const filename = await showForm<string>({ type: 'string', format: 'filename' });
    const content = await fs.readFile(resolve('/', filename));
    layoutModelJson$.next(JSON.parse(content));
    Toast.success('Layout loaded');
  } catch (e) {
    Toast.error(`Failed to load layout: ${e}`);
  }
});
