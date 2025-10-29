---
sidebar_position: 5
---

# 使用技术指标

**技术指标** 有助于分析时间序列，是钩子的高级形式之一。

> 前置阅读：
>
> - [使用钩子](./using-hooks)

您可以通过使用基本钩子来组合自己的技术指标。

例如，您想在收盘价序列上使用简单移动平均线（SMA）。

让我们看看如何实现它。

```ts
export const useSMA = (source: Series, period: number): Series => {
  const SMA = useSeries(`SMA(${source.name},${period})`, source, { display: 'line' });
  useEffect(() => {
    const i = source.currentIndex;
    if (i < 0) return;
    // 切片窗口
    const values = source.slice(Math.max(0, i - period), i + 1);
    // 求和
    const sum = values.reduce((a, b) => a + b, 0);
    const count = Math.min(i + 1, period);
    // 平均
    SMA[i] = sum / count;
  });

  return SMA;
};
```

创建一个序列，并维护序列的值。序列几乎是一个数组，但有一些额外的元数据。

非常简单。不是吗？让我们在 Agent 中使用它。

```ts
import { useSMA } from '@libs';
export default () => {
  const { close } = useOHLC('Y', 'XAUUSD', 'PT1H');
  const ma20 = useSMA(close, 20);
  const ma60 = useSMA(close, 60);
  // 做些什么
};
```

## 改进代码

您可以使用动态规划来提高技术指标的计算性能。

关键点是您可以缓存中间结果。

例如，SMA 需要计算源值的移动和。可以缓存前一个周期的和。

下一次，您可以使用前一个和来计算当前和。

```ts
export const useSUM = (source: Series, period: number) => {
  const SUM = useSeries(`SUM(${source.name}, ${period})`, source, {});
  useEffect(() => {
    const i = source.currentIndex;
    if (i < 0) return;
    SUM[i] = (source[i] || 0) + (i > 0 ? SUM[i - 1] : 0) - (i - period >= 0 ? source[i - period] || 0 : 0);
  });
  return SUM;
};

export const useSMA = (source: Series, period: number): Series => {
  const SUM = useSUM(source, period);
  const SMA = useSeries(`SMA(${source.name},${period})`, source, { display: 'line' });
  useEffect(() => {
    const i = source.currentIndex;
    if (i < 0) return;
    SMA[i] = SUM[i] / Math.min(i + 1, period);
  });

  return SMA;
};
```

- 不需要切片窗口，这是一个很大的性能改进。
- 现在时间复杂度是 O(n)。
- 累积和是动态规划中的常见技术。

现在您可以找到技术指标的模式。让我们将其提取为一个辅助钩子函数：

```ts
export const useSeriesMap = (
  name: string,
  parent: Series,
  tags: Record<string, any> | undefined,
  fn: (i: number, series: Series) => number,
) => {
  const series = useSeries(name, parent, tags);
  useEffect(() => {
    const i = series.currentIndex;
    if (i < 0) return;
    series[i] = fn(i, series);
  });
  return series;
};
```

然后您可以使用它来实现 SMA 指标：

```ts
export const useSUM = (source: Series, period: number) =>
  useSeriesMap(
    `SUM(${source.name}, ${period})`,
    source,
    {},
    (i, SUM) =>
      // 问题：如果源值有 NaN 值，SUM 可能会持续输出 NaN
      // => 使用回退防止 source[i], source[i - period] 是 NaN
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

- 现在更加简洁了。
- 优化的指标已准备好用于生产。您可以从 `@libs` 导入它们。

## 进一步阅读

您还可以查看 [双移动平均策略](https://github.com/No-Trade-No-Life/Yuan-Public-Workspace/blob/main/%40models/double-ma.ts) 以了解如何使用它。

您可以在仓库中找到更多指标资源：

- [Yuan 公共工作区](https://github.com/No-Trade-No-Life/Yuan-Public-Workspace)
