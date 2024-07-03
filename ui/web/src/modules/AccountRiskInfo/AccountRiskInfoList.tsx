import { Switch } from '@douyinfe/semi-ui';
import { createColumnHelper } from '@tanstack/react-table';
import { IDataRecord } from '@yuants/data-model';
import { InlineAccountId } from '../AccountInfo';
import { executeCommand, registerCommand } from '../CommandCenter';
import { DataRecordView } from '../DataRecord';
import { Button } from '../Interactive';
import { registerPage } from '../Pages';
import { terminate } from '../Terminals/TerminalListItem';
import { IAccountRiskInfo, acrSchema, wrapAccountRiskInfo } from './models/AccountRiskInfo';

const TYPE = 'account_risk_info';

function newRecord(): Partial<IAccountRiskInfo> {
  return {};
}

function beforeUpdateTrigger(x: IAccountRiskInfo) {}

function defineColumns() {
  return () => {
    const columnHelper = createColumnHelper<IDataRecord<IAccountRiskInfo>>();
    return [
      columnHelper.accessor('origin.account_id', {
        header: () => '账户',
        cell: (ctx) => <InlineAccountId account_id={ctx.getValue()} />,
      }),
      columnHelper.accessor('origin.group_id', {
        header: () => '风险组',
      }),
      columnHelper.accessor('origin.active_demand_threshold', {
        header: () => '主动需求阈值',
      }),
      columnHelper.accessor('origin.passive_demand_threshold', {
        header: () => '被动需求阈值',
      }),
      columnHelper.accessor('origin.passive_supply_threshold', {
        header: () => '被动供给阈值',
      }),
      columnHelper.accessor('origin.active_supply_threshold', {
        header: () => '主动供给阈值',
      }),
      columnHelper.accessor('origin.disabled', {
        header: () => '启用',
        cell: (ctx) => <Switch checked={!ctx.getValue()} />,
      }),
    ];
  };
}

registerPage('AccountRiskInfoList', () => {
  return (
    <DataRecordView
      TYPE={TYPE}
      schema={acrSchema}
      columns={defineColumns()}
      newRecord={newRecord}
      beforeUpdateTrigger={beforeUpdateTrigger}
      mapOriginToDataRecord={wrapAccountRiskInfo}
      extraHeaderActions={() => {
        return <Button onClick={() => executeCommand('RiskManager.Restart')}>重启风控器</Button>;
      }}
    />
  );
});

registerCommand('RiskManager.Restart', () => {
  terminate('RiskManager');
});
