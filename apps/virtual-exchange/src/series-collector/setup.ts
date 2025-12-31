import { formatTime, tokenBucket } from '@yuants/utils';
import { handleIngestInterestRateBackward } from './backwards-interest-rate';
import { handleIngestOHLCBackward } from './backwards-ohlc';
import { listInterestRateSeriesIds, listOHLCSeriesIds } from './discovery';
import { handleIngestInterestRateForward } from './forwards-interest-rate';
import { handleIngestOHLCForward } from './forwards-ohlc';
import { handleInterestRatePatch } from './patch-interest-rate';
import { handleIngestOHLCPatch } from './patch-ohlc';

const api = {
  OHLC: {
    list: listOHLCSeriesIds,
    forward: handleIngestOHLCForward,
    backward: handleIngestOHLCBackward,
    patch: handleIngestOHLCPatch,
  },
  InterestRate: {
    list: listInterestRateSeriesIds,
    forward: handleIngestInterestRateForward,
    backward: handleIngestInterestRateBackward,
    patch: handleInterestRatePatch,
  },
};

(async () => {
  const abortController = new AbortController();
  const signal = abortController.signal;
  for (const type of ['OHLC', 'InterestRate'] as const) {
    const list = api[type].list;
    for (const task of ['forward', 'backward', 'patch'] as const) {
      const handler = api[type][task];
      (async () => {
        while (true) {
          await tokenBucket(`${type}:${task}`).acquire(1, signal);
          try {
            const tasks = await list();
            // 并行
            // await Promise.all(
            //   Array.from(tasks.entries()).map(([series_id, direction]) =>
            //     handler(series_id, direction, signal).catch((err) => {
            //       console.info(formatTime(Date.now()), `[SeriesCollector][${type}][${task}]`, 'Error', err);
            //     }),
            //   ),
            // );
            // 串行调度
            for (const [series_id, direction] of tasks.entries()) {
              await handler(series_id, direction, signal).catch((err) => {
                console.info(formatTime(Date.now()), `[SeriesCollector][${type}][${task}]`, 'Error', err);
              });
            }
          } catch (e) {}
        }
      })();
    }
  }
})();
