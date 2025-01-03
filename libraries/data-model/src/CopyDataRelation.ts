import { IDataRecord, addDataRecordSchema, addDataRecordWrapper } from './DataRecord';

declare module './DataRecord' {
  export interface IDataRecordTypes {
    copy_data_relation: ICopyDataRelation;
  }
}

/**
 * ICopyDataRelation represents the data copy relation, will be updated by both side during the copy process
 *
 * ICopyDataRelation 表示数据复制关系，将在复制过程中双方更新
 */
interface ICopyDataRelation {
  /** Type of the Data record to collect */
  type: string;
  /** series id is a path to identify a data series */
  series_id: string;
  /** Pattern of CronJob */
  cron_pattern: string;
  /** Timezone for CronJob evaluation */
  cron_timezone: string;
  /** disable this relation (false equivalent to not set before) */
  disabled?: boolean;
  /** default to 0, means start from the latest data record, above 0 means pull start from earlier data records */
  replay_count?: number;
}

addDataRecordWrapper('copy_data_relation', (x: ICopyDataRelation): IDataRecord<ICopyDataRelation> => {
  const id = x.series_id;
  return {
    id,
    type: 'copy_data_relation',
    created_at: Date.now(),
    updated_at: Date.now(),
    frozen_at: null,
    tags: {},
    origin: x,
  };
});

addDataRecordSchema('copy_data_relation', {
  type: 'object',
  title: 'Data Collector Copy Data Relation',
  required: ['type', 'series_id', 'cron_pattern', 'cron_timezone'],
  properties: {
    type: {
      type: 'string',
      title: 'Type of Data Record',
    },
    series_id: {
      type: 'string',
      title: 'Series ID',
    },
    cron_pattern: {
      type: 'string',
      title: 'Pattern of CronJob: when to pull data',
    },
    cron_timezone: {
      type: 'string',
      title: 'Timezone of CronJob',
    },
    replay_count: {
      type: 'number',
      title: 'Replay Count',
    },
    disabled: {
      type: 'boolean',
      title: 'Disable this relation',
    },
  },
});
