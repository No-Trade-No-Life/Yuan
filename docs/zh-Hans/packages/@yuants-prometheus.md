# @yuants/prometheus

一个高性能、跨平台的 Prometheus 埋点库，专为现代 JavaScript 应用设计。

## 特性

- 🚀 **高性能**: 双重优化策略 - 预计算标签键 + 树形结构序列化缓存
- 🌐 **跨平台**: 零依赖纯 TypeScript 实现，兼容 Browser / NodeJS / 各种 JavaScript 环境
- 🏷️ **Curry 化标签**: 函数式编程范式，支持标签链式组合
- 📊 **完整指标类型**: 支持 Counter、Gauge、Histogram 三种标准 Prometheus 指标
- 🔧 **灵活管理**: 支持多注册表独立运行和高效序列化

## 设计理念

### 性能优化动机

#### 1. 预计算标签键 - 解决标签处理开销

**问题**: 在 Prometheus 指标中，标签组合可能非常多，每次操作都需要重新排序和字符串化标签会带来显著的性能开销（O(n log n)）。

**解决方案**: 在创建时预计算标签键，避免运行时重复计算：

```typescript
// 预计算标签键
const sortedLabels = sortLabels(baseLabels); // 排序确保一致性
const dataKey = labelsToString(sortedLabels); // 转换为字符串键
```

**效果**: 标签操作从 O(n log n) 降到 O(1)，在高频指标场景下性能提升显著。

#### 2. 树形结构缓存 - 解决序列化性能瓶颈

**问题**: 在高频指标更新的场景中，频繁序列化整个指标集会消耗大量 CPU（O(n)）。

**解决方案**: 使用树形结构存储，实现惰性序列化和智能缓存：

```typescript
// 树节点缓存序列化结果
private _cached: string | null = null;

// 只在数据变化时使缓存失效
invalidateAncestors() {
  for (let ptr = this.parent; ptr; ptr = ptr.parent) {
    ptr._cached = null;
  }
}
```

**效果**: 序列化操作从 O(n) 降到 O(1)（缓存命中时），大幅减少 CPU 消耗。

#### 3. 函数式 Curry 化 - 减少调用开销

**问题**: 传统方式每次调用都需要传递完整的标签对象，增加了调用开销和内存分配。

**解决方案**: 使用 curry 化创建预配置的指标实例：

```typescript
const labels = (additionalLabels: Labels): Counter => {
  const newLabels = { ...baseLabels, ...additionalLabels };
  return createCounter(registry, name, newLabels);
};
```

**效果**: 高频调用场景下显著减少参数传递开销，代码更简洁。

#### 4. 零依赖设计 - 实现真正的跨平台

**问题**: Node.js 特定的 Prometheus 客户端在浏览器环境中无法使用。

**解决方案**: 纯 TypeScript 实现，只使用标准 JavaScript 功能。

**效果**: 真正的跨平台兼容性，可在任何 JavaScript 环境中运行。

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

// 创建直方图（必须指定桶）
const latency = registry.histogram('latency_seconds', 'Request latency', [0.1, 0.5, 1.0]);
latency.observe(0.05);
latency.observe(0.3);

// 序列化输出
console.log(registry.serialize());
```

### 使用标签和 Curry 化

```typescript
const requests = registry.counter('http_requests', 'HTTP requests');

// 基础标签使用
const getRequests = requests.labels({ method: 'GET', status: '200' });
const postRequests = requests.labels({ method: 'POST', status: '201' });

getRequests.inc(100);
postRequests.inc(50);

// Curry 化标签链 - 性能优化关键！
const apiRequests = requests
  .labels({ service: 'api' })
  .labels({ version: 'v1' })
  .labels({ environment: 'production' });

apiRequests.inc(25);
```

### 多注册表独立运行

```typescript
// 每个注册表完全独立，适合微服务架构
const registry1 = createRegistry();
const registry2 = createRegistry();

const counter1 = registry1.counter('requests', 'Requests');
const counter2 = registry2.counter('requests', 'Requests');

counter1.inc(10);
counter2.inc(20);

// 各自独立序列化
console.log(registry1.serialize()); // 包含 requests 10
console.log(registry2.serialize()); // 包含 requests 20
```

## API 文档

### Registry

#### `createRegistry(): IRegistry`

创建新的指标注册表。

#### `registry.counter(name: string, help: string): Counter`

创建并注册计数器。

#### `registry.gauge(name: string, help: string): Gauge`

创建并注册仪表盘。

#### `registry.histogram(name: string, help: string, buckets: number[]): Histogram`

创建并注册直方图。**必须**提供桶配置。

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

#### `counter.labels(labelObj: Labels): Counter`

返回带有新标签的计数器实例（Curry 化）。

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

#### `gauge.labels(labelObj: Labels): Gauge`

返回带有新标签的仪表盘实例（Curry 化）。

### Histogram

#### `histogram.observe(value: number): void`

观察一个值并更新直方图。

#### `histogram.get(): HistogramData`

获取直方图数据。

#### `histogram.labels(labelObj: Labels): Histogram`

返回带有新标签的直方图实例（Curry 化）。

## 性能基准

### 标签预计算性能对比

```typescript
// 传统方式 - 每次都需要重新计算标签
counter.inc({ method: 'GET', status: '200' }, 1); // 每次 O(n log n)
counter.inc({ method: 'GET', status: '200' }, 1); // 每次 O(n log n)

// Curry 化方式 - 标签键在创建时预计算
const getCounter = counter.labels({ method: 'GET', status: '200' }); // 一次 O(n log n)
getCounter.inc(1); // 后续操作 O(1)
getCounter.inc(1); // 后续操作 O(1)
```

### 序列化缓存性能

```typescript
// 首次序列化 - 完整计算
const result1 = registry.serialize(); // O(n)

// 数据未变化时 - 使用缓存
const result2 = registry.serialize(); // O(1) - 缓存命中

// 部分数据变化 - 智能失效
counter.inc(1);
const result3 = registry.serialize(); // 只重新计算变化部分
```

## 序列化格式

库输出标准的 Prometheus 文本格式：

```
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 100
http_requests_total{method="POST",status="201"} 50

# HELP memory_usage Memory usage in bytes
# TYPE memory_usage gauge
memory_usage 1048576

# HELP latency_seconds Request latency
# TYPE latency_seconds histogram
latency_seconds_count 2
latency_seconds_sum 0.35
latency_seconds_bucket{le="0.1"} 1
latency_seconds_bucket{le="0.5"} 2
latency_seconds_bucket{le="1.0"} 2
latency_seconds_bucket{le="+Inf"} 2
```

## 使用场景

### 高频指标场景

适合需要处理大量指标更新的应用，如：

- 实时交易系统
- 高并发 Web 服务
- 流式数据处理

### 资源受限环境

适合运行在资源受限的环境，如：

- 边缘计算节点
- 移动端应用
- 浏览器环境

### 微服务架构

适合分布式系统中的每个服务实例独立收集指标。

## 构建和测试

运行构建和测试：

```bash
npm run build
```

## 许可证

MIT
