import { IconCopyAdd, IconDelete, IconEdit, IconRefresh, IconSearch } from '@douyinfe/semi-icons';
import { Button, Popconfirm, Space, Switch, Table, Toast } from '@douyinfe/semi-ui';
import { StockMarket } from '@icon-park/react';
import { IDataRecord } from '@yuants/protocol';
import { JSONSchema7 } from 'json-schema';
import { useObservable, useObservableState } from 'observable-hooks';
import { useState } from 'react';
import { EMPTY, combineLatest, filter, first, mergeMap, tap, toArray } from 'rxjs';
import { executeCommand } from '../CommandCenter';
import { showForm } from '../Form';
import { registerPage } from '../Pages';
import { terminal$ } from '../Terminals';

// TODO: Import
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
  const [refreshId, setRefreshId] = useState(0);

  const [searchFormData, setSearchFormData] = useState({} as IPullSourceRelation);

  const records$ = useObservable(
    (input$) =>
      combineLatest([terminal$, input$]).pipe(
        //
        mergeMap(([terminal, [searchFormData]]) =>
          (
            terminal?.queryDataRecords<IPullSourceRelation>({
              type: 'pull_source_relation',
              tags: {},
              options: {
                sort: [
                  ['origin.datasource_id', 1],
                  ['origin.product_id', 1],
                  ['origin.period_in_sec', 1],
                ],
              },
            }) ?? EMPTY
          ).pipe(
            filter(
              (record) =>
                !searchFormData.datasource_id || record.origin.datasource_id === searchFormData.datasource_id,
            ),
            filter(
              (record) =>
                !searchFormData.product_id || record.origin.product_id === searchFormData.product_id,
            ),
            filter(
              (record) =>
                !searchFormData.period_in_sec || record.origin.period_in_sec === searchFormData.period_in_sec,
            ),
            //
            toArray(),
          ),
        ),
      ),
    [searchFormData, refreshId],
  );

  const records = useObservableState(records$);
  const updateData = (formData: IPullSourceRelation) => {
    const record = mapPullSourceRelationToDataRecord(formData);
    terminal$
      .pipe(
        filter((x): x is Exclude<typeof x, null> => !!x),
        first(),
        mergeMap((terminal) => terminal.updateDataRecords([record])),
        tap({
          complete: () => {
            Toast.success(`成功更新数据记录 ${record.id}`);
            setRefreshId((x) => x + 1);
          },
        }),
      )
      .subscribe();
  };

  return (
    <Space vertical align="start" style={{ width: '100%' }}>
      <Space>
        <Button
          icon={<IconSearch />}
          onClick={async () => {
            const data = await showForm<IPullSourceRelation>(schema, searchFormData);
            setSearchFormData(data);
          }}
        >
          搜索
        </Button>
        <Button
          icon={<IconCopyAdd />}
          onClick={async () => {
            const data = await showForm<IPullSourceRelation>(schema, {});
            updateData(data);
          }}
        >
          添加
        </Button>
        <Button
          icon={<IconRefresh />}
          onClick={() => {
            setRefreshId((x) => x + 1);
            Toast.success('已刷新');
          }}
        >
          刷新
        </Button>
      </Space>
      <Table
        dataSource={records}
        style={{ width: '100%' }}
        columns={[
          //
          { title: '数据源 ID', render: (_, record) => record.origin.datasource_id },
          { title: '品种 ID', render: (_, record) => record.origin.product_id },
          { title: '周期 (s)', render: (_, record) => record.origin.period_in_sec },
          { title: 'Cron 模式', render: (_, record) => record.origin.cron_pattern },
          { title: 'Cron 时区', render: (_, record) => record.origin.cron_timezone },
          { title: '回溯数量', render: (_, record) => record.origin.replay_count ?? 0 },
          {
            title: '禁用',
            render: (_, record) => (
              <Switch
                onChange={(v) => {
                  const next = mapPullSourceRelationToDataRecord({ ...record.origin, disabled: v });
                  terminal$
                    .pipe(
                      filter((x): x is Exclude<typeof x, null> => !!x),
                      first(),
                      mergeMap((terminal) => terminal.updateDataRecords([next])),
                      tap({
                        complete: () => {
                          Toast.success(`成功更新数据记录 ${record.id}`);
                          setRefreshId((x) => x + 1);
                        },
                      }),
                    )
                    .subscribe();
                }}
                checked={!!record.origin.disabled}
              />
            ),
          },
          {
            title: '操作',
            render: (_, record) => (
              <Space>
                <Button
                  icon={<StockMarket />}
                  onClick={() => {
                    executeCommand('Market', {
                      datasource_id: record.origin.datasource_id,
                      product_id: record.origin.product_id,
                      period_in_sec: record.origin.period_in_sec,
                    });
                  }}
                ></Button>
                <Button
                  icon={<IconEdit />}
                  onClick={async () => {
                    const data = await showForm<IPullSourceRelation>(schema, record.origin);
                    updateData(data);
                  }}
                ></Button>

                <Popconfirm
                  style={{ width: 300 }}
                  title="确定是否删除？"
                  content="此操作将不可逆"
                  onConfirm={() => {
                    terminal$
                      .pipe(
                        //
                        filter((x): x is Exclude<typeof x, null> => !!x),
                        first(),
                        mergeMap((terminal) =>
                          terminal.removeDataRecords({
                            type: 'pull_source_relation',
                            id: record.id,
                          }),
                        ),
                        tap({
                          complete: () => {
                            Toast.success(`成功删除数据记录 ${record.id}`);
                            setRefreshId((x) => x + 1);
                          },
                        }),
                      )
                      .subscribe();
                  }}
                >
                  <Button icon={<IconDelete />} type="danger"></Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      ></Table>
    </Space>
  );
});
