import { createRegistry } from './index';

describe('Registry', () => {
  test('should create registry with empty state', () => {
    const registry = createRegistry();

    const result = registry.serialize();
    expect(result).toBe('');
  });

  test('should register multiple metric types', () => {
    const registry = createRegistry();

    const counter = registry.counter('requests', 'Total requests');
    const gauge = registry.gauge('memory', 'Memory usage');
    const histogram = registry.histogram('latency', 'Latency', [100, 200]);

    counter.inc();
    gauge.set(1024);
    histogram.observe(150);

    const result = registry.serialize();

    expect(result).toContain('# HELP requests Total requests');
    expect(result).toContain('# TYPE requests counter');
    expect(result).toContain('requests 1');

    expect(result).toContain('# HELP memory Memory usage');
    expect(result).toContain('# TYPE memory gauge');
    expect(result).toContain('memory 1024');

    expect(result).toContain('# HELP latency Latency');
    expect(result).toContain('# TYPE latency histogram');
    expect(result).toContain('latency_count 1');
  });

  test('should delete specific labeled data', () => {
    const registry = createRegistry();
    const counter = registry.counter('http_requests', 'HTTP requests');

    counter.labels({ method: 'GET' }).inc(3);
    counter.labels({ method: 'POST' }).inc(5);

    expect(counter.labels({ method: 'GET' }).get()).toBe(3);
    expect(counter.labels({ method: 'POST' }).get()).toBe(5);

    // 删除 GET 请求数据
    registry.delete('http_requests', { method: 'GET' });

    expect(counter.labels({ method: 'GET' }).get()).toBe(0);
    expect(counter.labels({ method: 'POST' }).get()).toBe(5);
  });

  test('should delete all data for a metric when no labels provided', () => {
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

  test('should clear all data', () => {
    const registry = createRegistry();

    const counter = registry.counter('counter1', 'Counter 1');
    const gauge = registry.gauge('gauge1', 'Gauge 1');

    counter.inc(10);
    gauge.set(42);

    expect(counter.get()).toBe(10);
    expect(gauge.get()).toBe(42);

    registry.clear();

    expect(counter.get()).toBe(0);
    expect(gauge.get()).toBe(0);

    const result = registry.serialize();
    expect(result).toBe('');
  });

  test('should reset all data to initial values', () => {
    const registry = createRegistry();

    const counter = registry.counter('counter1', 'Counter 1');
    const gauge = registry.gauge('gauge1', 'Gauge 1');
    const histogram = registry.histogram('hist1', 'Histogram 1', [10, 20]);

    counter.inc(5);
    gauge.set(100);
    histogram.observe(15);

    expect(counter.get()).toBe(5);
    expect(gauge.get()).toBe(100);
    expect(histogram.get().count).toBe(1);

    registry.reset();

    expect(counter.get()).toBe(0);
    expect(gauge.get()).toBe(0);
    expect(histogram.get().count).toBe(0);
    expect(histogram.get().sum).toBe(0);
    expect(histogram.get().buckets.size).toBe(0);
  });

  test('should handle multiple registries independently', () => {
    const registry1 = createRegistry();
    const registry2 = createRegistry();

    const counter1 = registry1.counter('requests', 'Requests');
    const counter2 = registry2.counter('requests', 'Requests');

    counter1.inc(10);
    counter2.inc(20);

    expect(counter1.get()).toBe(10);
    expect(counter2.get()).toBe(20);

    const result1 = registry1.serialize();
    const result2 = registry2.serialize();

    expect(result1).toContain('requests 10');
    expect(result2).toContain('requests 20');
    expect(result1).not.toBe(result2);
  });

  test('should serialize complex metric combinations', () => {
    const registry = createRegistry();

    // 添加多个 metrics 和标签组合
    const requests = registry.counter('http_requests', 'HTTP requests');
    requests.labels({ method: 'GET', status: '200' }).inc(100);
    requests.labels({ method: 'POST', status: '201' }).inc(50);

    const memory = registry.gauge('memory_bytes', 'Memory in bytes');
    memory.labels({ type: 'heap' }).set(1024 * 1024);
    memory.labels({ type: 'stack' }).set(512 * 1024);

    const latency = registry.histogram('latency_seconds', 'Latency', [0.1, 0.5]);
    latency.labels({ endpoint: '/api' }).observe(0.05);
    latency.labels({ endpoint: '/api' }).observe(0.3);

    const result = registry.serialize();

    // 验证序列化结果包含所有预期的内容
    expect(result).toContain('http_requests{method="GET",status="200"} 100');
    expect(result).toContain('http_requests{method="POST",status="201"} 50');
    expect(result).toContain('memory_bytes{type="heap"} 1048576');
    expect(result).toContain('memory_bytes{type="stack"} 524288');
    expect(result).toContain('latency_seconds_count{endpoint="/api"} 2');
    expect(result).toContain('latency_seconds_sum{endpoint="/api"} 0.35');
  });

  test('should handle metric name collisions gracefully', () => {
    const registry = createRegistry();

    const counter1 = registry.counter('same_name', 'First counter');
    const counter2 = registry.counter('same_name', 'Second counter');

    // 第二个调用应该覆盖第一个的定义
    counter1.inc(5);
    counter2.inc(10);

    const result = registry.serialize();

    // 应该使用第二个帮助文本
    expect(result).toContain('# HELP same_name Second counter');
    expect(result).toContain('same_name 10');
    expect(result).not.toContain('First counter');
  });
});
