import { performance } from 'perf_hooks';
import { Registry as ClientRegistry } from '@yuants/prometheus-client';
import { createRegistry } from './index';

// 工具函数：运行性能测试
const runBenchmark = (name: string, fn: () => void, iterations: number = 10000) => {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const end = performance.now();
  const duration = end - start;
  const opsPerMs = iterations / duration;

  console.log(`${name}: ${duration.toFixed(2)}ms (${opsPerMs.toFixed(2)} ops/ms)`);
  return { duration, opsPerMs };
};

describe('性能基准测试: @yuants/prometheus vs @yuants/prometheus-client', () => {
  const iterations = 10000;

  test('Counter 创建和递增性能', () => {
    console.log('\n=== Counter 创建和递增性能测试 ===');

    // @yuants/prometheus
    const registry1 = createRegistry();
    const counter1 = registry1.counter('test_counter', 'Test counter');
    const prometheusCounter = () => {
      counter1.inc();
      counter1.inc(2);
      return registry1.serialize();
    };

    // @yuants/prometheus-client
    const registry2 = new ClientRegistry();
    const counter2 = registry2.create('counter', 'test_counter', 'Test counter');
    const clientCounter = () => {
      counter2.inc();
      counter2.add(2);
      return registry2.metrics();
    };

    const result1 = runBenchmark('@yuants/prometheus', prometheusCounter, iterations);
    const result2 = runBenchmark('@yuants/prometheus-client', clientCounter, iterations);

    const speedup = result2.duration / result1.duration;
    console.log(`性能提升: ${speedup.toFixed(2)}x`);

    expect(speedup).toBeGreaterThan(1); // 期望新版本有性能提升
  });

  test('Gauge 创建和设置性能', () => {
    console.log('\n=== Gauge 创建和设置性能测试 ===');

    // @yuants/prometheus
    const registry1 = createRegistry();
    const gauge1 = registry1.gauge('test_gauge', 'Test gauge');
    const prometheusGauge = () => {
      gauge1.set(42);
      gauge1.set(100);
      return registry1.serialize();
    };

    // @yuants/prometheus-client
    const registry2 = new ClientRegistry();
    const gauge2 = registry2.create('gauge', 'test_gauge', 'Test gauge');
    const clientGauge = () => {
      gauge2.set(42);
      gauge2.set(100);
      return registry2.metrics();
    };

    const result1 = runBenchmark('@yuants/prometheus', prometheusGauge, iterations);
    const result2 = runBenchmark('@yuants/prometheus-client', clientGauge, iterations);

    const speedup = result2.duration / result1.duration;
    console.log(`性能提升: ${speedup.toFixed(2)}x`);

    expect(speedup).toBeGreaterThan(1);
  });

  test('带标签的 Counter 性能', () => {
    console.log('\n=== 带标签的 Counter 性能测试 ===');

    // @yuants/prometheus
    const registry1 = createRegistry();
    const counter1 = registry1.counter('http_requests', 'HTTP requests');
    const prometheusLabeledCounter = () => {
      counter1.labels({ method: 'GET', status: '200' }).inc();
      counter1.labels({ method: 'POST', status: '201' }).inc();
      return registry1.serialize();
    };

    // @yuants/prometheus-client
    const registry2 = new ClientRegistry();
    const counter2 = registry2.create('counter', 'http_requests', 'HTTP requests');
    const clientLabeledCounter = () => {
      counter2.inc({ method: 'GET', status: '200' });
      counter2.inc({ method: 'POST', status: '201' });
      return registry2.metrics();
    };

    const result1 = runBenchmark('@yuants/prometheus', prometheusLabeledCounter, iterations);
    const result2 = runBenchmark('@yuants/prometheus-client', clientLabeledCounter, iterations);

    const speedup = result2.duration / result1.duration;
    console.log(`性能提升: ${speedup.toFixed(2)}x`);

    expect(speedup).toBeGreaterThan(1);
  });

  test('序列化性能', () => {
    console.log('\n=== 序列化性能测试 ===');

    // 准备数据
    const registry1 = createRegistry();
    const registry2 = new ClientRegistry();

    // 创建相同的 metrics
    const counter1 = registry1.counter('requests', 'Requests');
    const gauge1 = registry1.gauge('memory', 'Memory');
    const histogram1 = registry1.histogram('latency', 'Latency', [100, 200, 300]);

    const counter2 = registry2.create('counter', 'requests', 'Requests');
    const gauge2 = registry2.create('gauge', 'memory', 'Memory');
    const histogram2 = registry2.create('histogram', 'latency', 'Latency', [100, 200, 300]);

    // 添加一些数据
    for (let i = 0; i < 1000; i++) {
      counter1.inc();
      gauge1.set(i % 100);
      histogram1.observe(i % 500);

      counter2.inc();
      gauge2.set(i % 100);
      histogram2.observe(i % 500);
    }

    const result1 = runBenchmark(
      '@yuants/prometheus serialize',
      () => registry1.serialize(),
      iterations / 100,
    );
    const result2 = runBenchmark(
      '@yuants/prometheus-client metrics',
      () => registry2.metrics(),
      iterations / 100,
    );

    const speedup = result2.duration / result1.duration;
    console.log(`序列化性能提升: ${speedup.toFixed(2)}x`);

    expect(speedup).toBeGreaterThan(1);
  });

  test('内存使用对比', () => {
    console.log('\n=== 内存使用对比测试 ===');

    const iterations = 1000;

    // 测量 @yuants/prometheus 内存使用
    const startMemory1 = process.memoryUsage().heapUsed;
    const registry1 = createRegistry();

    for (let i = 0; i < iterations; i++) {
      const counter = registry1.counter(`counter_${i}`, `Counter ${i}`);
      counter.inc();
      counter.labels({ label: `value_${i}` }).inc();
    }

    const endMemory1 = process.memoryUsage().heapUsed;
    const memoryUsed1 = endMemory1 - startMemory1;

    // 测量 @yuants/prometheus-client 内存使用
    const startMemory2 = process.memoryUsage().heapUsed;
    const registry2 = new ClientRegistry();

    for (let i = 0; i < iterations; i++) {
      const counter = registry2.create('counter', `counter_${i}`, `Counter ${i}`);
      counter.inc();
      counter.inc({ label: `value_${i}` });
    }

    const endMemory2 = process.memoryUsage().heapUsed;
    const memoryUsed2 = endMemory2 - startMemory2;

    console.log(`@yuants/prometheus 内存使用: ${(memoryUsed1 / 1024).toFixed(2)} KB`);
    console.log(`@yuants/prometheus-client 内存使用: ${(memoryUsed2 / 1024).toFixed(2)} KB`);
    console.log(`内存使用减少: ${(((memoryUsed2 - memoryUsed1) / memoryUsed2) * 100).toFixed(2)}%`);

    expect(memoryUsed1).toBeLessThan(memoryUsed2); // 期望新版本使用更少内存
  });
});

