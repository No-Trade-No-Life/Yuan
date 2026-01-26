# Spec: vendor-gate 理财账户实现（Bench）

## 概述

本文档描述 vendor-gate 理财账户服务的性能基准要求、测量指标和验证方法。

## 性能目标

### 延迟目标

- `getEarnBalance` API 调用 P95 延迟 < 500ms（在正常网络条件下）。
- `getEarningAccountInfo` 函数 P95 处理时间 < 100ms（不含网络延迟）。
- 端到端账户信息查询（通过 `AccountActions` 服务）P95 延迟 < 800ms。

### 吞吐量目标

- 单个实例可支持至少 10 QPS 的理财账户查询请求。
- 在并发请求下，错误率（5xx）< 0.1%。

### 资源消耗

- 内存增长：单次调用内存增量 < 10 MB。
- CPU 使用：单次调用 CPU 时间 < 50 ms。

## 测量指标

### 关键指标

1. **API 调用延迟**：从发起 `callPrivate` 到收到完整响应的时间。
2. **数据处理延迟**：从收到 API 响应到完成 `IPosition` 映射的时间。
3. **端到端延迟**：从接收 `getAccountInfo` 请求到返回 positions 的时间。
4. **错误率**：API 调用失败的比例。
5. **内存使用**：处理过程中堆内存的峰值增量。

### 测量点

- `getEarnBalance` 函数入口和出口。
- `getEarningAccountInfo` 函数入口和出口。
- `account-actions-with-credential.ts` 中的 `getAccountInfo` 处理函数。

## 基准测试场景

### 场景 1: 单次调用基准

**目的**：测量单次请求的延迟和资源消耗。

**配置**：

- 模拟 API 响应包含 5 种理财币种（USDT, BTC, ETH, BNB, SOL）。
- 每个币种余额 > 0，包含冻结金额。
- 现货价格获取成功。

**测量**：

- 执行 100 次调用，计算平均、P50、P95、P99 延迟。
- 记录每次调用的内存增量（通过 `process.memoryUsage().heapUsed` 差值）。

### 场景 2: 并发调用压力测试

**目的**：验证服务在并发请求下的稳定性和吞吐量。

**配置**：

- 并发数：5、10、20。
- 总请求数：每个并发级别 1000 次请求。
- Mock API 延迟：固定 100ms 模拟网络往返。

**测量**：

- 总完成时间。
- 吞吐量（QPS）。
- 错误率。
- 延迟分布。

### 场景 3: 大数据量响应

**目的**：测试 API 返回大量理财币种时的性能。

**配置**：

- 模拟 API 响应包含 50 种理财币种（随机生成）。
- 每个币种余额随机，部分为 0。
- 现货价格获取部分失败（使用默认值 1）。

**测量**：

- 处理延迟与币种数量的关系。
- 内存消耗是否随数据量线性增长。

### 场景 4: 错误场景

**目的**：测试 API 失败或价格获取失败时的性能影响。

**配置**：

- Mock API 响应 500 错误（比例 10%）。
- Mock 价格获取超时（比例 20%）。

**测量**：

- 错误处理延迟（抛出异常的时间）。
- 整体错误率是否符合预期。

## 测试工具与环境

### 工具选择

- **基准测试框架**：使用 `benchmark.js` 或 `autocannon` 进行 HTTP 层测试。
- **内存分析**：使用 Node.js 内置 `process.memoryUsage()` 或 `v8` 模块。
- **Mock 服务器**：使用 `nock` 模拟 Gate.io API 响应。

### 环境要求

- Node.js 版本：与生产环境一致（如 v18.x）。
- 机器配置：至少 2 CPU、4 GB RAM。
- 网络：本地回环（避免网络波动影响）。

### 测试代码结构

```
apps/vendor-gate/bench/
├── earn-balance.bench.ts   # getEarnBalance 基准测试
├── earning-account.bench.ts   # getEarningAccountInfo 基准测试
├── integration.bench.ts       # 端到端服务测试
└── utils/
    ├── mock-data.ts          # 生成模拟数据
    └── metrics.ts            # 指标收集与报告
```

