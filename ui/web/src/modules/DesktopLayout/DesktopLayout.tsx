import { IconHome } from '@douyinfe/semi-icons';
import { Layout, Space } from '@douyinfe/semi-ui';
import { Actions, Layout as FlexLayout, TabNode } from 'flexlayout-react';
import { useObservableState } from 'observable-hooks';
import { useMemo } from 'react';
import { createPersistBehaviorSubject } from '../BIOS';
import { CommandCenter } from '../CommandCenter';
import { fs } from '../FileSystem';
import { Button } from '../Interactive';
import { LocalizePageTitle, Page } from '../Pages';
import { ErrorBoundary } from '../Pages/ErrorBoundary';
import { registerAssociationRule } from '../System';
import { NetworkStatusWidget } from '../Terminals/NetworkStatusWidget';
import { UserMenu } from '../User/UserMenu';
import { FullScreenButton, HomePage, isShowHome$, toggleShowHome } from '../Workbench';
import { DarkmodeSwitch } from '../Workbench/DarkmodeSwitch';
import { WallPaper } from './WallPaper';
import { layoutModel$, layoutModelJson$ } from './layout-model';

export const isHideNavigator$ = createPersistBehaviorSubject('hide-navigator', false);
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
      <Layout.Content style={{ position: 'relative' }}>
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
