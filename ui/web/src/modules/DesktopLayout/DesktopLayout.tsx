import { IconHome } from '@douyinfe/semi-icons';
import { Layout, Space } from '@douyinfe/semi-ui';
import { decodeBase58, encodeBase58 } from '@yuants/utils';
import { Actions, Layout as FlexLayout, TabNode } from 'flexlayout-react';
import { useObservableState } from 'observable-hooks';
import { useEffect, useMemo } from 'react';
import { createPersistBehaviorSubject } from '../BIOS';
import { CommandCenter, executeCommand } from '../CommandCenter';
import { fs } from '../FileSystem';
import { Button } from '../Interactive';
import { activePage$, LocalizePageTitle, Page } from '../Pages';
import { ErrorBoundary } from '../Pages/ErrorBoundary';
import { registerAssociationRule } from '../System';
import { NetworkStatusWidget } from '../Terminals/NetworkStatusWidget';
import { UserMenu } from '../User/UserMenu';
import { FullScreenButton, HomePage, isShowHome$, toggleShowHome } from '../Workbench';
import { DarkmodeSwitch } from '../Workbench/DarkmodeSwitch';
import { WallPaper } from './WallPaper';
import { layoutModel$, layoutModelJson$ } from './layout-model';

export const isHideNavigator$ = createPersistBehaviorSubject('hide-navigator', false);

// Sync layout model to ActivePage$
layoutModel$.subscribe((model) => {
  const activeNode = model.getActiveTabset()?.getSelectedNode();
  if (activeNode?.getType() === 'tab') {
    const activeTabNode = activeNode as TabNode;
    activePage$.next({
      page: activeTabNode.getComponent()!,
      pageParams: activeTabNode.getConfig(),
    });
  }
});

// sync ActivePage$ to URL
activePage$.subscribe((x) => {
  if (!x) return;
  const currentURL = new URL(document.location.href);
  currentURL.searchParams.set('page', x.page);
  currentURL.searchParams.set(
    'page_params',
    encodeBase58(new TextEncoder().encode(JSON.stringify(x.pageParams))),
  );
  window.history.pushState({}, '', currentURL.href);
});

const isFullScreen$ = createPersistBehaviorSubject('full-screen', false);

registerAssociationRule({
  id: 'Layout',
  priority: 100,
  match: (ctx) => !!(ctx.isFile && ctx.path.match(/\.layout\.json$/)),
  action: async (ctx) => {
    const json = JSON.parse(await fs.readFile(ctx.path));
    layoutModelJson$.next(json);
    isShowHome$.next(false);
  },
});

// ISSUE: React.memo will cause layout tab label not change while change language
export const DesktopLayout = () => {
  const model = useObservableState(layoutModel$);
  const isShowHome = useObservableState(isShowHome$);
  const isDev = useMemo(() => new URL(document.location.href).searchParams.get('mode') === 'development', []);
  const isHideNavigator = useObservableState(isHideNavigator$);

  const activeNode = model.getActiveTabset()?.getSelectedNode();
  const isFullScreen = useObservableState(isFullScreen$);

  const factory = (node: TabNode) => {
    const id = node.getId();
    const type = node.getComponent()!;
    const params = node.getConfig() || {};
    const rect = node.getRect();
    const viewport = {
      x: rect.x,
      y: rect.y,
      w: rect.width,
      h: rect.height,
    };

    return <Page page={{ id, type, params, viewport }} />;
  };

  // Recovery layout model from URL
  useEffect(() => {
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
    executeCommand('Page.open', { type: page, params: params() });
  }, []);

  if (document.location.hash === '#/popout') {
    return null;
  }

  return (
    <Layout
      style={{
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <WallPaper />
      {isShowHome === true ? <HomePage /> : null}
      <Layout.Content style={{ position: 'relative', width: '100%', height: '100%' }}>
        {(isDev || !isFullScreen) && model && (
          <FlexLayout
            onModelChange={(model) => {
              layoutModelJson$.next(model.toJson());
            }}
            onRenderTab={(node, renderValues) => {
              renderValues.content = (
                <LocalizePageTitle type={node.getComponent()!} params={node.getConfig()} />
              );
            }}
            onAuxMouseClick={(node, e) => {
              if (
                node instanceof TabNode &&
                node.isEnableClose() &&
                // middle click
                e.button === 1
              ) {
                model.doAction(Actions.deleteTab(node.getId()));
              }
            }}
            popoutURL="/#/popout"
            model={model}
            factory={factory}
          />
        )}
        {!isDev &&
          isFullScreen &&
          activeNode &&
          activeNode.getType() === 'tab' &&
          factory(activeNode as TabNode)}
      </Layout.Content>
      {(isDev || !isHideNavigator) && (
        <Layout.Header
          style={{
            padding: 4,
            backgroundColor: 'var(--semi-color-bg-1)',
          }}
        >
          <Space
            style={{
              width: '100%',
              justifyContent: 'space-between',
            }}
          >
            <Space>
              <ErrorBoundary>
                <UserMenu />
              </ErrorBoundary>
              <Button
                icon={<IconHome />}
                theme="borderless"
                type={isShowHome ? 'primary' : 'tertiary'}
                onClick={async () => {
                  toggleShowHome();
                }}
              />
            </Space>
            <Space>
              <CommandCenter />
            </Space>
            <Space>
              <Space>
                <ErrorBoundary>
                  <NetworkStatusWidget />
                </ErrorBoundary>
                <ErrorBoundary>
                  <DarkmodeSwitch />
                </ErrorBoundary>
                <ErrorBoundary>
                  <FullScreenButton />
                </ErrorBoundary>
              </Space>
            </Space>
          </Space>
        </Layout.Header>
      )}
    </Layout>
  );
};
