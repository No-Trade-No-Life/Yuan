import { Switch, Toast } from '@douyinfe/semi-ui';
import { createColumnHelper } from '@tanstack/react-table';
import { IDataRecord, IDataRecordTypes, getDataRecordWrapper } from '@yuants/data-model';
import { writeDataRecords } from '@yuants/protocol';
import { filter, first, mergeMap, tap } from 'rxjs';
import { executeCommand } from '../CommandCenter';
import { DataRecordView } from '../DataRecord';
import { Button } from '../Interactive';
import { registerPage } from '../Pages';
import { terminal$ } from '../Terminals';

registerPage('PullSourceRelationList', () => {
  return (
    <DataRecordView<IDataRecordTypes['pull_source_relation']>
      TYPE="pull_source_relation"
      columns={(ctx) => {
        const columnHelper = createColumnHelper<IDataRecord<IDataRecordTypes['pull_source_relation']>>();
        return [
          columnHelper.accessor('origin.datasource_id', {
            header: () => '数据源 ID',
          }),
          columnHelper.accessor('origin.product_id', {
            header: () => '品种 ID',
          }),
          columnHelper.accessor('origin.period_in_sec', {
            header: () => '周期 (s)',
          }),
          columnHelper.accessor('origin.cron_pattern', {
            header: () => 'Cron 模式',
          }),
          columnHelper.accessor('origin.cron_timezone', {
            header: () => 'Cron 时区',
          }),
          columnHelper.accessor('origin.replay_count', {
            header: () => '回溯数量',
          }),
          columnHelper.accessor('origin.disabled', {
            header: () => '禁用',
            cell: (ctx1) => (
              <Switch
                checked={!!ctx1.getValue()}
                onChange={(v) => {
                  const record = ctx1.row.original;
                  const next = getDataRecordWrapper('pull_source_relation')!({
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
      extraRecordActions={(ctx) => {
        return (
          <Button
            onClick={() =>
              executeCommand('Market', {
                datasource_id: ctx.record.origin.datasource_id,
                product_id: ctx.record.origin.product_id,
                period_in_sec: ctx.record.origin.period_in_sec,
              })
            }
          >
            行情
          </Button>
        );
      }}
    />
  );
});
