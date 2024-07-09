import { Switch, Toast } from '@douyinfe/semi-ui';
import { createColumnHelper } from '@tanstack/react-table';
import { IDataRecord } from '@yuants/data-model';
import { writeDataRecords } from '@yuants/protocol';
import { JSONSchema7 } from 'json-schema';
import { filter, first, mergeMap, tap } from 'rxjs';
import { executeCommand } from '../CommandCenter';
import { DataRecordView } from '../DataRecord';
import { Button } from '../Interactive';
import { registerPage } from '../Pages';
import { terminal$ } from '../Terminals';

declare module '@yuants/protocol/lib/utils/DataRecord' {
  export interface IDataRecordTypes {
    pull_source_relation: IPullSourceRelation;
  }
}
interface IPullSourceRelation {
  datasource_id: string;
  product_id: string;
  period_in_sec: number;
  /** CronJob 模式: 定义拉取数据的时机 */
  cron_pattern: string;
  /** CronJob 的评估时区 */
  // 对于许多国际品种，使用 EET 时区配合工作日 Cron 比较好
  // 对于国内的品种，使用 CST 时区比较好
  // 例如 "0 * * * 1-5" (EET) 表示 EET 时区的工作日每小时的0分拉取数据。
  cron_timezone: string;
  /** disable this relation (equivalent to not set before) */
  disabled?: boolean;
  /** default to 0, means start from the latest period, above 0 means pull start from earlier periods */
  replay_count?: number;
}

const mapPullSourceRelationToDataRecord = (x: IPullSourceRelation): IDataRecord<IPullSourceRelation> => ({
  id: `${x.datasource_id}\n${x.product_id}\n${x.period_in_sec}`,
  type: 'pull_source_relation',
  created_at: Date.now(),
  updated_at: Date.now(),
  frozen_at: null,
  tags: {},
  origin: x,
});

const schema: JSONSchema7 = {
  type: 'object',
  title: '历史行情数据同步者配置',
  required: ['datasource_id', 'product_id', 'period_in_sec', 'cron_pattern', 'cron_timezone'],
  properties: {
    datasource_id: {
      type: 'string',
      title: '数据源 ID',
    },
    product_id: {
      type: 'string',
      title: '品种 ID',
    },
    period_in_sec: {
      type: 'number',
      title: '周期 (秒)',
    },
    cron_pattern: {
      type: 'string',
      title: 'CronJob 模式: 定义拉取数据的时机',
    },
    cron_timezone: {
      type: 'string',
      title: 'CronJob 的评估时区',
    },
    replay_count: {
      type: 'number',
      title: 'Replay Count',
    },
    disabled: {
      type: 'boolean',
      title: '是否禁用',
    },
  },
};
registerPage('PullSourceRelationList', () => {
  return (
    <DataRecordView
      TYPE="pull_source_relation"
      columns={(ctx) => {
        const columnHelper = createColumnHelper<IDataRecord<IPullSourceRelation>>();
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
                  const next = mapPullSourceRelationToDataRecord({ ...record.origin, disabled: v });
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
      mapOriginToDataRecord={mapPullSourceRelationToDataRecord}
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
      schema={schema}
    />
  );
});
