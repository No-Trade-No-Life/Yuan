import { useSMA, useSeriesMap } from '@libs';

/**
 * 计算标准差
 * @param source
 * @param period
 * @returns
 */
export const useSTD = (source: Series, period: number): Series => {
  const smaOfSource = useSMA(source, period);

  const square = useSeriesMap(`POW(${source.name}, 2)`, source, {}, (i) => source[i] ** 2); // X^2

  const smaOfSquare = useSMA(square, period);
  useEffect(() => {
    smaOfSource.tags.display = 'none';
    square.tags.display = 'none';
    smaOfSquare.tags.display = 'none';
  }, []);

  // STD(X) = SQRT(E(X^2) - E(X)^2)
  const STD = useSeriesMap(
    `STD(${source.name}, ${period})`,
    source,
    {
      display: 'line',
      chart: 'new',
    },
    (i) => (period > 1 ? (smaOfSquare[i] - smaOfSource[i] ** 2) ** 0.5 : 0),
  );
  return STD;
};
