import { createRegistry } from './index';

describe('Histogram', () => {
  test('should create histogram with basic operations', () => {
    const registry = createRegistry();
    const histogram = registry.histogram('response_time', 'Response time in seconds', [0.1, 0.5, 1.0]);

    const data = histogram.get();
    expect(data.count).toBe(0);
    expect(data.sum).toBe(0);
    expect(data.buckets.size).toBe(3);

    histogram.observe(0.05);
    histogram.observe(0.3);
    histogram.observe(0.8);

    const updatedData = histogram.get();
    expect(updatedData.count).toBe(3);
    expect(updatedData.sum).toBe(1.15); // 0.05 + 0.3 + 0.8
    expect(updatedData.buckets.get(0.1)).toBe(1); // 0.05 falls in <= 0.1
    expect(updatedData.buckets.get(0.5)).toBe(2); // 0.05, 0.3 fall in <= 0.5
    expect(updatedData.buckets.get(1.0)).toBe(3); // all fall in <= 1.0
  });

  test('should handle labels correctly', () => {
    const registry = createRegistry();
    const histogram = registry.histogram('request_duration', 'Request duration', [100, 500, 1000]);

    const apiHistogram = histogram.labels({ endpoint: '/api' });
    const dbHistogram = histogram.labels({ endpoint: '/db' });

    apiHistogram.observe(50);
    apiHistogram.observe(300);
    dbHistogram.observe(800);

    const apiData = apiHistogram.get();
    const dbData = dbHistogram.get();

    expect(apiData.count).toBe(2);
    expect(apiData.sum).toBe(350);
    expect(dbData.count).toBe(1);
    expect(dbData.sum).toBe(800);
  });

  test('should support chained labels', () => {
    const registry = createRegistry();
    const histogram = registry.histogram('complex_histogram', 'Complex histogram', [10, 20, 30]);

    const chainedHistogram = histogram
      .labels({ region: 'us-east' })
      .labels({ service: 'auth' })
      .labels({ version: 'v2' });

    chainedHistogram.observe(15);
    chainedHistogram.observe(25);

    const data = chainedHistogram.get();
    expect(data.count).toBe(2);
    expect(data.sum).toBe(40);
    expect(data.buckets.get(10)).toBe(0); // 15 > 10
    expect(data.buckets.get(20)).toBe(1); // 15 <= 20
    expect(data.buckets.get(30)).toBe(2); // both <= 30
  });

  test('should delete labeled data', () => {
    const registry = createRegistry();
    const histogram = registry.histogram('latency', 'Latency', [50, 100, 200]);

    const labeledHistogram = histogram.labels({ type: 'network' });
    labeledHistogram.observe(75);

    expect(labeledHistogram.get().count).toBe(1);

    labeledHistogram.delete();
    // 删除后，registry 中该标签组合的数据应被移除
    const content = registry.serialize();
    expect(content).not.toContain('latency{type="network"}');
  });

  test('should serialize correctly', () => {
    const registry = createRegistry();
    const histogram = registry.histogram('test_histogram', 'Test histogram', [0.1, 0.5, 1.0]);

    histogram.observe(0.05);
    histogram.observe(0.3);

    const result = registry.serialize();

    // 检查基本结构
    expect(result).toContain('# HELP test_histogram Test histogram');
    expect(result).toContain('# TYPE test_histogram histogram');

    // 检查计数和总和
    expect(result).toContain('test_histogram_count 2');
    expect(result).toContain('test_histogram_sum 0.35');

    // 检查桶数据
    expect(result).toContain('test_histogram_bucket{le="0.1"} 1');
    expect(result).toContain('test_histogram_bucket{le="0.5"} 2');
    expect(result).toContain('test_histogram_bucket{le="1"} 2');
    expect(result).toContain('test_histogram_bucket{le="+Inf"} 2');
  });

  test('should handle values outside bucket ranges', () => {
    const registry = createRegistry();
    const histogram = registry.histogram('large_values', 'Large values', [10, 20]);

    histogram.observe(5); // below first bucket
    histogram.observe(15); // in first bucket
    histogram.observe(25); // above all buckets

    const data = histogram.get();
    expect(data.count).toBe(3);
    expect(data.sum).toBe(45);

    // 5 should be counted in bucket 10
    expect(data.buckets.get(10)).toBe(1);
    // 15 should be counted in bucket 20
    expect(data.buckets.get(20)).toBe(2);
    // 25 should not be counted in any specific bucket
  });
});
