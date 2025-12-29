import { Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { decodePath, formatTime } from '@yuants/utils';
import { encodeOHLCSeriesId } from './series_id';
import { IOHLC } from './types';

/**
 * 向未来方向 (Forward) 加载 OHLC 数据，加载给定开始时间之后的数据
 * @public
 */
export const loadOHLCForward = async (
  terminal: Terminal,
  ctx: {
    product_id: string;
    duration: string;
    start_time: number;
    limit?: number;
  },
): Promise<IOHLC[]> => {
  const { product_id, duration, start_time, limit } = ctx;
  const [datasource_id] = decodePath(product_id);
  const series_id = encodeOHLCSeriesId(product_id, duration);
  const sql = `select * from ohlc_v2 where series_id = ${escapeSQL(series_id)} and created_at >= ${escapeSQL(
    formatTime(start_time),
  )} order by created_at ${limit !== undefined ? `limit ${+limit}` : ''}`;
  const res = await requestSQL<Array<Omit<IOHLC, 'datasource_id' | 'product_id' | 'duration'>>>(
    terminal,
    sql,
  );
  return res.map((row) => ({
    ...row,
    datasource_id,
    product_id,
    duration,
  }));
};

/**
 * 向过去方向 (Backward) 加载 OHLC 数据，加载给定结束时间之前的数据
 * @public
 */
export const loadOHLCBackward = async (
  terminal: Terminal,
  ctx: {
    product_id: string;
    duration: string;
    end_time: number;
    limit?: number;
  },
): Promise<IOHLC[]> => {
  const { product_id, duration, end_time, limit } = ctx;
  const [datasource_id] = decodePath(product_id);
  const series_id = encodeOHLCSeriesId(product_id, duration);
  const sql = `select * from ohlc_v2 where series_id = ${escapeSQL(series_id)} and created_at <= ${escapeSQL(
    formatTime(end_time),
  )} order by created_at desc ${limit !== undefined ? `limit ${+limit}` : ''}`;
  const res = await requestSQL<Array<Omit<IOHLC, 'datasource_id' | 'product_id' | 'duration'>>>(
    terminal,
    sql,
  );
  return res.map((row) => ({
    ...row,
    datasource_id,
    product_id,
    duration,
  }));
};

/**
 * 列出所有存在 OHLC 数据的 series_id 列表
 *
 * @public
 */
export const listOHLCSeriesIds = async (
  terminal: Terminal,
  ctx: {
    series_id_pattern?: string;
    limit?: number;
  },
): Promise<string[]> => {
  const { series_id_pattern } = ctx;
  const records = await requestSQL<{ series_id: string }[]>(
    terminal,
    `select distinct series_id from series_data_range where table_name = 'ohlc_v2' ${
      ctx.series_id_pattern ? `and series_id ~ ${escapeSQL(series_id_pattern)}` : ''
    } order by series_id ${ctx.limit ? `limit ${+ctx.limit}` : ''}`,
  );
  return records.map((r) => r.series_id);
};
