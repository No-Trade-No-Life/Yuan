import { Switch } from '@douyinfe/semi-ui';
import { createColumnHelper } from '@tanstack/react-table';
import { IDataRecord, IDataRecordTypes } from '@yuants/data-model';
import { DataRecordView } from '../DataRecord';
import { registerPage } from '../Pages';

type ICopyDataRelation = IDataRecordTypes['copy_data_relation'];

function newRecord(): Partial<ICopyDataRelation> {
  return {
    cron_pattern: '1 * * * *',
    cron_timezone: 'UTC',
  };
}

function defineColumns() {
  return () => {
    const columnHelper = createColumnHelper<IDataRecord<ICopyDataRelation>>();
    return [
      columnHelper.accessor('origin.series_id', {
        header: () => 'Series ID',
      }),
      columnHelper.accessor('origin.type', {
        header: () => '类型',
      }),
      columnHelper.accessor('origin.cron_pattern', {
        header: () => 'CronJob模式',
      }),
      columnHelper.accessor('origin.cron_timezone', {
        header: () => 'CronJob时区',
      }),
      columnHelper.accessor('origin.disabled', {
        header: () => '是否禁用',
        cell: (ctx) => (
          <Switch
            // onChange={(v) => {
            //   const next = mapOriginToDataRecord({ ...ctx.row.original.origin, disabled: v });
            //   terminal$
            //     .pipe(
            //       filter((x): x is Exclude<typeof x, null> => !!x),
            //       first(),
            //       mergeMap((terminal) => terminal.updateDataRecords([next])),
            //       tap({
            //         complete: () => {
            //           Toast.success(`成功更新数据记录 ${ctx.row.original.id}`);
            //         },
            //       }),
            //     )
            //     .subscribe();
            // }}
            disabled
            checked={!!ctx.getValue()}
          />
        ),
      }),
      columnHelper.accessor('origin.replay_count', {
        header: () => '回放个数',
      }),
    ];
  };
}

registerPage('CopyDataRelationList', () => {
  return <DataRecordView TYPE="copy_data_relation" columns={defineColumns()} newRecord={newRecord} />;
});
