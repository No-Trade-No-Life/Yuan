import { createRegistry } from './index';

describe('Serialization', () => {
  test('should serialize empty registry', () => {
    const registry = createRegistry();
    const result = registry.serialize();

    expect(result).toBe('');
  });

  test('should serialize counter with help text', () => {
    const registry = createRegistry();
    const counter = registry.counter('http_requests', 'Total HTTP requests');

    counter.inc();

    const result = registry.serialize();

    expect(result).toContain('# HELP http_requests Total HTTP requests');
    expect(result).toContain('# TYPE http_requests counter');
    expect(result).toContain('http_requests 1');
  });

  test('should serialize counter without help text', () => {
    const registry = createRegistry();
    const counter = registry.counter('http_requests', '');

    counter.inc();

    const result = registry.serialize();

    expect(result).not.toContain('# HELP http_requests');
    expect(result).toContain('# TYPE http_requests counter');
    expect(result).toContain('http_requests 1');
  });

  test('should serialize counter with labels', () => {
    const registry = createRegistry();
    const counter = registry.counter('http_requests', 'HTTP requests');

    counter.labels({ method: 'GET', status: '200' }).inc(100);
    counter.labels({ method: 'POST', status: '201' }).inc(50);

    const result = registry.serialize();

    expect(result).toContain('http_requests{method="GET",status="200"} 100');
    expect(result).toContain('http_requests{method="POST",status="201"} 50');
  });

  test('should serialize gauge with labels', () => {
    const registry = createRegistry();
    const gauge = registry.gauge('memory_usage', 'Memory usage in bytes');

    gauge.labels({ type: 'heap' }).set(1024 * 1024);
    gauge.labels({ type: 'stack' }).set(512 * 1024);

    const result = registry.serialize();

    expect(result).toContain('# HELP memory_usage Memory usage in bytes');
    expect(result).toContain('# TYPE memory_usage gauge');
    expect(result).toContain('memory_usage{type="heap"} 1048576');
    expect(result).toContain('memory_usage{type="stack"} 524288');
  });

  test('should serialize histogram with buckets', () => {
    const registry = createRegistry();
    const histogram = registry.histogram('response_time', 'Response time in seconds', [0.1, 0.5, 1.0]);

    histogram.observe(0.05);
    histogram.observe(0.3);
    histogram.observe(0.8);

    const result = registry.serialize();

    expect(result).toContain('# HELP response_time Response time in seconds');
    expect(result).toContain('# TYPE response_time histogram');
    expect(result).toContain('response_time_count 3');
    expect(result).toContain('response_time_sum 1.15');
    expect(result).toContain('response_time_bucket{le="0.1"} 1');
    expect(result).toContain('response_time_bucket{le="0.5"} 2');
    expect(result).toContain('response_time_bucket{le="1"} 3');
    expect(result).toContain('response_time_bucket{le="+Inf"} 3');
  });

  test('should serialize histogram with labels', () => {
    const registry = createRegistry();
    const histogram = registry.histogram('request_duration', 'Request duration', [100, 200]);

    histogram.labels({ endpoint: '/api' }).observe(50);
    histogram.labels({ endpoint: '/api' }).observe(150);
    histogram.labels({ endpoint: '/db' }).observe(250);

    const result = registry.serialize();

    expect(result).toContain('request_duration_count{endpoint="/api"} 2');
    expect(result).toContain('request_duration_sum{endpoint="/api"} 200');
    expect(result).toContain('request_duration_bucket{endpoint="/api",le="100"} 1');
    expect(result).toContain('request_duration_bucket{endpoint="/api",le="200"} 2');
    expect(result).toContain('request_duration_bucket{endpoint="/api",le="+Inf"} 2');

    expect(result).toContain('request_duration_count{endpoint="/db"} 1');
    expect(result).toContain('request_duration_sum{endpoint="/db"} 250');
    expect(result).toContain('request_duration_bucket{endpoint="/db",le="100"} 0');
    expect(result).toContain('request_duration_bucket{endpoint="/db",le="200"} 0');
    expect(result).toContain('request_duration_bucket{endpoint="/db",le="+Inf"} 1');
  });

  test('should serialize multiple metric types together', () => {
    const registry = createRegistry();

    // Counter
    const requests = registry.counter('http_requests', 'HTTP requests');
    requests.labels({ method: 'GET' }).inc(100);

    // Gauge
    const memory = registry.gauge('memory_bytes', 'Memory in bytes');
    memory.labels({ type: 'heap' }).set(1024 * 1024);

    // Histogram
    const latency = registry.histogram('latency_seconds', 'Latency', [0.1, 0.5]);
    latency.observe(0.05);

    const result = registry.serialize();

    // 验证所有 metric 类型都正确序列化
    expect(result).toContain('# HELP http_requests HTTP requests');
    expect(result).toContain('# TYPE http_requests counter');
    expect(result).toContain('http_requests{method="GET"} 100');

    expect(result).toContain('# HELP memory_bytes Memory in bytes');
    expect(result).toContain('# TYPE memory_bytes gauge');
    expect(result).toContain('memory_bytes{type="heap"} 1048576');

    expect(result).toContain('# HELP latency_seconds Latency');
    expect(result).toContain('# TYPE latency_seconds histogram');
    expect(result).toContain('latency_seconds_count 1');
    expect(result).toContain('latency_seconds_sum 0.05');
    expect(result).toContain('latency_seconds_bucket{le="0.1"} 1');
  });

  test('should handle special characters in labels', () => {
    const registry = createRegistry();
    const counter = registry.counter('test_metric', 'Test metric');

    counter.labels({ 'special-key': 'value with spaces' }).inc(1);
    counter.labels({ 'key-with-dashes': 'value-with-dashes' }).inc(2);
    counter.labels({ key_with_underscores: 'value_with_underscores' }).inc(3);

    const result = registry.serialize();

    expect(result).toContain('test_metric{special-key="value with spaces"} 1');
    expect(result).toContain('test_metric{key-with-dashes="value-with-dashes"} 2');
    expect(result).toContain('test_metric{key_with_underscores="value_with_underscores"} 3');
  });

  test('should handle empty labels', () => {
    const registry = createRegistry();
    const counter = registry.counter('test_metric', 'Test metric');

    counter.inc(5); // 无标签
    counter.labels({}).inc(10); // 空标签对象

    const result = registry.serialize();

    // 无标签和空标签应该产生相同的结果
    expect(result).toContain('test_metric 15');
    expect(result.match(/test_metric/g)?.length).toBe(3); // 应该只有3行
  });
});
