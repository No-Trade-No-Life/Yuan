import { createRegistry } from './index';

describe('Counter', () => {
  test('should create counter with basic operations', () => {
    const registry = createRegistry();
    const counter = registry.counter('test_counter', 'A test counter');

    expect(counter.get()).toBe(0);

    counter.inc();
    expect(counter.get()).toBe(1);

    counter.inc(5);
    expect(counter.get()).toBe(6);

    counter.add(10);
    expect(counter.get()).toBe(16);

    counter.set(100);
    expect(counter.get()).toBe(100);
  });

  test('should handle labels correctly', () => {
    const registry = createRegistry();
    const counter = registry.counter('http_requests', 'HTTP requests');

    const getCounter = counter.labels({ method: 'GET', path: '/api' });
    const postCounter = counter.labels({ method: 'POST', path: '/api' });

    getCounter.inc();
    postCounter.inc(2);

    expect(getCounter.get()).toBe(1);
    expect(postCounter.get()).toBe(2);

    // 原始 counter 应该没有数据（因为没有无标签的操作）
    expect(counter.get()).toBe(0);
  });

  test('should support chained labels', () => {
    const registry = createRegistry();
    const counter = registry.counter('complex_metric', 'Complex metric');

    const chainedCounter = counter
      .labels({ region: 'us-east' })
      .labels({ service: 'auth' })
      .labels({ version: 'v2' });

    chainedCounter.inc(3);
    expect(chainedCounter.get()).toBe(3);
  });

  test('should delete labeled data', () => {
    const registry = createRegistry();
    const counter = registry.counter('requests', 'Requests');

    const labeledCounter = counter.labels({ type: 'api' });
    labeledCounter.inc(5);

    expect(labeledCounter.get()).toBe(5);

    labeledCounter.delete();
    // 删除后，registry 中该标签组合的数据应被移除
    const content = registry.serialize();
    expect(content).not.toContain('requests{type="api"}');
  });

  test('should serialize correctly', () => {
    const registry = createRegistry();
    const counter = registry.counter('test_counter', 'Test counter');

    counter.inc();
    counter.labels({ label1: 'value1' }).inc(2);

    const result = registry.serialize();
    expect(result).toContain('# HELP test_counter Test counter');
    expect(result).toContain('# TYPE test_counter counter');
    expect(result).toContain('test_counter 1');
    expect(result).toContain('test_counter{label1="value1"} 2');
  });

  test('should handle negative values in add method', () => {
    const registry = createRegistry();
    const counter = registry.counter('test_counter', 'Test counter');

    expect(() => {
      counter.add(-1);
    }).toThrow('Expected increment amount to be greater than -1');
  });
});
