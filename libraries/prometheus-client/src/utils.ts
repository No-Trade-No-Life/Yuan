import { HistogramValue, Labels, Metric, MetricValue } from './types';

function getLabelPairs(metric: Metric<MetricValue>): string {
  const pairs = Object.entries(metric.labels || {}).map(([k, v]) => `${k}="${v}"`);
  return pairs.length === 0 ? '' : `${pairs.join(',')}`;
}

export function formatHistogramOrSummary(
  name: string,
  metric: Metric<HistogramValue>,
  bucketLabel = 'le',
): string {
  let str = '';
  const labels = getLabelPairs(metric);
  if (labels.length > 0) {
    str += `${name}_count{${labels}} ${metric.value.count}\n`;
    str += `${name}_sum{${labels}} ${metric.value.sum}\n`;
  } else {
    str += `${name}_count ${metric.value.count}\n`;
    str += `${name}_sum ${metric.value.sum}\n`;
  }

  return Object.entries(metric.value.entries).reduce((result, [bucket, count]) => {
    if (labels.length > 0) {
      return `${result}${name}_bucket{${bucketLabel}="${bucket}",${labels}} ${count}\n`;
    }
    return `${result}${name}_bucket{${bucketLabel}="${bucket}"} ${count}\n`;
  }, str);
}

export function formatCounterOrGauge(name: string, metric: Metric<MetricValue>): string {
  const value = ` ${metric.value.toString()}`;
  // If there are no keys on `metric`, it doesn't have a label;
  // return the count as a string.
  if (metric.labels == null || Object.keys(metric.labels).length === 0) {
    return `${name}${value}\n`;
  }
  const pair = Object.entries(metric.labels).map(([k, v]) => `${k}="${v}"`);
  return `${name}{${pair.join(',')}}${value}\n`;
}
