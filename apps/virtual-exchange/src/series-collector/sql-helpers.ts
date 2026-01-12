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

export const findForwardTaskLastEndTime = (terminal: Terminal, series_id: string, table_name: string) =>
  requestSQL<
    {
      end_time: string;
    }[]
  >(
    terminal,
    `select end_time from series_data_range where series_id = ${escapeSQL(
      series_id,
    )} and table_name = ${escapeSQL(table_name)} order by end_time desc limit 1`,
  ).then((records) => records?.[0]?.end_time);

export const findPatchGap = async (
  terminal: Terminal,
  table_name: string,
  series_id: string,
): Promise<
  | {
      gap_start_time: string;
      gap_end_time: string;
    }
  | undefined
> => {
  const [record] = await requestSQL<{ gap_start_time: string; gap_end_time: string }[]>(
    terminal,
    `
WITH reversed_ranges AS (
    SELECT 
        start_time,
        end_time,
        LEAD(end_time) OVER (
            PARTITION BY table_name, series_id 
            ORDER BY start_time DESC
        ) AS next_end_time  -- 注意：倒序时 LEAD 是前一个区间
    FROM series_data_range
    WHERE table_name = ${escapeSQL(table_name)} 
      AND series_id = ${escapeSQL(series_id)}
)
SELECT 
    next_end_time AS gap_start_time,  -- 前一个区间的结束时间
    start_time AS gap_end_time        -- 当前区间的开始时间
FROM reversed_ranges
WHERE next_end_time IS NOT NULL 
  AND start_time > next_end_time      -- 有空缺
ORDER BY start_time DESC              -- 从最新开始
LIMIT 1;
    `,
  );

  return record;
};