describe('序列化输出一致性测试', () => {
  test('Counter 序列化输出一致性', () => {
    const registry1 = createRegistry();
    const registry2 = new ClientRegistry();

    const counter1 = registry1.counter('test_counter', 'A test counter');
    const counter2 = registry2.create('counter', 'test_counter', 'A test counter');

    counter1.inc(5);
    counter2.add(5);

    const result1 = registry1.serialize();
    const result2 = registry2.metrics();

    // 标准化输出格式进行比较
    const normalizeOutput = (output: string) =>
      output
        .split('\n')
        .filter((line) => line.trim())
        .sort()
        .join('\n');

    expect(normalizeOutput(result1)).toBe(normalizeOutput(result2));
  });

  test('Gauge 序列化输出一致性', () => {
    const registry1 = createRegistry();
    const registry2 = new ClientRegistry();

    const gauge1 = registry1.gauge('test_gauge', 'A test gauge');
    const gauge2 = registry2.create('gauge', 'test_gauge', 'A test gauge');

    gauge1.set(42);
    gauge2.set(42);

    const result1 = registry1.serialize();
    const result2 = registry2.metrics();

    const normalizeOutput = (output: string) =>
      output
        .split('\n')
        .filter((line) => line.trim())
        .sort()
        .join('\n');

    expect(normalizeOutput(result1)).toBe(normalizeOutput(result2));
  });

  test('带标签的 Counter 序列化输出一致性', () => {
    const registry1 = createRegistry();
    const registry2 = new ClientRegistry();

    const counter1 = registry1.counter('http_requests', 'HTTP requests');
    const counter2 = registry2.create('counter', 'http_requests', 'HTTP requests');

    counter1.labels({ method: 'GET', status: '200' }).inc(10);
    counter2.add(10, { method: 'GET', status: '200' });

    const result1 = registry1.serialize();
    const result2 = registry2.metrics();

    // 分别验证两个库的输出格式正确性
    expect(result1).toContain('# HELP http_requests HTTP requests');
    expect(result1).toContain('# TYPE http_requests counter');
    expect(result1).toContain('http_requests{method="GET",status="200"} 10');

    expect(result2).toContain('# HELP http_requests HTTP requests');
    expect(result2).toContain('# TYPE http_requests counter');
    expect(result2).toContain('http_requests{method="GET",status="200"} 10');

    // 注意：prometheus-client 会包含默认的计数器值，所以不能直接比较整个输出
    // 但两者都应该包含正确格式的带标签的指标数据
  });

  test('Histogram 序列化输出一致性', () => {
    const registry1 = createRegistry();
    const registry2 = new ClientRegistry();

    const histogram1 = registry1.histogram('latency', 'Request latency', [100, 200, 300]);
    const histogram2 = registry2.create('histogram', 'latency', 'Request latency', [100, 200, 300]);

    histogram1.observe(150);
    histogram1.observe(250);
    histogram2.observe(150);
    histogram2.observe(250);

    const result1 = registry1.serialize();
    const result2 = registry2.metrics();

    const normalizeOutput = (output: string) =>
      output
        .split('\n')
        .filter((line) => line.trim())
        .sort()
        .join('\n');

    expect(normalizeOutput(result1)).toBe(normalizeOutput(result2));
  });

  test('复杂场景序列化输出一致性', () => {
    const registry1 = createRegistry();
    const registry2 = new ClientRegistry();

    // 创建相同的复杂场景
    const counter1 = registry1.counter('http_requests', 'HTTP requests');
    const gauge1 = registry1.gauge('memory_bytes', 'Memory usage');
    const histogram1 = registry1.histogram('response_time', 'Response time', [0.1, 0.5, 1.0]);

    const counter2 = registry2.create('counter', 'http_requests', 'HTTP requests');
    const gauge2 = registry2.create('gauge', 'memory_bytes', 'Memory usage');
    const histogram2 = registry2.create('histogram', 'response_time', 'Response time', [0.1, 0.5, 1.0]);

    // 添加相同的数据
    counter1.labels({ method: 'GET', status: '200' }).inc(100);
    counter1.labels({ method: 'POST', status: '201' }).inc(50);

    counter2.add(100, { method: 'GET', status: '200' });
    counter2.add(50, { method: 'POST', status: '201' });

    gauge1.set(1024 * 1024);
    gauge2.set(1024 * 1024);

    histogram1.observe(0.05);
    histogram1.observe(0.3);
    histogram1.observe(0.8);

    histogram2.observe(0.05);
    histogram2.observe(0.3);
    histogram2.observe(0.8);

    const result1 = registry1.serialize();
    const result2 = registry2.metrics();

    // 分别验证两个库的输出格式正确性
    // 验证 prometheus 的输出
    expect(result1).toContain('http_requests{method="GET",status="200"} 100');
    expect(result1).toContain('http_requests{method="POST",status="201"} 50');
    expect(result1).toContain('memory_bytes 1048576');
    expect(result1).toContain('response_time_count 3');
    expect(result1).toContain('response_time_sum 1.15');

    // 验证 prometheus-client 的输出
    expect(result2).toContain('http_requests{method="GET",status="200"} 100');
    expect(result2).toContain('http_requests{method="POST",status="201"} 50');
    expect(result2).toContain('memory_bytes 1048576');
    expect(result2).toContain('response_time_count 3');
    expect(result2).toContain('response_time_sum 1.15');

    // 注意：prometheus-client 会包含默认的计数器值，所以不能直接比较整个输出
    // 但两者都应该包含正确格式的指标数据
  });
});
