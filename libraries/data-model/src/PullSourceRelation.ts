import { addDataRecordSchema, addDataRecordWrapper } from './DataRecord';

declare module './DataRecord' {
  export interface IDataRecordTypes {
    pull_source_relation: IPullSourceRelation;
  }
}

/**
 * @public
 */
interface IPullSourceRelation {
  datasource_id: string;
  product_id: string;
  period_in_sec: number;
  /** Pattern of CronJob */
  cron_pattern: string;
  /** Timezone for CronJob evaluation */
  cron_timezone: string;
  /** disable this relation (false equivalent to not set before) */
  disabled?: boolean;
  /** default to 0, means start from the latest period, above 0 means pull start from earlier periods */
  replay_count?: number;
}

addDataRecordWrapper('pull_source_relation', (x) => ({
  id: `${x.datasource_id}\n${x.product_id}\n${x.period_in_sec}`,
  type: 'pull_source_relation',
  created_at: Date.now(),
  updated_at: Date.now(),
  frozen_at: null,
  tags: {},
  origin: x,
}));

addDataRecordSchema('pull_source_relation', {
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
});
