// 解决 Forwards 拉取历史数据的调度器
// 该文件会定期扫描所有 Terminal 的 ServiceInfo，提取出所有支持 Forwards 拉取的序列。
// 然后对每个序列，向对应的 IngestOHLC Service 发送拉取请求，补齐历史数据。
// 使用 Token Bucket 控制每个数据源的请求速率，避免过载。

import { decodeOHLCSeriesId, encodeOHLCSeriesId } from '@yuants/data-ohlc';
import {
  IIngestOHLCRequest,
  ISeriesIngestResult,
  parseOHLCServiceMetadataFromSchema,
} from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { decodePath, formatTime, tokenBucket } from '@yuants/utils';
import { defer, repeat, retry } from 'rxjs';

const terminal = Terminal.fromNodeEnv();

const listForwardSeriesIds = async () => {
  const product_ids = await requestSQL<{ product_id: string }[]>(terminal, `select product_id from product`);

  console.time('[SeriesCollector][OHLC][Forwards] calc');

  const series_ids = new Set<string>();
  for (const terminalInfo of terminal.terminalInfos) {
    for (const serviceInfo of Object.values(terminalInfo.serviceInfo || {})) {
      if (serviceInfo.method !== 'IngestOHLC') continue;
      try {
        const meta = parseOHLCServiceMetadataFromSchema(serviceInfo.schema);
        if (meta.direction !== 'forward') continue;

        for (const { product_id } of product_ids) {
          if (!product_id.startsWith(meta.product_id_prefix)) continue;
          for (const duration of meta.duration_list) {
            const series_id = encodeOHLCSeriesId(product_id, duration);
            series_ids.add(series_id);
          }
        }
      } finally {
      }
    }
  }

  console.timeEnd('[SeriesCollector][OHLC][Forwards] calc');

  return series_ids;
};

defer(async () => {
  const time = Date.now();
  const series_ids = await listForwardSeriesIds();
  console.log(
    `[SeriesCollector][OHLC][Forwards] Found ${
      series_ids.size
    } series to collect forwards data for. (${formatTime(Date.now() - time)})`,
  );

  await Promise.all(
    [...series_ids].map(async (series_id) => {
      try {
        const { product_id, duration } = decodeOHLCSeriesId(series_id);
        const [datasource_id] = decodePath(product_id);
        // 控制速率：每个数据源每秒钟只能请求一次
        await tokenBucket(`ohlc_forwards_target_${datasource_id}`, {
          refillInterval: 1000,
          capacity: 1,
        }).acquire();
        {
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

          const req: IIngestOHLCRequest = {
            product_id,
            duration,
            direction: 'forward',
            time,
          };

          console.info(
            formatTime(Date.now()),
            'DispatchIngestOHLC_Forwards',
            `product_id=${product_id}, duration=${duration}, time=${formatTime(time)}`,
          );

          const res = await terminal.client.requestForResponseData<IIngestOHLCRequest, ISeriesIngestResult>(
            'IngestOHLC',
            req,
          );

          terminal.metrics
            .counter('series_collector_forwards_ingest_count', '')
            .labels({ terminal_id: terminal.terminal_id, type: 'ohlc' })
            .inc(res.wrote_count || 0);

          console.info(
            formatTime(Date.now()),
            'DispatchIngestOHLCResult_Forwards',
            `series_id=${series_id}, ingested_count=${res.wrote_count}, start_time=${formatTime(
              res.range?.start_time ?? NaN,
            )}, end_time=${formatTime(res.range?.end_time ?? NaN)}`,
          );
        }
      } catch (e) {
        console.info(formatTime(Date.now()), 'DispatchIngestOHLCError_Forwards', `series_id=${series_id}`, e);
      }
    }),
  );
})
  .pipe(retry({ delay: 1000 }), repeat({ delay: 1000 }))
  .subscribe();
