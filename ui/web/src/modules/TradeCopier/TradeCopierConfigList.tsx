import { createColumnHelper } from '@tanstack/react-table';
import { formatTime } from '@yuants/utils';
import { InlineAccountId } from '../AccountInfo';
import { DataRecordView } from '../DataRecord';
import { Switch } from '../Interactive';
import { registerPage } from '../Pages';
import { ITradeCopierConfig } from './interface';
import { schemaOfTradeCopierConfig } from './schema';

registerPage('TradeCopierConfigList', () => {
  return (
    <DataRecordView
      TYPE="trade_copier_config"
      schema={schemaOfTradeCopierConfig}
      conflictKeys={['account_id']}
      columns={(ctx) => {
        const columnHelper = createColumnHelper<ITradeCopierConfig>();
        return [
          columnHelper.accessor('account_id', {
            header: () => '账户 ID',
            cell: (ctx) => <InlineAccountId account_id={ctx.getValue()} />,
          }),
          columnHelper.accessor('strategy', {
            header: () => '策略配置',
            cell: (ctx) => <pre>{JSON.stringify(ctx.getValue(), null, 2)}</pre>,
          }),
          columnHelper.accessor('enabled', {
            header: () => '启用',
            cell: (ctx) => <Switch checked={ctx.getValue()} />,
          }),
          columnHelper.accessor('created_at', {
            header: '创建时间',
            cell: (ctx) => formatTime(ctx.getValue()),
          }),
          columnHelper.accessor('updated_at', {
            header: '更新时间',
            cell: (ctx) => formatTime(ctx.getValue()),
          }),
        ];
      }}
    />
  );
});
