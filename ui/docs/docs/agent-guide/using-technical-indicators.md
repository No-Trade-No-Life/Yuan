---
sidebar_position: 4
---

# Using Technical Indicators

**Technical Indicators** helps analyzing the time series, which is one of advanced forms of hook.

> Prerequisite Reading:
>
> - [Using Hooks](./using-hooks)

You can compose your own technical indicators by using the basic hooks.

For example, you want to use Simple Moving Average (SMA) on close price series.

Let's see how to implement it.

```ts
export const useSMA = (source: Series, period: number): Series => {
  const SMA = useSeries(`SMA(${source.name},${period})`, source, { display: 'line' });
  useEffect(() => {
    const i = source.length - 1;
    if (i < 0) return;
    // slice the window
    const values = source.slice(Math.max(0, i - period), i + 1);
    // sum up
    const sum = values.reduce((a, b) => a + b, 0);
    const count = Math.min(i + 1, period);
    // average
    SMA[i] = sum / count;
  });

  return SMA;
};
```

Create a series, and maintain the series values. Series is almost an array but with some extra metadata.

Very simple. Isn't it? Let's use it in agent.

```ts
import { useSMA } from '@libs';
export default () => {
  const { close } = useOHLC('Y', 'XAUUSD', 'PT1H');
  const ma20 = useSMA(close, 20);
  const ma60 = useSMA(close, 60);
  // do something
};
```

## Visualization

You can specify the third parameter of `useSeries` to control the visualization.

You can specify the display type of the series.

- It will hide the series by default.
- You can draw line chart by specify `display: 'line'`.
- You can draw histogram by specify `display: 'hist'`.

You can specify which chart to place the series.

- It will place the series follow the parent series by default.
- You can place the series on a new chart by specify `chart: 'new'`.
- You can place the series follow another series by specify `chart: anotherSeries.id`.

## Improve Code

You can use dynamic programming to improve the calculation performance of technical indicators.

It's a key point that you can cache the intermediate result.

For example, SMA need to calculate a moving sum of source values. It's possible to cache the sum of previous period.

The next time, you can use the previous sum to calculate the current sum.

```ts
export const useSUM = (source: Series, period: number) => {
  const SUM = useSeries(`SUM(${source.name}, ${period})`, source, {});
  useEffect(() => {
    const i = source.length - 1;
    if (i < 0) return;
    SUM[i] = (source[i] || 0) + (i > 0 ? SUM[i - 1] : 0) - (i - period >= 0 ? source[i - period] || 0 : 0);
  });
  return SUM;
};

export const useSMA = (source: Series, period: number): Series => {
  const SUM = useSUM(source, period);
  const SMA = useSeries(`SMA(${source.name},${period})`, source, { display: 'line' });
  useEffect(() => {
    const i = source.length - 1;
    if (i < 0) return;
    SMA[i] = SUM[i] / Math.min(i + 1, period);
  });

  return SMA;
};
```

- No need to slice the window, it's a big performance improvement.
- The time complexity is O(n) now.
- Cumulative sum is a common technique in dynamic programming.

Now you can find a pattern of technical indicators. Let's extract it as a helper hook function:

```ts
export const useSeriesMap = (
  name: string,
  parent: Series,
  tags: Record<string, any> | undefined,
  fn: (i: number, series: Series) => number,
) => {
  const series = useSeries(name, parent, tags);
  useEffect(() => {
    const i = parent.length - 1;
    if (i < 0) return;
    series[i] = fn(i, series);
  });
  return series;
};
```

Then you can use it to implement the SMA indicator:

```ts
export const useSUM = (source: Series, period: number) =>
  useSeriesMap(
    `SUM(${source.name}, ${period})`,
    source,
    {},
    (i, SUM) =>
      // ISSUE: SUM may keep outputting NaN if source has NaN values
      // => use fallback to prevent source[i], source[i - period] is NaN
      (source[i] || 0) + (i > 0 ? SUM[i - 1] : 0) - (i - period >= 0 ? source[i - period] || 0 : 0),
  );

export const useSMA = (source: Series, period: number): Series => {
  const SUM = useSUM(source, period);
  const SMA = useSeriesMap(
    `SMA(${source.name},${period})`,
    source,
    {
      display: 'line',
    },
    (i) => SUM[i] / Math.min(i + 1, period),
  );
  return SMA;
};
```

- It's much more concise now.
- The optimized indicators are ready for production. You can import them from `@libs`.

## Further Reading

You can also checkout the [double moving average strategy](https://github.com/No-Trade-No-Life/Yuan-Public-Workspace/blob/main/%40models/double-ma.ts) to learn how to use it.

You can find out more indicators resource in the repo:

- [Yuan Public Workspace](https://github.com/No-Trade-No-Life/Yuan-Public-Workspace)
