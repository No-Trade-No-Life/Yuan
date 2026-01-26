import { IIngestInterestRateRequest, ISeriesIngestResult } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { formatTime } from '@yuants/utils';
import { findPatchGap } from './sql-helpers';

const terminal = Terminal.fromNodeEnv();

const ingestCounter = terminal.metrics
  .counter('series_collector_ingest_count', '')
  .labels({ terminal_id: terminal.terminal_id, type: 'interest_rate', task: 'forward' });

// Patch 任务：查找数据缺口并进行补齐
export const handleInterestRatePatch = async (
  product_id: string,
  direction: 'forward' | 'backward',
  signal: AbortSignal,
) => {
  const record = await findPatchGap(terminal, 'interest_rate', product_id);

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

  if (direction === 'forward') {
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

  ingestCounter.inc(res.wrote_count || 0);

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
