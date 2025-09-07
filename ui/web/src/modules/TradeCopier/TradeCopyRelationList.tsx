import { IconRefresh } from '@douyinfe/semi-icons';
import { Button, Switch, Toast } from '@douyinfe/semi-ui';
import { createColumnHelper } from '@tanstack/react-table';
import { buildInsertManyIntoTableSQL, requestSQL } from '@yuants/sql';
import { filter, first, mergeMap, tap } from 'rxjs';
import { InlineAccountId } from '../AccountInfo';
import { executeCommand, registerCommand } from '../CommandCenter';
import { DataRecordView } from '../DataRecord';
import { registerPage } from '../Pages';
import { terminal$ } from '../Terminals';
import { terminate } from '../Terminals/TerminalListItem';
import { ITradeCopyRelation } from './interface';

registerPage('TradeCopyRelationList', () => {
  return (
    <DataRecordView
      TYPE="trade_copy_relation"
      columns={(ctx) => {
        const columnHelper = createColumnHelper<ITradeCopyRelation>();
        return [
          columnHelper.accessor('source_account_id', {
            header: () => '源账户 ID',
            cell: (ctx) => <InlineAccountId account_id={ctx.getValue()} />,
          }),
          columnHelper.accessor('source_product_id', {
            header: () => '源品种 ID',
          }),
          columnHelper.accessor('target_account_id', {
            header: () => '目标账户 ID',
            cell: (ctx) => <InlineAccountId account_id={ctx.getValue()} />,
          }),
          columnHelper.accessor('target_product_id', {
            header: () => '目标品种 ID',
          }),
          columnHelper.accessor('multiple', {
            header: () => '头寸倍数',
          }),
          columnHelper.accessor('exclusive_comment_pattern', {
            header: () => '根据正则表达式匹配头寸的备注 (黑名单)',
          }),
          columnHelper.accessor('disabled', {
            header: () => '禁用',
            cell: (ctx1) => (
              <Switch
                checked={!!ctx1.getValue()}
                onChange={(v) => {
                  const record = ctx1.row.original;
                  const next = {
                    ...record,
                    disabled: v,
                  };
                  terminal$
                    .pipe(
                      filter((x): x is Exclude<typeof x, null> => !!x),
                      first(),
                      mergeMap((terminal) =>
                        requestSQL(
                          terminal,
                          buildInsertManyIntoTableSQL([next], 'trade_copy_relation', {
                            conflictKeys: ['id'],
                          }),
                        ),
                      ),
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
