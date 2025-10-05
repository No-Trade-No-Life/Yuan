import { createRegistry } from './index';

describe('Delete Functionality', () => {
  test('should delete counter data with labels', () => {
    const registry = createRegistry();
    const counter = registry.counter('test_counter', 'Test counter');

    const labeledCounter1 = counter.labels({ service: 'api', env: 'prod' });
    const labeledCounter2 = counter.labels({ service: 'db', env: 'prod' });

    labeledCounter1.inc(5);
    labeledCounter2.inc(10);

    expect(labeledCounter1.get()).toBe(5);
    expect(labeledCounter2.get()).toBe(10);

    // 删除第一个标签组合的数据
    labeledCounter1.delete();

    expect(labeledCounter1.get()).toBe(0);
    expect(labeledCounter2.get()).toBe(10);
  });

  test('should delete gauge data with labels', () => {
    const registry = createRegistry();
    const gauge = registry.gauge('test_gauge', 'Test gauge');

    const labeledGauge1 = gauge.labels({ type: 'cpu', host: 'server1' });
    const labeledGauge2 = gauge.labels({ type: 'memory', host: 'server1' });

    labeledGauge1.set(75);
    labeledGauge2.set(2048);

    expect(labeledGauge1.get()).toBe(75);
    expect(labeledGauge2.get()).toBe(2048);

    // 删除第一个标签组合的数据
    labeledGauge1.delete();

    expect(labeledGauge1.get()).toBe(0);
    expect(labeledGauge2.get()).toBe(2048);
  });

  test('should delete histogram data with labels', () => {
    const registry = createRegistry();
    const histogram = registry.histogram('test_histogram', 'Test histogram', [10, 20]);

    const labeledHistogram1 = histogram.labels({ endpoint: '/api' });
    const labeledHistogram2 = histogram.labels({ endpoint: '/db' });

    labeledHistogram1.observe(5);
    labeledHistogram1.observe(15);
    labeledHistogram2.observe(25);

    expect(labeledHistogram1.get().count).toBe(2);
    expect(labeledHistogram2.get().count).toBe(1);

    // 删除第一个标签组合的数据
    labeledHistogram1.delete();

    expect(labeledHistogram1.get().count).toBe(0);
    expect(labeledHistogram1.get().sum).toBe(0);
    expect(labeledHistogram1.get().buckets.size).toBe(0);
    expect(labeledHistogram2.get().count).toBe(1);
  });

  test('should delete data via registry delete method', () => {
    const registry = createRegistry();
    const counter = registry.counter('http_requests', 'HTTP requests');

    counter.labels({ method: 'GET', path: '/api' }).inc(3);
    counter.labels({ method: 'POST', path: '/api' }).inc(5);
    counter.labels({ method: 'GET', path: '/health' }).inc(2);

    expect(counter.labels({ method: 'GET', path: '/api' }).get()).toBe(3);
    expect(counter.labels({ method: 'POST', path: '/api' }).get()).toBe(5);
    expect(counter.labels({ method: 'GET', path: '/health' }).get()).toBe(2);

    // 通过 registry 删除特定标签组合
    registry.delete('http_requests', { method: 'GET', path: '/api' });

    expect(counter.labels({ method: 'GET', path: '/api' }).get()).toBe(0);
    expect(counter.labels({ method: 'POST', path: '/api' }).get()).toBe(5);
    expect(counter.labels({ method: 'GET', path: '/health' }).get()).toBe(2);
  });

  test('should delete all data for metric via registry delete without labels', () => {
    const registry = createRegistry();
    const counter = registry.counter('test_metric', 'Test metric');

    counter.labels({ label1: 'value1' }).inc(1);
    counter.labels({ label2: 'value2' }).inc(2);
    counter.inc(3); // 无标签

    expect(counter.labels({ label1: 'value1' }).get()).toBe(1);
    expect(counter.labels({ label2: 'value2' }).get()).toBe(2);
    expect(counter.get()).toBe(3);

    // 删除所有 test_metric 的数据
    registry.delete('test_metric');

    expect(counter.labels({ label1: 'value1' }).get()).toBe(0);
    expect(counter.labels({ label2: 'value2' }).get()).toBe(0);
    expect(counter.get()).toBe(0);
  });

  test('should handle partial label matching in registry delete', () => {
    const registry = createRegistry();
    const counter = registry.counter('requests', 'Requests');

    counter.labels({ service: 'api', env: 'prod' }).inc(10);
    counter.labels({ service: 'api', env: 'dev' }).inc(5);
    counter.labels({ service: 'db', env: 'prod' }).inc(8);

    // 只删除 service=api 的数据，不管 env 是什么
    registry.delete('requests', { service: 'api' });

    expect(counter.labels({ service: 'api', env: 'prod' }).get()).toBe(0);
    expect(counter.labels({ service: 'api', env: 'dev' }).get()).toBe(0);
    expect(counter.labels({ service: 'db', env: 'prod' }).get()).toBe(8);
  });

  test('should clear all data with registry clear method', () => {
    const registry = createRegistry();

    const counter = registry.counter('counter1', 'Counter 1');
    const gauge = registry.gauge('gauge1', 'Gauge 1');
    const histogram = registry.histogram('hist1', 'Histogram 1', [10]);

    counter.labels({ label: 'value' }).inc(5);
    gauge.labels({ label: 'value' }).set(42);
    histogram.labels({ label: 'value' }).observe(15);

    expect(counter.labels({ label: 'value' }).get()).toBe(5);
    expect(gauge.labels({ label: 'value' }).get()).toBe(42);
    expect(histogram.labels({ label: 'value' }).get().count).toBe(1);

    registry.clear();

    expect(counter.labels({ label: 'value' }).get()).toBe(0);
    expect(gauge.labels({ label: 'value' }).get()).toBe(0);
    expect(histogram.labels({ label: 'value' }).get().count).toBe(0);
  });

  test('should reset all data with registry reset method', () => {
    const registry = createRegistry();

    const counter = registry.counter('counter1', 'Counter 1');
    const gauge = registry.gauge('gauge1', 'Gauge 1');

    counter.labels({ label: 'value' }).inc(5);
    gauge.labels({ label: 'value' }).set(42);

    expect(counter.labels({ label: 'value' }).get()).toBe(5);
    expect(gauge.labels({ label: 'value' }).get()).toBe(42);

    registry.reset();

    // 重置后数据应该为 0，但 metric 定义仍然存在
    expect(counter.labels({ label: 'value' }).get()).toBe(0);
    expect(gauge.labels({ label: 'value' }).get()).toBe(0);

    // 可以继续使用
    counter.labels({ label: 'value' }).inc(3);
    expect(counter.labels({ label: 'value' }).get()).toBe(3);
  });

  test('should not affect other metrics when deleting one', () => {
    const registry = createRegistry();

    const counter1 = registry.counter('metric1', 'Metric 1');
    const counter2 = registry.counter('metric2', 'Metric 2');

    counter1.labels({ label: 'value' }).inc(10);
    counter2.labels({ label: 'value' }).inc(20);

    expect(counter1.labels({ label: 'value' }).get()).toBe(10);
    expect(counter2.labels({ label: 'value' }).get()).toBe(20);

    // 只删除 metric1 的数据
    registry.delete('metric1', { label: 'value' });

    expect(counter1.labels({ label: 'value' }).get()).toBe(0);
    expect(counter2.labels({ label: 'value' }).get()).toBe(20);
  });

  test('should handle non-existent metric deletion gracefully', () => {
    const registry = createRegistry();

    // 删除不存在的 metric 不应该抛出错误
    expect(() => {
      registry.delete('non_existent_metric');
    }).not.toThrow();

    expect(() => {
      registry.delete('non_existent_metric', { label: 'value' });
    }).not.toThrow();
  });
});
