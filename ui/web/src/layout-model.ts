import * as FlexLayout from 'flexlayout-react';
import hotkeys from 'hotkeys-js';
import { BehaviorSubject, bufferCount, combineLatest, first, map, Subject } from 'rxjs';
import { createPersistBehaviorSubject } from './common/utils';
import { registerCommand } from './modules/CommandCenter/CommandCenter';

const initialJson = (): FlexLayout.IJsonModel => ({
  global: {
    // FIXED: 修复对多屏幕支持的问题后，再开启此功能
    // tabEnableFloat: true
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
          enableClose: false,
        },
        {
          type: 'tab',
          id: 'AgentConfForm',
          component: 'AgentConfForm',
          enableDrag: false,
          enableClose: false,
        },
        {
          type: 'tab',
          id: 'ExtensionPanel',
          component: 'ExtensionPanel',
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
          component: 'Program',
        },
      ],
    },
  ],
  layout: {
    type: 'row',
    weight: 100,
    children: [],
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

export function openPage(pageKey: string, params = {}) {
  const pageId = JSON.stringify({ pageKey, params });
  const model = layoutModel$.value;

  const theNode = model.getNodeById(pageId);
  if (theNode) {
    if (!theNode.isVisible()) {
      model.doAction(FlexLayout.Actions.selectTab(theNode.getId()));
    }
    return;
  }

  const activeTabset = model.getActiveTabset();
  if (!activeTabset) {
    alert('No Active Tabset');
    return;
  }
  model.doAction(
    FlexLayout.Actions.addNode(
      {
        id: pageId,
        type: 'tab',
        component: pageKey,
        config: params,
      },
      activeTabset.getId(),
      FlexLayout.DockLocation.CENTER,
      0,
      true,
    ),
  );
}

export function openExistPage(pageId: string) {
  const model = layoutModel$.value;
  const node = model.getNodeById(pageId);
  if (node) {
    if (!node.isVisible()) {
      model.doAction(FlexLayout.Actions.selectTab(pageId));
    }
  }
}

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
