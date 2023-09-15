import { IconClose, IconUndo } from '@douyinfe/semi-icons';
import { Button, Empty, Layout, Space, Typography } from '@douyinfe/semi-ui';
import '@icon-park/react/styles/index.css';
import * as _kernel from '@yuants/kernel';
import * as FlexLayout from 'flexlayout-react';
import { useObservableState } from 'observable-hooks';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Route, Routes } from 'react-router-dom';
import * as rx from 'rxjs';
import { isDarkMode$ } from './common/Darkmode';
import { ErrorBoundary } from './common/ErrorBoundary';
import './common/page';
import { initialJson, layoutModel$, layoutModelJson$, layoutUpdate$ } from './layout-model';
import { LUI } from './modules/AI/LUI';
import { AccountInfoPanel } from './modules/AccountInfo/AccountInfoPanel';
import { AccountList } from './modules/AccountInfo/AccountList';
import { AccountPerformancePanel } from './modules/AccountInfo/AccountPerformancePanel';
import { AgentBatchBackTest } from './modules/Agent/AgentBatchBackTest';
import { AgentConfForm } from './modules/Agent/AgentConfForm';
import { AccountFrameChart } from './modules/Chart/AccountFrameChart';
import { TechnicalChart } from './modules/Chart/TechnicalChart';
import { DeployConfigForm } from './modules/Deploy/DeployConfigForm';
import { FileEditor } from './modules/Editor/FileEditor';
import { ExtensionPanel } from './modules/Extensions/ExtensionPanel';
import * as Extensions from './modules/Extensions/utils';
import { ClearingAndSettlement } from './modules/Fund/ClearingAndSettlement';
import { FinancialStatementsPanel } from './modules/Fund/FinancialStatementsPanel';
import { RealtimeAsset } from './modules/Fund/RealtimeAsset';
import { GeneralSpecificRelationList } from './modules/GeneralSpecificRelations/GeneralSpecificRelationList';
import { AccountReplay } from './modules/Kernel/AccountReplay';
import i18n from './modules/Locale/i18n';
import { Market } from './modules/Market';
import { ManualTradePanel } from './modules/Order/ManualTradePanel';
import { OrderListPanel } from './modules/Order/OrderListPanel';
import { ProductList } from './modules/Products/ProductList';
import { PullSourceRelationList } from './modules/PullSourceRelations/PullSourceRelationList';
import { RecordTablePanel } from './modules/Shell/RecordTablePanel';
import { SubscriptionRelationList } from './modules/SubscriptionRelation/SubscriptionRelationList';
import { NetworkStatusWidget } from './modules/Terminals/NetworkStatusWidget';
import { TerminalList } from './modules/Terminals/TerminalList';
import { TradeCopyRelationList } from './modules/TradeCopier/TradeCopyRelationList';
import { Login } from './modules/User/Login';
import { UserMenu } from './modules/User/UserMenu';
import { HomePage } from './modules/Workbench/HomePage';
import { HostList } from './modules/Workbench/HostList';
import { Program } from './modules/Workbench/Program';
import { Explorer } from './modules/Workspace/Explorer';

Object.assign(globalThis, { rx, _kernel, Extensions, i18n });

const AvailableComponents: Record<string, React.ComponentType> = {
  Explorer,
  AccountReplay,
  AccountFrameChart,
  ExtensionPanel,
  Program,
  AccountInfoPanel,
  SubscriptionRelationList,
  OrderListPanel,
  TerminalList,
  AccountList,
  ManualTradePanel,
  FinancialStatementsPanel,
  HostList,
  ClearingAndSettlement,
  Market,
  RealtimeAsset,
  DeployConfigForm,
  ProductList,
  FileEditor,
  PullSourceRelationList,
  GeneralSpecificRelationList,
  TradeCopyRelationList,
  LUI,
  TechnicalChart,
  AccountPerformancePanel,
  AgentConfForm,
  AgentBatchBackTest,
  RecordTablePanel,
};

function AppLayout() {
  const model = useObservableState(layoutModel$);
  const { t } = useTranslation();

  const factory = (node: FlexLayout.TabNode) => {
    const component = node.getComponent();
    const getNode = () => {
      if (component) {
        const TheComponent = AvailableComponents[component];
        if (TheComponent) {
          return <TheComponent />;
        }
      }

      return (
        <Empty
          title={<Typography.Title heading={4}>组件不存在</Typography.Title>}
          description={`组件 ${component} 不存在，这意味着软件可能已经升级`}
        >
          <Space align="center">
            <Button
              icon={<IconUndo />}
              type="primary"
              onClick={() => {
                layoutModelJson$.next(initialJson());
                layoutUpdate$.next();
              }}
            >
              重置布局
            </Button>
            或
            <Button
              icon={<IconClose />}
              type="tertiary"
              onClick={() => {
                model.doAction(FlexLayout.Actions.deleteTab(node.getId()));
              }}
            >
              仅关闭此标签
            </Button>
          </Space>
        </Empty>
      );
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
        <Layout>
          <Layout.Content>
            <Space>
              <div></div>
              <Typography.Title heading={3}>
                <b style={{ color: 'red' }}>Y</b>uan
              </Typography.Title>
            </Space>
          </Layout.Content>
          <Layout.Sider>
            <ErrorBoundary>
              <Space>
                <NetworkStatusWidget />
                <UserMenu />
              </Space>
            </ErrorBoundary>
          </Layout.Sider>
        </Layout>
      </Layout.Header>
      <Layout.Content style={{ position: 'relative' }}>
        <Login />
        {model && (
          <FlexLayout.Layout
            onModelChange={(model) => {
              layoutModelJson$.next(model.toJson());
            }}
            onTabSetPlaceHolder={() => {
              return <HomePage />;
            }}
            onAuxMouseClick={(node, e) => {
              if (
                node instanceof FlexLayout.TabNode &&
                node.isEnableClose() &&
                // middle click
                e.button === 1
              ) {
                model.doAction(FlexLayout.Actions.deleteTab(node.getId()));
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
}

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}></Route>
      <Route path="/popout" element={<div />}></Route>
    </Routes>
  );
};

export default App;
