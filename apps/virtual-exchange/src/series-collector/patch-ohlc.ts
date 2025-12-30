import { decodeOHLCSeriesId } from '@yuants/data-ohlc';
import { IIngestOHLCRequest, ISeriesIngestResult } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { decodePath, formatTime, tokenBucket } from '@yuants/utils';

const terminal = Terminal.fromNodeEnv();

const ingestCounter = terminal.metrics
  .counter('series_collector_ingest_count', '')
  .labels({ terminal_id: terminal.terminal_id, type: 'ohlc', task: 'forward' });

// Patch 任务：查找数据缺口并进行补齐
export const handleOHLCPatch = async (
  series_id: string,
  direction: 'forward' | 'backward',
  signal: AbortSignal,
) => {
  const [datasource_id] = decodePath(series_id);
  await tokenBucket(`ohlc:patch:${datasource_id}`).acquire(1, signal);
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
    WHERE table_name = 'ohlc_v2' 
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

  // no gap
  if (!record) return;

  const gapStartTime = new Date(record.gap_start_time).getTime();
  const gapEndTime = new Date(record.gap_end_time).getTime();

  console.info(
    formatTime(Date.now()),
    '[SeriesCollector][OHLC][Patch]',
    'FindGap',
    `series=${series_id}, from=${formatTime(gapStartTime)}, to=${formatTime(gapEndTime)}`,
  );

  const { product_id, duration } = decodeOHLCSeriesId(series_id);

  let req: IIngestOHLCRequest;

  if (direction === 'forward') {
    // forward patch
    req = {
      product_id: product_id,
      duration,
      direction: 'forward' as const,
      time: gapStartTime,
    };
  } else {
    // backward patch
    req = {
      product_id: product_id,
      duration,
      direction: 'backward' as const,
      time: gapEndTime,
    };
  }

  console.info(
    formatTime(Date.now()),
    '[SeriesCollector][OHLC][Patch]',
    series_id,
    'PatchRequest',
    `direction=${req.direction}, time=${formatTime(req.time)}`,
  );

  const res = await terminal.client.requestForResponseData<IIngestOHLCRequest, ISeriesIngestResult>(
    'IngestOHLC',
    req,
  );

  ingestCounter.inc(res.wrote_count || 0);

  console.info(
    formatTime(Date.now()),
    '[SeriesCollector][OHLC][Patch]',
    series_id,
    'PatchBackwardResult',
    `ingested_count=${res.wrote_count}, start_time=${formatTime(
      res.range?.start_time ?? NaN,
    )}, end_time=${formatTime(res.range?.end_time ?? NaN)}`,
  );
};
