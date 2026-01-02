import { decodePath, formatTime, tokenBucket } from '@yuants/utils';
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

            // const groups = Map.groupBy(tasks, item => decodePath(item[0])[0]);
            const groups = new Map<string, [string, 'forward' | 'backward'][]>();
            for (const item of tasks) {
              const [datasource_id] = decodePath(item[0]);
              let items = groups.get(datasource_id);
              if (!items) {
                items = [];
                groups.set(datasource_id, items);
              }
              items.push(item);
            }

            await Promise.all(
              Array.from(groups.entries()).map(async ([datasource_id, tasks]) => {
                for (const [series_id, direction] of tasks) {
                  await tokenBucket(`${type}:${task}:${datasource_id}`).acquire(1, signal);
                  await handler(series_id, direction, signal).catch((err) => {
                    console.info(formatTime(Date.now()), `[SeriesCollector][${type}][${task}]`, 'Error', err);
                  });
                }
              }),
            );
          } catch (e) {}
        }
      })();
    }
  }
})();
