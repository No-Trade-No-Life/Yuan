import { listWatch } from '@yuants/utils';
import { defer, map, Observable, repeat, retry } from 'rxjs';
import { handleIngestInterestRateBackward } from './backwards-interest-rate';
import { listInterestRateSeriesIds } from './discovery';
import { handleIngestInterestRateForward } from './forwards-interest-rate';
import { handleInterestRatePatch } from './patch-interest-rate';

defer(() => listInterestRateSeriesIds())
  .pipe(
    retry({ delay: 1000 }),
    repeat({ delay: 60000 }),
    map((x) => Array.from(x.entries())),
    listWatch(
      (x) => x[0],
      ([product_id, meta]) =>
        new Observable((sub) => {
          // 处理每个利率品种任务: (forward / backward / patch)，都需要独立调度
          const abortController = new AbortController();

          sub.add(() => {
            abortController.abort();
          });

          // 先处理前向任务
          const forwardTask = defer(async () => {
            await handleIngestInterestRateForward(product_id, meta, abortController.signal);
          })
            .pipe(retry(), repeat())
            .subscribe();

          sub.add(() => {
            forwardTask.unsubscribe();
          });

          // 设置后向任务
          const backwardTask = defer(async () => {
            await handleIngestInterestRateBackward(product_id, meta, abortController.signal);
          })
            .pipe(retry(), repeat())
            .subscribe();

          sub.add(() => {
            backwardTask.unsubscribe();
          });

          // 设置补齐任务
          const patchTask = defer(async () => {
            await handleInterestRatePatch(product_id, meta, abortController.signal);
          })
            .pipe(retry(), repeat())
            .subscribe();

          sub.add(() => {
            patchTask.unsubscribe();
          });
        }),
    ),
  )
  .subscribe();
