import {
  IIngestInterestRateRequest,
  IInterestRateServiceMetadata,
  ISeriesIngestResult,
} from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { decodePath, formatTime, tokenBucket } from '@yuants/utils';

const terminal = Terminal.fromNodeEnv();

// Patch 任务：查找数据缺口并进行补齐
export const handleInterestRatePatch = async (
  product_id: string,
  meta: IInterestRateServiceMetadata,
  signal: AbortSignal,
) => {
  const [datasource_id] = decodePath(product_id);
  await tokenBucket(`interest_rate:patch:${datasource_id}`).acquire(1, signal);
  const [record] = await requestSQL<{ gap_start_time: string; gap_end_time: string }[]>(
    terminal,
    `
    WITH ordered_ranges AS (
        SELECT 
            start_time,
            end_time,
            LAG(end_time) OVER (
                PARTITION BY table_name, series_id 
                ORDER BY start_time
            ) AS prev_end_time
        FROM series_data_range
        WHERE table_name = 'interest_rate'
        AND series_id = ${escapeSQL(product_id)}
    )

    SELECT 
        prev_end_time AS gap_start_time,
        start_time AS gap_end_time
    FROM ordered_ranges
    WHERE prev_end_time IS NOT NULL 
    AND start_time > prev_end_time
    ORDER BY start_time
    LIMIT 1;
    `,
  );

  // no gap
  if (!record) return;

  const gapStartTime = new Date(record.gap_start_time).getTime();
  const gapEndTime = new Date(record.gap_end_time).getTime();

  console.info(
    formatTime(Date.now()),
    '[SeriesCollector][InterestRate][Patch]',
    'FindGap',
    `series=${product_id}, from=${formatTime(gapStartTime)}, to=${formatTime(gapEndTime)}`,
  );

  let req: IIngestInterestRateRequest;

  if (meta.direction === 'forward') {
    // forward patch
    req = {
      product_id: product_id,
      direction: 'forward' as const,
      time: gapStartTime,
    };
  } else {
    // backward patch
    req = {
      product_id: product_id,
      direction: 'backward' as const,
      time: gapEndTime,
    };
  }

  console.info(
    formatTime(Date.now()),
    '[SeriesCollector][InterestRate][Patch]',
    product_id,
    'PatchRequest',
    `direction=${req.direction}, time=${formatTime(req.time)}`,
  );

  const res = await terminal.client.requestForResponseData<IIngestInterestRateRequest, ISeriesIngestResult>(
    'IngestInterestRate',
    req,
  );

  console.info(
    formatTime(Date.now()),
    '[SeriesCollector][InterestRate][Patch]',
    product_id,
    'PatchBackwardResult',
    `ingested_count=${res.wrote_count}, start_time=${formatTime(
      res.range?.start_time ?? NaN,
    )}, end_time=${formatTime(res.range?.end_time ?? NaN)}`,
  );
};
