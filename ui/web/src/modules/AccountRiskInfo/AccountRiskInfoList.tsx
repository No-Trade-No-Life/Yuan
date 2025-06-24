import { Switch } from '@douyinfe/semi-ui';
import { createColumnHelper } from '@tanstack/react-table';
import { IAccountRiskInfo } from '@yuants/app-risk-manager/lib/models';
import { InlineAccountId } from '../AccountInfo';
import { executeCommand, registerCommand } from '../CommandCenter';
import { DataRecordView } from '../DataRecord';
import { Button } from '../Interactive';
import { registerPage } from '../Pages';
import { terminate } from '../Terminals/TerminalListItem';

function defineColumns() {
  return () => {
    const columnHelper = createColumnHelper<IAccountRiskInfo>();
    return [
      columnHelper.accessor('currency', {
        header: () => '货币',
      }),
      columnHelper.accessor('group_id', {
        header: () => '风险组',
      }),
      columnHelper.accessor('account_id', {
        header: () => '账户',
        cell: (ctx) => <InlineAccountId account_id={ctx.getValue()} />,
      }),
      columnHelper.accessor('active_demand_threshold', {
        header: () => '主动需求阈值',
      }),
      columnHelper.accessor('passive_demand_threshold', {
        header: () => '被动需求阈值',
      }),
      columnHelper.accessor('passive_supply_threshold', {
        header: () => '被动供给阈值',
      }),
      columnHelper.accessor('active_supply_threshold', {
        header: () => '主动供给阈值',
      }),
      columnHelper.accessor('active_demand_leverage', {
        header: () => '主动需求杠杆阈值',
      }),
      columnHelper.accessor('passive_demand_leverage', {
        header: () => '被动需求杠杆阈值',
      }),
      columnHelper.accessor('passive_supply_leverage', {
        header: () => '被动供给杠杆阈值',
      }),
      columnHelper.accessor('active_supply_leverage', {
        header: () => '主动供给杠杆阈值',
      }),
      columnHelper.accessor('minimum_free', {
        header: () => '最低可用保证金',
      }),
      columnHelper.accessor('disabled', {
        header: () => '启用',
        cell: (ctx) => <Switch checked={!ctx.getValue()} />,
      }),
    ];
  };
}

registerPage('AccountRiskInfoList', () => {
  return (
    <DataRecordView
      TYPE="account_risk_info"
      columns={defineColumns()}
      extraHeaderActions={() => {
        return <Button onClick={() => executeCommand('RiskManager.Restart')}>重启风控器</Button>;
      }}
    />
  );
});

registerCommand('RiskManager.Restart', () => {
  terminate('RiskManager');
});
