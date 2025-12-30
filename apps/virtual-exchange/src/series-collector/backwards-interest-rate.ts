// 解决 Backwards 拉取历史数据的调度器
// 该文件会定期扫描所有 Terminal 的 ServiceInfo，提取出所有支持 Backwards 拉取的序列。
// 然后对每个序列，向对应的 IngestInterestRate Service 发送拉取请求，补齐历史数据。
// 使用 Token Bucket 控制每个数据源的请求速率，避免过载。

import {
  IIngestInterestRateRequest,
  IInterestRateServiceMetadata,
  ISeriesIngestResult,
} from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { decodePath, formatTime, tokenBucket } from '@yuants/utils';
import { findInterestRateStartTimeBackward } from './sql-helpers';

const terminal = Terminal.fromNodeEnv();

export const handleIngestInterestRateBackward = async (
  product_id: string,
  meta: IInterestRateServiceMetadata,
  signal: AbortSignal,
) => {
  const [datasource_id] = decodePath(product_id);
  // 控制速率：每个数据源每秒钟只能请求一次
  await tokenBucket(`interest_rate:backward:${datasource_id}`).acquire(1, signal);
  let req: IIngestInterestRateRequest;
  if (meta.direction === 'backward') {
    const startTime = await findInterestRateStartTimeBackward(terminal, product_id);
    const start_time = startTime ? new Date(startTime).getTime() : Date.now();

    req = {
      product_id: product_id,
      direction: 'backward',
      time: start_time,
    };
  } else {
    req = {
      product_id: product_id,
      direction: 'forward',
      time: 0,
    };
  }

  console.info(
    formatTime(Date.now()),
    '[SeriesCollector][InterestRate][Backward]',
    'Request',
    `product_id=${req.product_id}, direction=${req.direction}, time=${formatTime(req.time)}`,
  );

  const res = await terminal.client.requestForResponseData<IIngestInterestRateRequest, ISeriesIngestResult>(
    'IngestInterestRate',
    req,
  );

  terminal.metrics
    .counter('series_collector_ingest_count', '')
    .labels({ terminal_id: terminal.terminal_id, type: 'interest_rate', task: 'backward' })
    .inc(res.wrote_count || 0);

  console.info(
    formatTime(Date.now()),
    '[SeriesCollector][InterestRate][Backward]',
    'Result',
    `series_id=${product_id}, ingested_count=${res.wrote_count}, start_time=${formatTime(
      res.range?.start_time ?? NaN,
    )}, end_time=${formatTime(res.range?.end_time ?? NaN)}`,
  );
};
