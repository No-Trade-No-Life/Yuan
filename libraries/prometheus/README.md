# @yuants/prometheus

这是一个为现代 JavaScript 应用设计的高性能、跨平台的 Prometheus 指标库。

## 特性

- 🚀 **高性能**: 使用 curry 化预计算标签键，最小化运行时开销
- 🌐 **跨平台**: 兼容 Browser / NodeJS / 各种 JavaScript 环境，只使用标准 JS 功能
- 🏷️ **Curry 化标签**: 在多次设置度量值之间缓存标签拼接字符串
- 📊 **完整指标类型**: 支持 Counter、Gauge、Histogram 三种标准 Prometheus 指标
- 🔧 **灵活管理**: 支持注册表管理、数据删除、重置和序列化

## 安装

```bash
npm install @yuants/prometheus
```

## 快速开始

### 基本使用

```typescript
import { createRegistry } from '@yuants/prometheus';

// 创建注册表
const registry = createRegistry();

// 创建计数器
const requests = registry.counter('http_requests', 'Total HTTP requests');
requests.inc(); // 增加 1
requests.add(5); // 增加 5

// 创建仪表盘
const memory = registry.gauge('memory_usage', 'Memory usage in bytes');
memory.set(1024 * 1024); // 设置值
memory.inc(); // 增加 1
memory.dec(); // 减少 1

// 创建直方图
const latency = registry.histogram('latency_seconds', 'Request latency', [0.1, 0.5, 1.0]);
latency.observe(0.05);
latency.observe(0.3);

// 序列化输出
console.log(registry.serialize());
```

### 使用标签

```typescript
const requests = registry.counter('http_requests', 'HTTP requests');

// 使用标签
const getRequests = requests.labels({ method: 'GET', status: '200' });
const postRequests = requests.labels({ method: 'POST', status: '201' });

getRequests.inc(100);
postRequests.inc(50);

// Curry 化标签链
const apiRequests = requests
  .labels({ service: 'api' })
  .labels({ version: 'v1' })
  .labels({ environment: 'production' });

apiRequests.inc(25);
```

### 数据管理

```typescript
// 删除特定标签组合的数据
registry.delete('http_requests', { method: 'GET', status: '200' });

// 删除所有 http_requests 数据
registry.delete('http_requests');

// 清空所有数据
registry.clear();

// 重置所有数据为初始值
registry.reset();
```

## API 文档

### Registry

#### `createRegistry(): IRegistry`

创建新的指标注册表。

#### `registry.counter(name: string, help: string): Counter`

创建并注册计数器。

#### `registry.gauge(name: string, help: string): Gauge`

创建并注册仪表盘。

#### `registry.histogram(name: string, help: string, buckets?: number[]): Histogram`

创建并注册直方图。如果不提供桶，使用默认桶：`[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]`

#### `registry.delete(name: string, labels?: Record<string, string>): void`

删除特定指标的数据。

#### `registry.clear(): void`

清空所有数据。

#### `registry.reset(): void`

重置所有数据为初始值。

#### `registry.serialize(): string`

序列化所有指标为 Prometheus 文本格式。

### Counter

#### `counter.inc(value = 1): void`

增加计数器值。

#### `counter.add(value: number): void`

增加指定值（必须 >= 0）。

#### `counter.set(value: number): void`

设置计数器值。

#### `counter.get(): number`

获取当前值。

#### `counter.delete(): void`

删除此标签组合的数据。

#### `counter.labels(labelObj: Labels): Counter`

返回带有新标签的计数器实例。

### Gauge

#### `gauge.inc(value = 1): void`

增加仪表盘值。

#### `gauge.dec(value = 1): void`

减少仪表盘值。

#### `gauge.add(value: number): void`

增加指定值。

#### `gauge.sub(value: number): void`

减少指定值。

#### `gauge.set(value: number): void`

设置仪表盘值。

#### `gauge.get(): number`

获取当前值。

#### `gauge.delete(): void`

删除此标签组合的数据。

#### `gauge.labels(labelObj: Labels): Gauge`

返回带有新标签的仪表盘实例。

### Histogram

#### `histogram.observe(value: number): void`

观察一个值并更新直方图。

#### `histogram.get(): HistogramData`

获取直方图数据。

#### `histogram.delete(): void`

删除此标签组合的数据。

#### `histogram.labels(labelObj: Labels): Histogram`

返回带有新标签的直方图实例。

## 性能特点

### 标签键预计算

```typescript
// 在创建时预计算，避免运行时重复计算
const makeLabelKey = (name: string, labels: Labels): string => {
  const labelStr = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${v}"`)
    .join(',');
  return labelStr ? `${name}{${labelStr}}` : name;
};
```

### Curry 化性能优势

```typescript
// 传统方式 - 每次都需要重新计算标签
counter.inc({ method: 'GET', status: '200' }, 1);
counter.inc({ method: 'GET', status: '200' }, 1);

// Curry 化方式 - 标签键在创建时预计算
const getCounter = counter.labels({ method: 'GET', status: '200' });
getCounter.inc(1); // 快速操作，标签键已缓存
getCounter.inc(1); // 再次快速操作
```

## 序列化格式

库输出标准的 Prometheus 文本格式：

```
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 100
http_requests_total{method="POST",status="201"} 50

# HELP latency_seconds Request latency
# TYPE latency_seconds histogram
latency_seconds_count 3
latency_seconds_sum 1.15
latency_seconds_bucket{le="0.1"} 1
latency_seconds_bucket{le="0.5"} 2
latency_seconds_bucket{le="1.0"} 3
latency_seconds_bucket{le="+Inf"} 3
```

## 测试

运行测试：

```bash
npm run build
```

## 许可证

MIT
