import { Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';

/**
 * 查找某个利率品种系列ID的最新结束时间（for forward task）
 * @param terminal
 * @param product_id
 * @returns
 */
export const findInterestRateEndTimeForward = (terminal: Terminal, product_id: string) =>
  requestSQL<
    {
      end_time: string;
    }[]
  >(
    terminal,
    `select end_time from series_data_range where series_id = ${escapeSQL(
      product_id,
    )} and table_name = 'interest_rate' order by end_time desc limit 1`,
  ).then((records) => records?.[0]?.end_time);

export const findInterestRateStartTimeBackward = (terminal: Terminal, product_id: string) =>
  requestSQL<
    {
      start_time: string;
    }[]
  >(
    terminal,
    `select start_time from series_data_range where series_id = ${escapeSQL(
      product_id,
    )} and table_name = 'interest_rate' order by start_time asc limit 1`,
  ).then((records) => records?.[0]?.start_time);

export const findOHLCEndTimeForward = (terminal: Terminal, series_id: string) =>
  requestSQL<
    {
      end_time: string;
    }[]
  >(
    terminal,
    `select end_time from series_data_range where series_id = ${escapeSQL(
      series_id,
    )} and table_name = 'ohlc_v2' order by end_time desc limit 1`,
  ).then((records) => records?.[0]?.end_time);
