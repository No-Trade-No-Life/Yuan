import { Layout, Space, Typography } from '@douyinfe/semi-ui';
import { Actions, Layout as FlexLayout, TabNode } from 'flexlayout-react';
import { useObservableState } from 'observable-hooks';
import React, { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { isDarkMode$ } from '../../common/Darkmode';
import { ErrorBoundary } from '../../common/ErrorBoundary';
import { layoutModel$, layoutModelJson$ } from '../../layout-model';
import { CommandCenter } from '../CommandCenter/CommandCenter';
import { NetworkStatusWidget } from '../Terminals/NetworkStatusWidget';
import { Login } from '../User/Login';
import { UserMenu } from '../User/UserMenu';
import { HomePage } from './HomePage';
import { NotFound } from './NotFound';
const AvailableComponents: Record<string, React.ComponentType> = {};

export const registerComponent = (components: Record<string, React.ComponentType>) => {
  Object.assign(AvailableComponents, components);
};

// ISSUE: React.memo will cause layout tab label not change while change language
export const DesktopLayout = () => {
  const { t, i18n } = useTranslation('common');
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
    return <ErrorBoundary>{theNode ? React.cloneElement(theNode, { node }) : null}</ErrorBoundary>;
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
            <ErrorBoundary>
              <Space>
                <NetworkStatusWidget />
                <UserMenu />
              </Space>
            </ErrorBoundary>
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
              const i18nKey = `common:${type}`;
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
