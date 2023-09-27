import '@icon-park/react/styles/index.css';
import * as _kernel from '@yuants/kernel';
import { Route, Routes } from 'react-router-dom';
import * as rx from 'rxjs';
import './common/page';
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
import { TerminalList } from './modules/Terminals/TerminalList';
import { TradeConfigList } from './modules/TradeCopier/TradeConfigList';
import { TradeCopyRelationList } from './modules/TradeCopier/TradeCopyRelationList';
import { About } from './modules/Workbench/About';
import { DesktopLayout, registerComponent } from './modules/Workbench/DesktopLayout';
import { HostList } from './modules/Workbench/HostList';
import { Program } from './modules/Workbench/Program';
import { Explorer } from './modules/Workspace/Explorer';

Object.assign(globalThis, { rx, _kernel, i18n });

registerComponent({
  About,
  AccountFrameChart,
  AccountInfoPanel,
  AccountList,
  AccountPerformancePanel,
  AccountReplay,
  AgentBatchBackTest,
  AgentConfForm,
  DeployConfigForm,
  Explorer,
  ExtensionPanel,
  FinancialStatementsPanel,
  FileEditor,
  GeneralSpecificRelationList,
  HostList,
  LUI,
  ManualTradePanel,
  Market,
  OrderListPanel,
  ProductList,
  Program,
  PullSourceRelationList,
  RealtimeAsset,
  RecordTablePanel,
  SubscriptionRelationList,
  TechnicalChart,
  TerminalList,
  TradeConfigList,
  TradeCopyRelationList,
});

function AppLayout() {
  return <DesktopLayout />;
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
