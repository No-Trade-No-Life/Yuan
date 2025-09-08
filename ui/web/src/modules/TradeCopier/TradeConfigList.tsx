import { IconRefresh } from '@douyinfe/semi-icons';
import { Button } from '@douyinfe/semi-ui';
import { createColumnHelper } from '@tanstack/react-table';
import { InlineAccountId } from '../AccountInfo';
import { executeCommand } from '../CommandCenter';
import { DataRecordView } from '../DataRecord';
import { Switch } from '../Interactive';
import { registerPage } from '../Pages';
import { ITradeCopierTradeConfig } from './interface';

registerPage('TradeConfigList', () => {
  return (
    <DataRecordView
      TYPE="trade_copier_trade_config"
      schema={{
        type: 'object',
        properties: {
          account_id: { type: 'string', title: '账户 ID', format: 'account_id' },
          product_id: { type: 'string', title: '品种 ID', default: '' },
          max_volume_per_order: { type: 'number', title: '每单最大手数', default: 1 },
          limit_order_control: { type: 'boolean', title: '限价单控制', default: false },
          disabled: { type: 'boolean', title: '禁用', default: false },
        },
      }}
      columns={(ctx) => {
        const columnHelper = createColumnHelper<ITradeCopierTradeConfig>();
        return [
          columnHelper.accessor('account_id', {
            header: () => '账户 ID',
            cell: (ctx) => <InlineAccountId account_id={ctx.getValue()} />,
          }),
          columnHelper.accessor('product_id', {
            header: () => '品种 ID',
          }),
          columnHelper.accessor('max_volume_per_order', {
            header: () => '每单最大手数',
          }),
          columnHelper.accessor('disabled', {
            header: () => '启用',
            cell: (ctx) => <Switch checked={!ctx.getValue()} />,
          }),
          columnHelper.accessor('limit_order_control', {
            header: () => '限价单控制',
            cell: (ctx) => <Switch checked={ctx.getValue()} />,
          }),
        ];
      }}
      extraHeaderActions={() => {
        return (
          <Button icon={<IconRefresh />} onClick={() => executeCommand('TradeCopier.Restart')}>
            重启跟单阵列
          </Button>
        );
      }}
    />
  );
});