## 基准测试实施步骤

### 1. 准备 Mock 数据

```typescript
// bench/utils/mock-data.ts
export function generateEarnBalances(count: number): EarnBalance[] {
  const currencies = ['USDT', 'BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'DOT', 'XRP', 'DOGE', 'MATIC'];
  return Array.from({ length: count }, (_, i) => ({
    currency: currencies[i % currencies.length] + (i > currencies.length ? `_${i}` : ''),
    amount: (Math.random() * 1000).toFixed(8),
    frozen: (Math.random() * 100).toFixed(8),
  }));
}
```

### 2. 实现基准测试用例

```typescript
// bench/finance-balance.bench.ts
import benchmark from 'benchmark';
import { getEarnBalance } from '../src/api/private-api';
import { mockCredential } from './utils/mock-data';

// Mock callPrivate 函数
jest.mock('../src/api/http-client', () => ({
  requestPrivate: jest.fn().mockResolvedValue(generateEarnBalances(5)),
}));

const suite = new benchmark.Suite();

suite.add('getEarnBalance with 5 currencies', {
  defer: true,
  fn: (deferred) => {
    getEarnBalance(mockCredential, {}).then(() => deferred.resolve());
  },
});

suite.on('cycle', (event) => {
  console.log(String(event.target));
});

suite.run({ async: true });
```

### 3. 运行基准测试

```bash
cd apps/vendor-gate
npx ts-node bench/finance-balance.bench.ts
```

## 通过标准

### 性能标准

1. **延迟**：`getEarningAccountInfo` P95 延迟 < 100ms（在 mock API 延迟 100ms 条件下）。
2. **吞吐量**：单实例支持至少 10 QPS，且延迟增长不超过 50%（从 1 到 10 并发）。
3. **内存**：单次调用内存增量 < 10 MB，且无内存泄漏（连续 1000 次调用后内存增长 < 20 MB）。
4. **错误率**：在正常场景下错误率为 0%；在错误场景下，错误处理不导致进程崩溃。

### 资源标准

1. **CPU**：单次调用 CPU 使用率不超过 1 个核心的 10%。
2. **GC 影响**：垃圾回收暂停时间可接受（< 50ms）。

## 优化建议

若未达到性能目标，可考虑以下优化：

### 1. 并行化价格获取

当前实现中，每个币种的价格获取是串行的（通过 `Promise.all`）。可改为批量获取所有币种的价格（如果 API 支持），或使用缓存减少重复请求。

### 2. 缓存理财余额

理财余额变化较慢，可缓存 API 响应（如 5 分钟），减少对外部 API 的调用。

### 3. 懒加载价格映射

对于余额为 0 的币种，跳过价格获取，直接过滤。

### 4. 使用更高效的数据结构

`positions` 数组的构建和过滤可使用 `Array.prototype.filter` 和 `map`，确保代码简洁且性能可接受。

## 监控与告警

### 生产环境监控指标

- `vendor_gate_finance_api_duration_seconds`：API 调用延迟直方图。
- `vendor_gate_earning_account_positions_count`：返回的理财 position 数量。
- `vendor_gate_finance_api_errors_total`：API 错误计数器。

### 告警阈值

- P95 延迟 > 1s 持续 5 分钟。
- 错误率 > 1% 持续 2 分钟。
- 内存使用 > 500 MB（针对整个进程）。

## 附录

### 基准测试报告模板

```
# 基准测试报告：vendor-gate 理财账户服务

## 测试环境
- Node.js: v18.17.0
- 机器: 4 CPU, 8 GB RAM
- 测试时间: 2026-01-24

## 场景 1: 单次调用
- 平均延迟: 120ms
- P95 延迟: 180ms
- 内存增量: 2.5 MB

## 场景 2: 并发调用 (10并发)
- 吞吐量: 85 QPS
- 错误率: 0%
- P95 延迟: 220ms

## 结论
符合所有性能目标，可以上线。
```
