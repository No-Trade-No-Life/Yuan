# Code Review Report

## 结论

**FAIL** - 存在必须修复的阻塞问题

## Blocking Issues

### 1. `server.ts:255-267` - INVALID_URL 错误未记录 `errors_total` 指标

**严重级别**: 🔴 阻塞 - 违反 RFC R9 规范

**问题描述**:
在 catch 块中处理错误时，仅记录了 `requestsTotal`，但未记录 `errorsTotal`。根据 RFC 4.4 节定义，`INVALID_URL` 错误类型应映射到 `error_type: 'validation'`，并调用 `errorsTotal.labels({ error_type: 'validation' }).inc()`。

**RFC 规范引用**:

> **R9**：`errorsTotal.labels({error_type}).inc()` 必须在捕获异常时调用。

**错误码映射表 (RFC 4.4)**:
| error_code | error_type |
|------------|-----------|
| `none` | - |
| `TIMEOUT` | timeout |
| `FORBIDDEN` | security |
| `FETCH_FAILED` | network |
| `INVALID_URL` | **validation** ← 缺失 |
| `RESPONSE_TOO_LARGE` | security |

**当前代码行为**:

```typescript
// server.ts:255-267
} catch (err: any) {
  errorCode = (err.message || '').split(':')[0] || 'FETCH_FAILED';
  statusCode = 0;

  // 仅记录 requestsTotal，缺失 errorsTotal
  requestsTotal.labels({
    method,
    status_code: '0',
    error_code: errorCode,
  }).inc();

  throw err;
}
```

**影响**:

- `http_proxy_errors_total` 指标将缺少 `validation` 类型的错误统计
- Grafana Dashboard 的 "Errors by Type" 饼图无法显示 URL 格式错误占比
- 无法通过 `sum(rate(http_proxy_errors_total{error_type="validation"}[5m]))` 监控无效 URL 攻击

**修复建议**:
在 catch 块中添加 `errorsTotal` 记录：

```typescript
} catch (err: any) {
  errorCode = (err.message || '').split(':')[0] || 'FETCH_FAILED';
  statusCode = 0;

  // R9: 根据错误类型记录 errors_total
  const errorTypeMap: Record<string, string> = {
    'TIMEOUT': 'timeout',
    'FORBIDDEN': 'security',
    'FETCH_FAILED': 'network',
    'INVALID_URL': 'validation',
    'RESPONSE_TOO_LARGE': 'security',
  };
  const errorType = errorTypeMap[errorCode] || 'unknown';
  errorsTotal.labels({ error_type: errorType }).inc();

  // R6: 记录请求总数
  requestsTotal.labels({
    method,
    status_code: '0',
    error_code: errorCode,
  }).inc();

  throw err;
}
```

---

## 建议（非阻塞）

### 2. `server.test.ts` - 测试断言依赖固定的 mock.results 索引

**严重级别**: 🟡 建议改进 - 测试稳定性风险

**问题描述**:
多个测试用例使用 `mock.results[0].value` 或 `mock.results[1].value` 来获取特定的 metric 实例，这种写法在以下情况下会失效：

- 新增 metric 类型导致初始化顺序变化
- 测试中多次调用 metrics 创建方法

**问题代码**:

```typescript
// server.test.ts:313-316
const errorsTotalCounter = mockMetrics.counter.mock.results[1].value;
expect(errorsTotalCounter.labels).toHaveBeenCalledWith({ error_type: 'timeout' });
expect(errorsTotalCounter.inc).toHaveBeenCalled();

// server.test.ts:189-190
const requestsTotalCounter = mockMetrics.counter.mock.results[0].value;
expect(requestsTotalCounter.labels).toHaveBeenCalledWith({
```

**建议修复**:
使用 `mock.calls` 定位正确的调用，或创建具名 helper 函数：

```typescript
// 创建 helper 获取指定 metric
const getMetricByName = (name: string) => {
  const calls = mockMetrics.counter.mock.calls;
  const call = calls.find(([metricName]) => metricName === name);
  return call ? { labels: call[2]?.labels } : null;
};

// 测试中使用
const requestsTotalCounter = getMetricByName('http_proxy_requests_total');
expect(requestsTotalCounter?.labels).toHaveBeenCalledWith({...});
```

---

### 3. `server.ts:271` - 使用 `Date.now()` 而非 `performance.now()`

**严重级别**: 🟢 轻微 - 精度建议

**问题描述**:
当前使用 `Date.now()` 测量请求延迟，虽然功能正确，但精度较低（毫秒级），可能无法准确捕获极短请求的延迟分布。

**当前代码**:

```typescript
finally {
  const duration = (Date.now() - startTime) / 1000;
  requestDuration.labels({ method }).observe(duration);
  activeRequests.dec();
}
```

**建议修复**:

