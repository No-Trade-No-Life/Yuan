import { IconRefresh } from '@douyinfe/semi-icons';
import { Button, Empty, Layout, Space, Typography } from '@douyinfe/semi-ui';
import { Actions, Layout as FlexLayout, TabNode } from 'flexlayout-react';
import { useObservableState } from 'observable-hooks';
import React, { useContext, useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { isDarkMode$ } from '../Workbench/darkmode';
import { ErrorBoundary } from '../Pages/ErrorBoundary';
import { CommandCenter, registerCommand } from '../CommandCenter';
import { NetworkStatusWidget } from '../Terminals/NetworkStatusWidget';
import { Login } from '../User/Login';
import { UserMenu } from '../User/UserMenu';
import { HomePage } from '../Workbench/HomePage';
import { NotFound } from '../Workbench/NotFound';
import { layoutModel$, layoutModelJson$, openPage } from './layout-model';
const AvailableComponents: Record<string, React.ComponentType> = {};

export const registerComponent = (components: Record<string, React.ComponentType>) => {
  Object.assign(AvailableComponents, components);
};

export const registerPage = (type: string, component: React.ComponentType) => {
  AvailableComponents[type] = React.memo(component);
  registerCommand(type, (params) => openPage(type, params));
};

const TabNodeContext = React.createContext<TabNode | null>(null);

export const usePageParams = () => {
  const node = useContext(TabNodeContext);
  return node?.getConfig() ?? {};
};

export const usePageTitle = (title: string) => {
  const node = useContext(TabNodeContext);
  const nodeId = node?.getId();

  // ISSUE: node cannot be treat as deps. Or it will cause infinite rendering
  // (node change -> rename tab -> layout change -> node change -> ...)
  useEffect(() => {
    if (nodeId) {
      layoutModel$.value.doAction(Actions.renameTab(nodeId, title));
    }
  }, [title, nodeId]);
};

export const usePageType = () => {
  const node = useContext(TabNodeContext);
  return node?.getComponent() ?? '';
};

export const usePageViewport = () => {
  const node = useContext(TabNodeContext);
  const rect = node?.getRect();
  if (rect) {
    return {
      x: rect.x,
      y: rect.y,
      w: rect.width,
      h: rect.height,
    };
  }
  return undefined;
};

// ISSUE: React.memo will cause layout tab label not change while change language
export const DesktopLayout = () => {
  const { t, i18n } = useTranslation(['common', 'page']);
  const model = useObservableState(layoutModel$);

  const factory = (node: TabNode) => {
    const component = node.getComponent();
    const getNode = () => {
      if (component) {
        const TheComponent = AvailableComponents[component] || NotFound;
        return <TheComponent />;
      }
    };
    const theNode = getNode();

    return (
      <ErrorBoundary
        fallback={({ error, reset }) => {
          return (
            <Empty
              title={`错误: ${error}`}
              description="渲染过程发生错误，请打开 F12 查看问题，并报告给 Yuan 的维护者"
            >
              <Button
                icon={<IconRefresh />}
                onClick={() => {
                  reset();
                }}
              >
                重试
              </Button>
            </Empty>
          );
        }}
      >
        <TabNodeContext.Provider value={node}>{theNode}</TabNodeContext.Provider>
      </ErrorBoundary>
    );
  };

  const isDarkMode = useObservableState(isDarkMode$);

  const [style, setStyle] = useState('');

  useEffect(() => {
    // ISSUE: 使用 raw import css 可以不追加 css link 到 head 中，可以正确随系统切换暗黑主题
    if (isDarkMode) {
      import('flexlayout-react/style/dark.css?raw').then((mod) => setStyle(mod.default));
    } else {
      import('flexlayout-react/style/light.css?raw').then((mod) => setStyle(mod.default));
    }
  }, [isDarkMode]);

  return (
    <Layout style={{ height: '100%' }}>
      <Layout.Header style={{ padding: 4 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Typography.Title heading={3}>
              <b style={{ color: 'red' }}>Y</b>uan
            </Typography.Title>
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
                <UserMenu />
              </ErrorBoundary>
            </Space>
          </Space>
        </Space>
      </Layout.Header>
      <Layout.Content style={{ position: 'relative' }}>
        <Login />
        {model && (
          <FlexLayout
            onModelChange={(model) => {
              layoutModelJson$.next(model.toJson());
            }}
            onRenderTab={(node, renderValues) => {
              const type = node.getComponent();
              const i18nKey = `page:${type}`;
              if (i18n.exists(i18nKey)) {
                const config = node.getConfig();
                renderValues.content = (
                  <Trans
                    i18nKey={i18nKey}
                    values={config}
                    tOptions={{ interpolation: { escapeValue: false } }}
                  ></Trans>
                );
              }
            }}
            onTabSetPlaceHolder={() => {
              return <HomePage />;
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
    </Layout>
  );
};
