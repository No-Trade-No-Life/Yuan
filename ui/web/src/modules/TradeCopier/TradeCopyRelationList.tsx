import { IconRefresh } from '@douyinfe/semi-icons';
import { Button, Switch, Toast } from '@douyinfe/semi-ui';
import { createColumnHelper } from '@tanstack/react-table';
import { IDataRecord, IDataRecordTypes, getDataRecordWrapper } from '@yuants/data-model';
import { writeDataRecords } from '@yuants/protocol';
import { filter, first, mergeMap, tap } from 'rxjs';
import { InlineAccountId } from '../AccountInfo';
import { executeCommand, registerCommand } from '../CommandCenter';
import { DataRecordView } from '../DataRecord';
import { registerPage } from '../Pages';
import { terminal$ } from '../Terminals';
import { terminate } from '../Terminals/TerminalListItem';

registerPage('TradeCopyRelationList', () => {
  return (
    <DataRecordView
      TYPE="trade_copy_relation"
      columns={(ctx) => {
        const columnHelper = createColumnHelper<IDataRecord<IDataRecordTypes['trade_copy_relation']>>();
        return [
          columnHelper.accessor('origin.source_account_id', {
            header: () => '源账户 ID',
            cell: (ctx) => <InlineAccountId account_id={ctx.getValue()} />,
          }),
          columnHelper.accessor('origin.source_product_id', {
            header: () => '源品种 ID',
          }),
          columnHelper.accessor('origin.target_account_id', {
            header: () => '目标账户 ID',
            cell: (ctx) => <InlineAccountId account_id={ctx.getValue()} />,
          }),
          columnHelper.accessor('origin.target_product_id', {
            header: () => '目标品种 ID',
          }),
          columnHelper.accessor('origin.multiple', {
            header: () => '头寸倍数',
          }),
          columnHelper.accessor('origin.exclusive_comment_pattern', {
            header: () => '根据正则表达式匹配头寸的备注 (黑名单)',
          }),
          columnHelper.accessor('origin.disabled', {
            header: () => '禁用',
            cell: (ctx1) => (
              <Switch
                checked={!!ctx1.getValue()}
                onChange={(v) => {
                  const record = ctx1.row.original;
                  const next = getDataRecordWrapper('trade_copy_relation')!({
                    ...record.origin,
                    disabled: v,
                  });
                  terminal$
                    .pipe(
                      filter((x): x is Exclude<typeof x, null> => !!x),
                      first(),
                      mergeMap((terminal) => writeDataRecords(terminal, [next])),
                      tap({
                        complete: () => {
                          Toast.success(`成功更新数据记录 ${record.id}`);
                          ctx.reloadData();
                        },
                      }),
                    )
                    .subscribe();
                }}
              ></Switch>
            ),
          }),
        ];
      }}
      newRecord={() => {
        return {};
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

registerCommand('TradeCopier.Restart', () => {
  terminate('TradeCopier');
});