```typescript
finally {
  const duration = (performance.now() - startTime) / 1000;
  requestDuration.labels({ method }).observe(duration);
  activeRequests.dec();
}
```

**注意**: 需要确认 `@yuants/protocol` 的 metrics 库是否接受 `performance.now()` 返回的高精度时间值。

---

### 4. `server.ts:256-268` - 错误码解析逻辑可读性

**严重级别**: 🟢 轻微 - 代码清晰度

**问题描述**:
当前错误码解析逻辑使用链式 split 操作，不够直观：

```typescript
errorCode = (err.message || '').split(':')[0] || 'FETCH_FAILED';
```

**建议修复**:

```typescript
const errorMessage = err.message || '';
const colonIndex = errorMessage.indexOf(':');
errorCode = colonIndex > 0 ? errorMessage.substring(0, colonIndex) : errorMessage || 'FETCH_FAILED';
```

---

## 通过项

### ✅ Metrics 初始化符合 RFC 规范

| 指标                                  | 类型      | Labels                                                           | 实现状态 |
| ------------------------------------- | --------- | ---------------------------------------------------------------- | -------- |
| `http_proxy_requests_total`           | Counter   | method, status_code, error_code                                  | ✅       |
| `http_proxy_request_duration_seconds` | Histogram | method, buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30] | ✅       |
| `http_proxy_active_requests`          | Gauge     | -                                                                | ✅       |
| `http_proxy_errors_total`             | Counter   | error_type                                                       | ✅       |

### ✅ 采集点位置正确

- **R6**: `requestsTotal` 在请求结束时（成功/失败均）调用 ✅
- **R7**: `requestDuration` 在 finally 块中调用 ✅
- **R8**: `activeRequests.inc()` 在请求开始时调用，`activeRequests.dec()` 在 finally 块中调用 ✅
- **TIMEOUT/FETCH_FAILED/FORBIDDEN/RESPONSE_TOO_LARGE** 错误类型正确记录 `errorsTotal` ✅

### ✅ 安全性

- Label 使用预定义枚举值，无高基数风险 ✅
- `activeRequests.dec()` 在 finally 块中，保证执行 ✅

### ✅ 测试覆盖

- 正常 GET/POST 请求 metrics 记录 ✅
- 超时错误 metrics 记录 ✅
- 网络错误 metrics 记录 ✅
- FORBIDDEN 错误 metrics 记录 ✅
- RESPONSE_TOO_LARGE 错误 metrics 记录 ✅
- 异常情况下 activeRequests 正确递减 ✅

---

## 修复指导

### 优先级 1（必须修复）: INVALID_URL 错误记录

**文件**: `server.ts`
**行号**: 255-267
**修改内容**: 在 catch 块中添加 `errorsTotal` 记录逻辑

```typescript
// 修改前
} catch (err: any) {
  errorCode = (err.message || '').split(':')[0] || 'FETCH_FAILED';
  statusCode = 0;

  requestsTotal.labels({
    method,
    status_code: '0',
    error_code: errorCode,
  }).inc();

  throw err;
}

// 修改后
} catch (err: any) {
  errorCode = (err.message || '').split(':')[0] || 'FETCH_FAILED';
  statusCode = 0;

  // R9: 根据错误类型记录 errors_total
  const errorTypeMap: Record<string, string> = {
    'TIMEOUT': 'timeout',
    'FORBIDDEN': 'security',
    'FETCH_FAILED': 'network',
    'INVALID_URL': 'validation',
    'RESPONSE_TOO_LARGE': 'security',
  };
  errorsTotal.labels({ error_type: errorTypeMap[errorCode] || 'unknown' }).inc();

  // R6: 记录请求总数
  requestsTotal.labels({
    method,
    status_code: '0',
    error_code: errorCode,
  }).inc();

  throw err;
}
```

**测试补充**: 在 `server.test.ts` 中添加 INVALID_URL 错误的 `errorsTotal` 断言：

```typescript
it('should record metrics for INVALID_URL error (R6, R7, R8, R9)', async () => {
  // ... 现有代码 ...

  // R9: errorsTotal.inc() should be called with error_type 'validation'
  const errorsTotalCounter = mockMetrics.counter.mock.calls.find(
    (call) => call[0] === 'http_proxy_errors_total',
  )?.[2]?.labels;
  expect(errorsTotalCounter).toEqual({ error_type: 'validation' });
});
```

### 优先级 2（建议修复）: 测试稳定性

**文件**: `server.test.ts`
**修改内容**: 使用 `mock.calls` 替代 `mock.results` 索引

---

## 审查结论

- [ ] **通过** - 可以合并
- [x] **需修复** - 修复后重新审查
- [ ] **阻塞** - 修复完成前不能合并

**总结**: 存在 1 个阻塞问题（INVALID_URL 错误未记录 `errors_total`），需要在合并前修复。修复后需重新提交审查。
