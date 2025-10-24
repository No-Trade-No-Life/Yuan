import { Labels, HistogramData } from './types';

/**
 * 生成标签键
 * 在创建时预计算，避免运行时重复计算
 */
export const makeLabelKey = (name: string, labels: Labels): string => {
  const labelStr = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${v}"`)
    .join(',');
  return labelStr ? `${name}{${labelStr}}` : name;
};

/**
 * 序列化单个 Counter 或 Gauge 数据
 */
export const serializeCounterOrGauge = (
  name: string,
  help: string,
  data: Map<string, number>,
  type: string,
): string => {
  let output = '';
  if (help) output += `# HELP ${name} ${help}\n`;
  output += `# TYPE ${name} ${type}\n`;

  for (const [labelKey, value] of data) {
    output += `${labelKey} ${value}\n`;
  }

  return output;
};

/**
 * 序列化 Histogram 数据
 */
export const serializeHistogram = (name: string, help: string, data: Map<string, HistogramData>): string => {
  let output = '';
  if (help) output += `# HELP ${name} ${help}\n`;
  output += `# TYPE ${name} histogram\n`;

  for (const [labelKey, histogram] of data) {
    const baseName = labelKey.split('{')[0];

    // 输出计数
    output += `${baseName}_count${labelKey.includes('{') ? labelKey.substring(labelKey.indexOf('{')) : ''} ${
      histogram.count
    }\n`;

    // 输出总和
    output += `${baseName}_sum${labelKey.includes('{') ? labelKey.substring(labelKey.indexOf('{')) : ''} ${
      histogram.sum
    }\n`;

    // 输出桶数据
    const sortedBuckets = Array.from(histogram.buckets.entries()).sort(([a], [b]) => a - b);
    let cumulativeCount = 0;

    for (const [bucket, count] of sortedBuckets) {
      cumulativeCount += count;
      output += `${baseName}_bucket{le="${bucket}"${
        labelKey.includes('{')
          ? ',' + labelKey.substring(labelKey.indexOf('{') + 1, labelKey.lastIndexOf('}'))
          : ''
      }} ${cumulativeCount}\n`;
    }

    // 添加 +Inf 桶
    output += `${baseName}_bucket{le="+Inf"${
      labelKey.includes('{')
        ? ',' + labelKey.substring(labelKey.indexOf('{') + 1, labelKey.lastIndexOf('}'))
        : ''
    }} ${histogram.count}\n`;
  }

  return output;
};

/**
 * 更新 Histogram 桶数据
 */
export const updateHistogramBuckets = (histogram: HistogramData, value: number, buckets: number[]): void => {
  histogram.count += 1;
  histogram.sum += value;

  // 为每个桶设置累积计数
  for (const bucket of buckets) {
    const currentCount = histogram.buckets.get(bucket) || 0;
    if (value <= bucket) {
      histogram.buckets.set(bucket, currentCount + 1);
    } else {
      // 确保所有桶都有值，即使为 0
      histogram.buckets.set(bucket, currentCount);
    }
  }
};
