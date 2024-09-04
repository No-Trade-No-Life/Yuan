import { IconFullScreenStroked, IconHome } from '@douyinfe/semi-icons';
import { Layout, Space } from '@douyinfe/semi-ui';
import { Actions, Layout as FlexLayout, TabNode } from 'flexlayout-react';
import { useObservableState } from 'observable-hooks';
import { useEffect, useState } from 'react';
import { CommandCenter } from '../CommandCenter';
import { fs } from '../FileSystem';
import { Button } from '../Interactive';
import { LocalizePageTitle, Page } from '../Pages';
import { ErrorBoundary } from '../Pages/ErrorBoundary';
import { NetworkStatusWidget } from '../Terminals/NetworkStatusWidget';
import { UserMenu } from '../User/UserMenu';
import { HomePage, isShowHome$, toggleShowHome, useIsDarkMode } from '../Workbench';
import { DarkmodeSwitch } from '../Workbench/DarkmodeSwitch';
import { registerAssociationRule } from '../Workspace';
import { WallPaper } from './WallPaper';
import { layoutModel$, layoutModelJson$ } from './layout-model';

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

  const isDarkMode = useIsDarkMode();

  const [style, setStyle] = useState('');

  useEffect(() => {
    // ISSUE: use css by raw import will not produce side-effect. we can easily switch between dark and light
    if (isDarkMode) {
      import('flexlayout-react/style/dark.css?raw').then((mod) => setStyle(mod.default));
    } else {
      import('flexlayout-react/style/light.css?raw').then((mod) => setStyle(mod.default));
    }
  }, [isDarkMode]);

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
      {isShowHome ? <HomePage /> : null}
      <Layout.Content style={{ position: 'relative' }}>
        {model && (
          <FlexLayout
            onModelChange={(model) => {
              layoutModelJson$.next(model.toJson());
            }}
            onRenderTab={(node, renderValues) => {
              renderValues.content = (
                <LocalizePageTitle type={node.getComponent()!} params={node.getConfig()} />
              );
            }}
            onTabSetPlaceHolder={() => {
              isShowHome$.next(true);
              return null;
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

        <style>{style}</style>
      </Layout.Content>
      <Layout.Header style={{ padding: 4 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
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
                <Button
                  theme="borderless"
                  type="tertiary"
                  icon={<IconFullScreenStroked />}
                  onClick={async () => {
                    if (document.fullscreenElement) {
                      return document.exitFullscreen();
                    }
                    function enterFullscreen(element: any) {
                      if (element.requestFullscreen) {
                        return element.requestFullscreen();
                      } else if (element.mozRequestFullScreen) {
                        // Firefox
                        return element.mozRequestFullScreen();
                      } else if (element.webkitRequestFullscreen) {
                        // Chrome, Safari and Opera
                        return element.webkitRequestFullscreen();
                      } else if (element.msRequestFullscreen) {
                        // IE/Edge
                        return element.msRequestFullscreen();
                      }
                    }
                    return enterFullscreen(document.body);

                    // return document.body.requestFullscreen();
                  }}
                ></Button>
              </ErrorBoundary>
            </Space>
          </Space>
        </Space>
      </Layout.Header>
    </Layout>
  );
};
