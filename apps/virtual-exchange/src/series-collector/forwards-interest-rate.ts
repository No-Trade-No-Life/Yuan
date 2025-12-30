// 解决 Forwards 拉取历史数据的调度器
// 该文件会定期扫描所有 Terminal 的 ServiceInfo，提取出所有支持 Forwards 拉取的序列。
// 然后对每个序列，向对应的 IngestInterestRate Service 发送拉取请求，补齐历史数据。
// 使用 Token Bucket 控制每个数据源的请求速率，避免过载。

import {
  IIngestInterestRateRequest,
  IInterestRateServiceMetadata,
  ISeriesIngestResult,
  parseInterestRateServiceMetadataFromSchema,
} from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { decodePath, formatTime, tokenBucket } from '@yuants/utils';
import { defer, repeat, retry } from 'rxjs';

const terminal = Terminal.fromNodeEnv();

const listBackwardSeriesIds = async () => {
  const product_ids = await requestSQL<{ product_id: string }[]>(terminal, `select product_id from product`);

  console.time('[SeriesCollector][InterestRate][Forwards] calc');

  const series_ids = new Map<string, IInterestRateServiceMetadata>();
  for (const terminalInfo of terminal.terminalInfos) {
    for (const serviceInfo of Object.values(terminalInfo.serviceInfo || {})) {
      if (serviceInfo.method !== 'IngestInterestRate') continue;
      try {
        const meta = parseInterestRateServiceMetadataFromSchema(serviceInfo.schema);

        for (const { product_id } of product_ids) {
          if (!product_id.startsWith(meta.product_id_prefix)) continue;
          series_ids.set(product_id, meta);
        }
      } finally {
      }
    }
  }

  console.timeEnd('[SeriesCollector][InterestRate][Forwards] calc');

  return series_ids;
};

defer(async () => {
  const series_ids = await listBackwardSeriesIds();
  console.log(
    `[SeriesCollector][InterestRate][Forwards] Found ${series_ids.size} series to collect forwards data for. `,
  );

  await Promise.all(
    [...series_ids].map(async ([product_id, meta]) => {
      try {
        const [datasource_id] = decodePath(product_id);
        // 控制速率：每个数据源每秒钟只能请求一次
        await tokenBucket(`interest_rate_forwards:${datasource_id}`, {
          refillInterval: 1000,
          capacity: 1,
        }).acquire();
        {
          let req: IIngestInterestRateRequest;
          if (meta.direction === 'forward') {
            const [record] = await requestSQL<
              {
                end_time: string;
              }[]
            >(
              terminal,
              `select end_time from series_data_range where series_id = ${escapeSQL(
                product_id,
              )} and table_name = 'interest_rate' order by end_time desc limit 1`,
            );
            const time = record ? new Date(record.end_time).getTime() : 0;

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
            'DispatchIngestInterestRateRequestForwardTask',
            `product_id=${req.product_id}, direction=${req.direction}, time=${formatTime(req.time)}`,
          );
          const res = await terminal.client.requestForResponseData<
            IIngestInterestRateRequest,
            ISeriesIngestResult
          >('IngestInterestRate', req);

          terminal.metrics
            .counter('series_collector_forwards_ingest_count', '')
            .labels({ terminal_id: terminal.terminal_id, type: 'interest_rate' })
            .inc(res.wrote_count || 0);

          console.info(
            formatTime(Date.now()),
            'DispatchIngestInterestRateRequestForwardTaskResult',
            `series_id=${product_id}, ingested_count=${res.wrote_count}, start_time=${formatTime(
              res.range?.start_time ?? NaN,
            )}, end_time=${formatTime(res.range?.end_time ?? NaN)}`,
          );
        }
      } catch (e) {
        console.info(
          formatTime(Date.now()),
          'DispatchIngestInterestRateErrorForwards',
          `series_id=${product_id}`,
          e,
        );
      }
    }),
  );
})
  .pipe(retry({ delay: 1000 }), repeat({ delay: 1000 }))
  .subscribe();
