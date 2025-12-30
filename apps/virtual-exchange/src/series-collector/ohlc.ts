import { formatTime, listWatch } from '@yuants/utils';
import { defer, map, Observable, repeat, retry, tap } from 'rxjs';
import { handleIngestInterestRateBackward } from './backwards-interest-rate';
import { listOHLCSeriesIds } from './discovery';
import { handleIngestInterestRateForward } from './forwards-interest-rate';
import { handleInterestRatePatch } from './patch-interest-rate';
import { handleIngestOHLCForward } from './forwards-ohlc';
import { handleIngestOHLCBackward } from './backwards-ohlc';
import { handleOHLCPatch } from './patch-ohlc';

defer(() => listOHLCSeriesIds())
  .pipe(
    retry({ delay: 1000 }),
    repeat({ delay: 60000 }),
    map((x) => Array.from(x.entries())),
    listWatch(
      (x) => x[0],
      ([product_id, direction]) =>
        new Observable((sub) => {
          // 处理每个利率品种任务: (forward / backward / patch)，都需要独立调度
          const abortController = new AbortController();

          sub.add(() => {
            abortController.abort();
          });

          // 先处理前向任务
          const forwardTask = defer(async () => {
            await handleIngestOHLCForward(product_id, direction, abortController.signal);
          })
            .pipe(
              tap({
                error: (err) =>
                  console.info(formatTime(Date.now()), `[SeriesCollector][OHLC][Forward]`, 'Error', err),
              }),

              retry(),
              repeat(),
            )
            .subscribe();

          sub.add(() => {
            forwardTask.unsubscribe();
          });

          // 设置后向任务
          const backwardTask = defer(async () => {
            await handleIngestOHLCBackward(product_id, direction, abortController.signal);
          })
            .pipe(
              tap({
                error: (err) =>
                  console.info(formatTime(Date.now()), `[SeriesCollector][OHLC][Backward]`, 'Error', err),
              }),
              retry(),
              repeat(),
            )
            .subscribe();

          sub.add(() => {
            backwardTask.unsubscribe();
          });

          // 设置补齐任务
          const patchTask = defer(async () => {
            await handleOHLCPatch(product_id, direction, abortController.signal);
          })
            .pipe(
              tap({
                error: (err) =>
                  console.info(formatTime(Date.now()), `[SeriesCollector][OHLC][Patch]`, 'Error', err),
              }),
              retry(),
              repeat(),
            )
            .subscribe();

          sub.add(() => {
            patchTask.unsubscribe();
          });
        }),
    ),
  )
  .subscribe();
