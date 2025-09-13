import { createColumnHelper } from '@tanstack/react-table';
import { buildInsertManyIntoTableSQL, requestSQL } from '@yuants/sql';
import { formatTime } from '@yuants/utils';
import { JSONSchema7 } from 'json-schema';
import { firstValueFrom } from 'rxjs';
import { InlineAccountId } from '../AccountInfo';
import { DataRecordView } from '../DataRecord';
import { DataView, Switch, Toast } from '../Interactive';
import { terminal$ } from '../Network';
import { registerPage } from '../Pages';
import { IAccountComposerConfig } from './interface';

export const schemaOfAccountComposerConfig: JSONSchema7 = {
  type: 'object',
  properties: {
    account_id: { type: 'string', title: '账户 ID' },
    sources: {
      type: 'array',
      title: '成分',
      items: {
        type: 'object',
        properties: {
          enabled: { type: 'boolean', title: '启用', default: true },
          account_id: { type: 'string', title: '成分账户 ID', format: 'account_id' },
          multiple: { type: 'number', title: '乘数', default: 1 },
          type: {
            type: 'string',
            title: '类型',
            enum: ['ALL', 'BY_PRODUCT'],
          },
          source_product_id: {
            type: 'string',
            title: '源品种 ID (仅 类型=BY_PRODUCT 有效)',
          },
          source_datasource_id: {
            type: 'string',
            title: '源数据源 ID (仅 类型=BY_PRODUCT 有效)',
            description: '为空则表示匹配所有数据源',
          },
          target_product_id: {
            type: 'string',
            title: '目标品种 ID (仅 类型=BY_PRODUCT 有效)',
            description: '为空则表示与源品种相同',
          },
          target_datasource_id: {
            type: 'string',
            title: '目标数据源 ID (仅 类型=BY_PRODUCT 有效)',
            description: '为空则表示与源数据源相同',
          },
        },
      },
    },
    enabled: { type: 'boolean', title: '启用' },
  },
};
registerPage('AccountComposerConfigList', () => {
  return (
    <DataRecordView
      TYPE={'account_composer_config'}
      conflictKeys={['account_id']}
      schema={schemaOfAccountComposerConfig}
      columns={(c) => {
        const columnHelper = createColumnHelper<IAccountComposerConfig>();
        return [
          columnHelper.accessor('enabled', {
            header: '启用',
            cell: (ctx) => (
              <Switch
                checked={ctx.getValue()}
                onChange={async () => {
                  const record = ctx.row.original;
                  const terminal = await firstValueFrom(terminal$);
                  if (!terminal) return;
                  const next = {
                    ...record,
                    enabled: !record.enabled,
                  };
                  await requestSQL(
                    terminal,
                    buildInsertManyIntoTableSQL([next], 'account_composer_config', {
                      conflictKeys: ['account_id'],
                    }),
                  );
                  await c.reloadData();
                  Toast.success(`成功更新数据记录 ${record.account_id}`);
                }}
              />
            ),
          }),
          columnHelper.accessor('account_id', {
            header: () => '账户',
            cell: (ctx) => <InlineAccountId account_id={ctx.getValue()} />,
          }),
          columnHelper.accessor('sources', {
            header: () => '成分',
            cell: (ctx) => {
              const sources = ctx.row.original.sources;
              return (
                <DataView
                  data={sources}
                  initialTopSlotVisible={false}
                  columns={[
                    {
                      header: '启用',
                      accessorKey: 'enabled',
                      cell: (info) => (
                        <Switch checked={!!info.getValue()} disabled onChange={() => {}}></Switch>
                      ),
                    },
                    {
                      header: '账户',
                      accessorKey: 'account_id',
                      cell: (info) => <InlineAccountId account_id={info.getValue() as string} />,
                    },
                    { header: '类型', accessorKey: 'type' },
                    { header: '乘数', accessorKey: 'multiple' },
                    { header: '源品种', accessorKey: 'source_product_id' },
                    { header: '源数据源', accessorKey: 'source_datasource_id' },
                    { header: '目标品种', accessorKey: 'target_product_id' },
                    { header: '目标数据源', accessorKey: 'target_datasource_id' },
                  ]}
                />
              );
            },
          }),

          columnHelper.accessor('created_at', {
            header: () => '创建时间',
            cell: (ctx) => formatTime(ctx.getValue()),
          }),
          columnHelper.accessor('updated_at', {
            header: () => '更新时间',
            cell: (ctx) => formatTime(ctx.getValue()),
          }),
        ];
      }}
    />
  );
});
