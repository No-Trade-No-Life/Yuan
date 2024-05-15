import { JSONSchema7 } from 'json-schema';

/**
 * ICopyDataRelation represents the data copy relation, will be updated by both side during the copy process
 *
 * ICopyDataRelation 表示数据复制关系，将在复制过程中双方更新
 */
export interface ICopyDataRelation {
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

export const schema: JSONSchema7 = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
    },
    series_id: {
      type: 'string',
    },
    cron_pattern: {
      type: 'string',
    },
    cron_timezone: {
      type: 'string',
    },
    disabled: {
      type: 'boolean',
    },
    replay_count: {
      type: 'number',
    },
  },
};
