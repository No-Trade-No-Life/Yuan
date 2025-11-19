import { combine } from './combine';
import { ITimeSeries } from './interfaces';

/**
 * Performs cumulative operations (like reduce) over time.
 * @public
 */
export const scan = <T>(
  tags: Record<string, string>,
  init: () => T,
  reducer: (acc: T, index: number, self: ITimeSeries<T>) => T,
  sources: ITimeSeries<any>[],
) => combine<T>(tags, (index, self) => reducer(self[index - 1] ?? init(), index, self), sources);
