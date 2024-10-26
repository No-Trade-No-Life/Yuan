import { useSUM, useSeriesMap } from '@libs';

/**
 * 加权移动平均线 WMA
 */
export const useWMA = (source: Series, weight: Series, period: number) => {
  const prod = useSeriesMap('Prod', source, {}, (i) => source[i] * weight[i]);

  const sumOfProd = useSUM(prod, period);
  const sumOfWeight = useSUM(weight, period);

  const WMA = useSeriesMap(
    `WMA(${period})`,
    source,
    {
      display: 'line',
    },
    (i) => sumOfProd[i] / sumOfWeight[i],
  );

  return { WMA };
};
