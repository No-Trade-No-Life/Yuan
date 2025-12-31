import { IIngestInterestRateRequest, ISeriesIngestResult } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { decodePath, formatTime, tokenBucket } from '@yuants/utils';
import { findInterestRateEndTimeForward } from './sql-helpers';

const terminal = Terminal.fromNodeEnv();

const ingestCounter = terminal.metrics
  .counter('series_collector_ingest_count', '')
  .labels({ terminal_id: terminal.terminal_id, type: 'interest_rate', task: 'forward' });

export const handleIngestInterestRateForward = async (
  product_id: string,
  direction: 'forward' | 'backward',
  signal: AbortSignal,
) => {
  const [datasource_id] = decodePath(product_id);
  // 控制速率：每个数据源每秒钟只能请求一次
  await tokenBucket(`interest_rate:forwards:${datasource_id}`).acquire(1, signal);

  {
    let req: IIngestInterestRateRequest;
    if (direction === 'forward') {
      const endTime = await findInterestRateEndTimeForward(terminal, product_id);
      const time = endTime ? new Date(endTime).getTime() : 0;

      req = {
        product_id: product_id,
        direction: 'forward',
        time,
      };
    } else {
      // backward
      req = {
        product_id,
        direction: 'backward',
        time: Date.now(),
      };
    }

    console.info(
      formatTime(Date.now()),
      '[SeriesCollector][InterestRate][Forward]',
      'Request',
      `product_id=${req.product_id}, direction=${req.direction}, time=${formatTime(req.time)}`,
    );
    const res = await terminal.client.requestForResponseData<IIngestInterestRateRequest, ISeriesIngestResult>(
      'IngestInterestRate',
      req,
    );

    ingestCounter.inc(res.wrote_count || 0);

    console.info(
      formatTime(Date.now()),
      '[SeriesCollector][InterestRate][Forward]',
      'Result',
      `series_id=${product_id}, ingested_count=${res.wrote_count}, start_time=${formatTime(
        res.range?.start_time ?? NaN,
      )}, end_time=${formatTime(res.range?.end_time ?? NaN)}`,
    );
  }
};
