// 解决 Forwards 拉取历史数据的调度器
// 该文件会定期扫描所有 Terminal 的 ServiceInfo，提取出所有支持 Forwards 拉取的序列。
// 然后对每个序列，向对应的 IngestOHLC Service 发送拉取请求，补齐历史数据。
// 使用 Token Bucket 控制每个数据源的请求速率，避免过载。

import { decodeOHLCSeriesId } from '@yuants/data-ohlc';
import { IIngestOHLCRequest, ISeriesIngestResult } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { formatTime } from '@yuants/utils';

const terminal = Terminal.fromNodeEnv();

const ingestCounter = terminal.metrics
  .counter('series_collector_ingest_count', '')
  .labels({ terminal_id: terminal.terminal_id, type: 'ohlc', task: 'forward' });

export const handleIngestOHLCForward = async (
  series_id: string,
  direction: 'forward' | 'backward',
  signal: AbortSignal,
) => {
  const { product_id, duration } = decodeOHLCSeriesId(series_id);
  let req: IIngestOHLCRequest;
  if (direction === 'forward') {
    const [record] = await requestSQL<
      {
        end_time: string;
      }[]
    >(
      terminal,
      `select end_time from series_data_range where series_id = ${escapeSQL(
        series_id,
      )} and table_name = 'ohlc_v2' order by end_time desc limit 1`,
    );

    const time = record ? new Date(record.end_time).getTime() : 0;

    req = {
      product_id,
      duration,
      direction: 'forward',
      time,
    };
  } else {
    // backward
    req = {
      product_id,
      duration,
      direction,
      time: Date.now(),
    };
  }

  console.info(
    formatTime(Date.now()),
    '[SeriesCollector][OHLC][Forward]',
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
    '[SeriesCollector][OHLC][Forward]',
    'Response',
    `series_id=${series_id}, ingested_count=${res.wrote_count}, start_time=${formatTime(
      res.range?.start_time ?? NaN,
    )}, end_time=${formatTime(res.range?.end_time ?? NaN)}`,
  );
};
