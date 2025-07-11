import { Toast } from '@douyinfe/semi-ui';
import { decodeBase58, encodeBase58, formatTime } from '@yuants/utils';
import * as FlexLayout from 'flexlayout-react';
import hotkeys from 'hotkeys-js';
import { resolve } from 'path-browserify';
import { filter, first, firstValueFrom, map, shareReplay } from 'rxjs';
import { createPersistBehaviorSubject } from '../BIOS';
import { executeCommand, registerCommand } from '../CommandCenter';
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

/**
 * the Single Truth of Layout Model
 *
 * All Model operations should be done through this
 */
export const layoutModelJson$ = createPersistBehaviorSubject('layout', initialJson());

// layoutModelJson$.subscribe((v) => {
//   console.info(formatTime(Date.now()), '##layoutModelJson$', JSON.stringify(v));
// });

const loadPageFromURL = () => {
  const url = new URL(document.location.href);
  const page = url.searchParams.get('page');
  const page_params = url.searchParams.get('page_params');
  if (!page) return;
  const params = () => {
    try {
      return JSON.parse(new TextDecoder().decode(decodeBase58(page_params!)));
    } catch {
      return {};
    }
  };
  return { type: page, params: params() };
};

// Sync layout model to ActivePage$
export const activePage$ = layoutModelJson$.pipe(
  map((json) => {
    if (!json) return;
    // console.info('#', formatTime(Date.now()), 'layoutModelJson$', JSON.stringify(json));
    const model = FlexLayout.Model.fromJson(json);
    const activeNode = model?.getActiveTabset()?.getSelectedNode();
    if (activeNode?.getType() === 'tab') {
      const activeTabNode = activeNode as FlexLayout.TabNode;
      return {
        page: activeTabNode.getComponent()!,
        pageParams: activeTabNode.getConfig(),
      };
    }
  }),
  shareReplay(1),
);

// sync ActivePage$ to URL
activePage$.subscribe((x) => {
  if (!x) return;
  // console.info('#', formatTime(Date.now()), 'activePage$', JSON.stringify(x));
  const currentURL = new URL(document.location.href);
  currentURL.searchParams.set('page', x.page);
  currentURL.searchParams.set(
    'page_params',
    encodeBase58(new TextEncoder().encode(JSON.stringify(x.pageParams))),
  );
  window.history.pushState({}, '', currentURL.href);
});

const initialPage = loadPageFromURL();
// 当初次加载持久化的 layoutModelJson$ 时触发
layoutModelJson$.pipe(first((json) => json !== undefined)).subscribe(() => {
  if (initialPage) {
    // console.info(formatTime(Date.now()), '##loadPageFromURL', initialPage);
    executeCommand('Page.open', initialPage);
  }
});

// 后退历史时触发
// new Observable((subscriber) => {
//   const f = () => {
//     subscriber.next();
//   };
//   window.addEventListener('popstate', f);
//   return () => {
//     window.removeEventListener('popstate', f);
//   };
// }).subscribe(() => {
//   const initialPage = loadPageFromURL();
//   if (initialPage) {
//     console.info(formatTime(Date.now()), '##loadPageFromURL', initialPage);
//     executeCommand('Page.open', initialPage);
//   }
// });

export const layoutModel$ = layoutModelJson$.pipe(
  map((json) => (json ? FlexLayout.Model.fromJson(json) : null)),
  shareReplay(1),
);

const requiredLayoutModel$ = layoutModel$.pipe(filter((x): x is Exclude<typeof x, null | undefined> => !!x));

layoutModel$.subscribe((layoutModel) => {
  Object.assign(globalThis, { layoutModel, Actions: FlexLayout.Actions });
});

registerCommand('Page.open', async ({ type: pageKey, params = {}, parentId: _parentId }) => {
  Modules.Workbench.isShowHome$.next(false);
  const pageId = JSON.stringify({ pageKey, params });
  const model = await firstValueFrom(requiredLayoutModel$);

  const theNode = model.getNodeById(pageId);
  if (theNode) {
    if (!theNode.isVisible()) {
      model.doAction(FlexLayout.Actions.selectTab(theNode.getId()));
      layoutModelJson$.next(model.toJson());
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
  layoutModelJson$.next(model.toJson());
});

registerCommand('Page.select', async ({ id: pageId }) => {
  const model = await firstValueFrom(requiredLayoutModel$);
  const node = model.getNodeById(pageId);
  if (node) {
    if (!node.isVisible()) {
      model.doAction(FlexLayout.Actions.selectTab(pageId));
      layoutModelJson$.next(model.toJson());
    }
  }
});

const closeCurrentTab = async () => {
  const model = await firstValueFrom(requiredLayoutModel$);
  const tabset = model.getActiveTabset();
  const nodeId = tabset?.getSelectedNode()?.getId();
  if (nodeId) {
    model.doAction(FlexLayout.Actions.deleteTab(nodeId));
    layoutModelJson$.next(model.toJson());
  }
};

hotkeys('alt+w', function (event, handler) {
  // Prevent the default refresh event under WINDOWS system
  event.preventDefault();
  closeCurrentTab();
});

registerCommand('ResetLayout', () => {
  layoutModelJson$.next(initialJson());
});

registerCommand('ClosePage', () => {
  closeCurrentTab();
});

registerCommand('Page.close', async ({ pageId }) => {
  const model = await firstValueFrom(requiredLayoutModel$);
  model.doAction(FlexLayout.Actions.deleteTab(pageId));
  layoutModelJson$.next(model.toJson());
});

registerCommand('Page.changeTitle', async ({ pageId, title }) => {
  const model = await firstValueFrom(requiredLayoutModel$);
  model.doAction(FlexLayout.Actions.renameTab(pageId, title));
  layoutModelJson$.next(model.toJson());
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
