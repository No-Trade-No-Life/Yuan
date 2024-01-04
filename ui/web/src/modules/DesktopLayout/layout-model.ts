import * as FlexLayout from 'flexlayout-react';
import hotkeys from 'hotkeys-js';
import { BehaviorSubject, bufferCount, combineLatest, first, map, Subject } from 'rxjs';
import { registerCommand } from '../CommandCenter';
import { createPersistBehaviorSubject } from '../FileSystem/createPersistBehaviorSubject';

const initialJson = (): FlexLayout.IJsonModel => ({
  global: {
    // FIXED: multiple-window will cause terminals conflict, so disable it
    tabEnableFloat: true,
  },
  borders: [
    {
      type: 'border',
      location: 'left',
      size: 320,
      children: [
        {
          type: 'tab',
          id: 'Explorer',
          component: 'Explorer',
          enableDrag: false,
          enableRename: false,
          enableClose: false,
        },
        {
          type: 'tab',
          id: 'AgentConfForm',
          component: 'AgentConfForm',
          enableDrag: false,
          enableRename: false,
          enableClose: false,
        },
        {
          type: 'tab',
          id: 'ExtensionPanel',
          component: 'ExtensionPanel',
          enableRename: false,
          enableDrag: false,
          enableClose: false,
        },
      ],
    },
    {
      type: 'border',
      location: 'bottom',
      children: [
        {
          type: 'tab',
          id: 'Program',
          enableClose: false,
          enableRename: false,
          enableDrag: false,
          component: 'Program',
        },
      ],
    },
  ],
  layout: {
    type: 'row',
    weight: 100,
    children: [
      {
        type: 'tabset',
        children: [
          {
            type: 'tab',
            id: '{"pageKey":"Copilot","params":{}}',
            component: 'Copilot',
            config: {},
            enableRename: false,
          },
        ],
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
