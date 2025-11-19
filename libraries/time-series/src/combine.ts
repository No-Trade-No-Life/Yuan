import { ITimeSeries } from './interfaces';

/**
 * Combines multiple time series using a mapping function.
 * @public
 */
export const combine = <T>(
  tags: Record<string, string>,
  mapper: (index: number, self: ITimeSeries<T>) => T,
  sources: ITimeSeries<any>[],
) => {
  if (sources.length === 0) throw new Error('combine requires at least one source TimeSeries');
  const tf = sources[0].timeFrame;
  for (let i = 1; i < sources.length; i++) {
    if (sources[i].timeFrame !== tf) {
      throw new Error('all source TimeSeries must belong to the same TimeFrame');
    }
  }
  const target = tf.createTimeSeries<T>(tags, () => {
    const timeLength = tf.time.length;
    const startIndex = sources.reduce((minIndex, src) => Math.min(minIndex, src.cleanLength()), Infinity);
    for (let i = startIndex; i < timeLength; i++) {
      target[i] = mapper(i, target);
    }
  });
  return target;
};
