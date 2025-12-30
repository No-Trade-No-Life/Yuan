// 解决 Backwards 拉取历史数据的调度器
// 该文件会定期扫描所有 Terminal 的 ServiceInfo，提取出所有支持 Backwards 拉取的序列。
// 然后对每个序列，向对应的 IngestOHLC Service 发送拉取请求，补齐历史数据。
// 使用 Token Bucket 控制每个数据源的请求速率，避免过载。

import { decodeOHLCSeriesId } from '@yuants/data-ohlc';
import { IIngestOHLCRequest, ISeriesIngestResult } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { decodePath, formatTime, tokenBucket } from '@yuants/utils';

const terminal = Terminal.fromNodeEnv();

const ingestCounter = terminal.metrics
  .counter('series_collector_ingest_count', '')
  .labels({ terminal_id: terminal.terminal_id, type: 'ohlc', task: 'backward' });

export const handleIngestOHLCBackward = async (
  series_id: string,
  direction: 'forward' | 'backward',
  signal: AbortSignal,
) => {
  const { product_id, duration } = decodeOHLCSeriesId(series_id);
  const [datasource_id] = decodePath(product_id);
  // 控制速率：每个数据源每秒钟只能请求一次
  await tokenBucket(`ohlc:backward:${datasource_id}`).acquire(1, signal);

  let req: IIngestOHLCRequest;
  if (direction === 'backward') {
    const [record] = await requestSQL<
      {
        start_time: string;
      }[]
    >(
      terminal,
      `select start_time from series_data_range where series_id = ${escapeSQL(
        series_id,
      )} and table_name = 'ohlc_v2' order by start_time limit 1`,
    );
    const start_time = record ? new Date(record.start_time).getTime() : Date.now();

    req = {
      product_id,
      duration,
      direction: 'backward',
      time: start_time,
    };
  } else {
    // forward
    req = {
      product_id,
      duration,
      direction,
      time: 0,
    };
  }

  console.info(
    formatTime(Date.now()),
    '[SeriesCollector][OHLC][Backward]',
    'Request',
    `product_id=${req.product_id}, duration=${req.duration}, direction=${req.direction}, time=${formatTime(
      req.time,
    )}`,
  );

  const res = await terminal.client.requestForResponseData<IIngestOHLCRequest, ISeriesIngestResult>(
    'IngestOHLC',
    req,
  );

  ingestCounter.inc(res.wrote_count || 0);

  console.info(
    formatTime(Date.now()),
    '[SeriesCollector][OHLC][Backward]',
    'Response',
    `series_id=${series_id}, ingested_count=${res.wrote_count}, start_time=${formatTime(
      res.range?.start_time ?? NaN,
    )}, end_time=${formatTime(res.range?.end_time ?? NaN)}`,
  );
};
