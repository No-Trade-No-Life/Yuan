import { Layout, Space, Typography } from '@douyinfe/semi-ui';
import { Actions, Layout as FlexLayout, TabNode } from 'flexlayout-react';
import { useObservableState } from 'observable-hooks';
import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { CommandCenter } from '../CommandCenter';
import { LanguageSelector } from '../Locale/LanguageSelector';
import { Page } from '../Pages';
import { ErrorBoundary } from '../Pages/ErrorBoundary';
import { NetworkStatusWidget } from '../Terminals/NetworkStatusWidget';
import { UserMenu } from '../User/UserMenu';
import { HomePage } from '../Workbench/HomePage';
import { isDarkMode$ } from '../Workbench/darkmode';
import { layoutModel$, layoutModelJson$ } from './layout-model';
import { DarkmodeSwitch } from '../Workbench/DarkmodeSwitch';

// ISSUE: React.memo will cause layout tab label not change while change language
export const DesktopLayout = () => {
  const { t, i18n } = useTranslation(['common', 'pages']);
  const model = useObservableState(layoutModel$);

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

  const isDarkMode = useObservableState(isDarkMode$);

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
                <LanguageSelector />
              </ErrorBoundary>
              <ErrorBoundary>
                <DarkmodeSwitch />
              </ErrorBoundary>
              <ErrorBoundary>
                <UserMenu />
              </ErrorBoundary>
            </Space>
          </Space>
        </Space>
      </Layout.Header>
      <Layout.Content style={{ position: 'relative' }}>
        {model && (
          <FlexLayout
            onModelChange={(model) => {
              layoutModelJson$.next(model.toJson());
            }}
            onRenderTab={(node, renderValues) => {
              const type = node.getComponent();
              const i18nKey = `pages:${type}`;
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
