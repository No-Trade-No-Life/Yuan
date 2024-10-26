import { useEMA, useSeriesMap } from '@libs';

/**
 * On Balance Volume
 * @param source - Source Price
 * @param volume - Volume
 */
export const useOBV = (source: Series, volume: Series) => {
  return useSeriesMap(`OBV(${source.name})`, source, { display: 'line', chart: 'new' }, (i, obv) => {
    if (i === 0) return 0;
    if (source[i] > source[i - 1]) {
      return obv[i - 1] + volume[i];
    }
    if (source[i] < source[i - 1]) {
      return obv[i - 1] - volume[i];
    }
    return obv[i - 1];
  });
};
