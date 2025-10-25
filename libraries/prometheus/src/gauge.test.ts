import { createRegistry } from './index';

describe('Gauge', () => {
  test('should create gauge with basic operations', () => {
    const registry = createRegistry();
    const gauge = registry.gauge('test_gauge', 'A test gauge');

    expect(gauge.get()).toBe(0);

    gauge.inc();
    expect(gauge.get()).toBe(1);

    gauge.inc(5);
    expect(gauge.get()).toBe(6);

    gauge.dec();
    expect(gauge.get()).toBe(5);

    gauge.dec(2);
    expect(gauge.get()).toBe(3);

    gauge.add(10);
    expect(gauge.get()).toBe(13);

    gauge.sub(5);
    expect(gauge.get()).toBe(8);

    gauge.set(100);
    expect(gauge.get()).toBe(100);
  });

  test('should handle labels correctly', () => {
    const registry = createRegistry();
    const gauge = registry.gauge('memory_usage', 'Memory usage');

    const heapGauge = gauge.labels({ type: 'heap' });
    const stackGauge = gauge.labels({ type: 'stack' });

    heapGauge.set(1024);
    stackGauge.set(512);

    expect(heapGauge.get()).toBe(1024);
    expect(stackGauge.get()).toBe(512);

    heapGauge.inc(256);
    stackGauge.dec(128);

    expect(heapGauge.get()).toBe(1280);
    expect(stackGauge.get()).toBe(384);
  });

  test('should support chained labels', () => {
    const registry = createRegistry();
    const gauge = registry.gauge('complex_gauge', 'Complex gauge');

    const chainedGauge = gauge
      .labels({ region: 'us-east' })
      .labels({ service: 'auth' })
      .labels({ version: 'v2' });

    chainedGauge.set(42);
    expect(chainedGauge.get()).toBe(42);

    chainedGauge.inc(8);
    expect(chainedGauge.get()).toBe(50);
  });

  test('should delete labeled data', () => {
    const registry = createRegistry();
    const gauge = registry.gauge('temperature', 'Temperature');

    const labeledGauge = gauge.labels({ location: 'server-room' });
    labeledGauge.set(25);

    expect(labeledGauge.get()).toBe(25);

    labeledGauge.delete();
    // 删除后，registry 中该标签组合的数据应被移除
    const content = registry.serialize();
    expect(content).not.toContain('temperature{location="server-room"}');
  });

  test('should serialize correctly', () => {
    const registry = createRegistry();
    const gauge = registry.gauge('test_gauge', 'Test gauge');

    gauge.set(42);
    gauge.labels({ label1: 'value1' }).set(100);

    const result = registry.serialize();
    expect(result).toContain('# HELP test_gauge Test gauge');
    expect(result).toContain('# TYPE test_gauge gauge');
    expect(result).toContain('test_gauge 42');
    expect(result).toContain('test_gauge{label1="value1"} 100');
  });

  test('should handle negative values correctly', () => {
    const registry = createRegistry();
    const gauge = registry.gauge('test_gauge', 'Test gauge');

    gauge.set(10);
    gauge.dec(15);
    expect(gauge.get()).toBe(-5);

    gauge.sub(5);
    expect(gauge.get()).toBe(-10);

    gauge.add(20);
    expect(gauge.get()).toBe(10);
  });
});
