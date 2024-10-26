// TD 序列指标
export const useTD = (source: Series) => {
  const TD = useSeries('Output', source, {
    display: 'hist',
    chart: 'new',
  });

  useEffect(() => {
    const i = source.length - 1;
    if (i < 0) return;
    TD[i] = 0;
    if (source[i] > source[i - 4]) {
      TD[i] = Math.max(0, TD[i - 1] ?? 0) + 1;
    }
    if (source[i] < source[i - 4]) {
      TD[i] = Math.min(0, TD[i - 1] ?? 0) - 1;
    }
  });

  return { TD };
};
