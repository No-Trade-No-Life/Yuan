# Walkthrough Report - vendor-tokenbucket-proxy-ip (impl)

## 目标与范围

- 目标：落地 RFC v2 方案，在代理模式下实现“按权重优先可承载组 + 逐候选主动 acquire”的限流与路由一体化，确保 `bucketKey` 与 `labels.ip` 同源。
- 范围（绑定本轮 Scope）：
  - `libraries/http-services/src/proxy-ip.ts`
  - `libraries/http-services/src/client.ts`
  - `libraries/http-services/src/__tests__/proxy-ip.test.ts`
  - `libraries/http-services/src/__tests__/client.test.ts`
  - `libraries/http-services/etc/http-services.api.md`
  - `apps/http-proxy/src/index.ts`
  - `apps/vendor-binance/src/api/client.ts`
  - `apps/vendor-binance/src/api/public-api.ts`
  - `apps/vendor-binance/src/api/private-api.ts`

## 设计摘要

- RFC：`/Users/c1/Work/Yuan/.legion/tasks/vendor-tokenbucket-proxy-ip/docs/rfc.md`
- 最终 RFC 复审：`/Users/c1/Work/Yuan/.legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-rfc.md`
- 方案主线（问题 -> 方案）：
  - 问题：旧流程先 RR 选 IP 再单次 `acquireSync(weight)`，对实时余量不敏感，导致高权重请求更易失败、全局容量利用不足。
  - 方案：在 `http-services` 集中提供 `acquireProxyBucket`，先按 `read() >= weight` 的候选优先尝试，再 fallback 到其余候选；并把 route/request 错误阶段化，避免语义混淆。
  - 一致性：vendor 仅消费 `{ ip, terminalId, bucketKey }` 结果，确保限流 key、路由标签与实际代理出口绑定。

## 关键实现（按模块）

### 1) http-services: proxy 选择与主动限流

- `libraries/http-services/src/proxy-ip.ts`
  - 新增 `acquireProxyBucket(input)`：
    - 强制 `getBucketOptions(baseKey)` 作为 options 唯一来源；缺失时返回 `E_BUCKET_OPTIONS_CONFLICT`。
    - 只在可信代理集合中选目标（`TRUSTED_HTTP_PROXY_TERMINAL_IDS` + `ip_source=http-services`）。
    - 按 `baseKey` 维护独立 RR 光标，先试 `available >= weight` 的候选，再试其余候选。
    - `SEMAPHORE_INSUFFICIENT_PERMS` 视为可恢复容量不足，自动切下个候选；全部失败返回 `E_PROXY_BUCKET_EXHAUSTED`。
  - 新增 options 冲突防护：
    - 对同 `bucketKey` 记录 options 指纹，冲突时递增 `bucket_options_conflict_total{base_key,bucket_key}` 并返回 `E_BUCKET_OPTIONS_CONFLICT`。
  - 保留并增强 proxy IP 缓存与信任边界：
    - `listHTTPProxyIps`/watcher 缓存、dispose 清理、缺失标签限频日志。

### 2) http-services: route/request 错误阶段化

- `libraries/http-services/src/client.ts`
  - 路由失败（`requestForResponse` 抛错）统一映射 `E_PROXY_TARGET_NOT_FOUND`，`stage=route`。
  - 代理响应异常（`code != 0` 或无 data）统一映射 `E_PROXY_REQUEST_FAILED`，`stage=request`。

### 3) http-services: 测试与 API 导出

- `libraries/http-services/src/__tests__/proxy-ip.test.ts`
  - 覆盖优先组选择、acquire 失败切换、空池、全失败、options 冲突、baseKey 隔离、allowlist fail-closed、内部异常映射、同 IP 绑定 trusted terminal。
- `libraries/http-services/src/__tests__/client.test.ts`
  - 覆盖 route/request 错误码边界，验证阶段语义。
- `libraries/http-services/etc/http-services.api.md`
  - API report 同步新增 `acquireProxyBucket`、`AcquireProxyBucketInput`、`AcquireProxyBucketResult`。

### 4) http-proxy: 标签可信来源收敛

- `apps/http-proxy/src/index.ts`
  - 启动时 `computeAndInjectProxyIp` 注入本机出口 IP。
  - 仅当 `ip_source === http-services` 时才下发 `labels.ip`，否则记录告警并跳过，避免不可信标签参与路由。

### 5) vendor-binance: 请求上下文统一接入

- `apps/vendor-binance/src/api/client.ts`
  - 新增 `createRequestContext(baseKey, weight)`：
    - 代理模式：调用 `acquireProxyBucket`，返回 `{ ip, terminalId, bucketKey, acquireWeight: 0 }`，避免重复扣减。
    - 直连模式：使用 `public_ip`（缺失则 `public-ip-unknown` + 限频日志），并本地执行 acquire。
  - 请求发送时把 `labels.ip`（可选带 `terminal_id`）写入 `fetch`，确保路由与 key 对齐。
- `apps/vendor-binance/src/api/public-api.ts`
- `apps/vendor-binance/src/api/private-api.ts`
  - 全量 API 调用统一改为使用 `requestContext.bucketKey` 与 `requestContext.acquireWeight`。

## 如何验证

### 命令

```bash
cd libraries/http-services && npx heft test --clean
rush build --to @yuants/vendor-binance --to @yuants/app-http-proxy
```

### 预期结果

- `libraries/http-services`：通过（4 suites, 35 total, 0 failed）。
- repo 定向构建：通过（`@yuants/vendor-binance` 与 `@yuants/app-http-proxy`）。
- 复审结论：`review-code PASS`，`review-security PASS`。

## Benchmark 结果或门槛说明

- 本轮实现未新增独立 benchmark 产物，且未提供可复现的 impl 基准数据。
- 门槛说明：以功能正确性与回归安全为主，验收门槛由单测通过 + 定向构建通过 + code/security review PASS 组成。

## 可观测性

- 冲突与错误：
  - `bucket_options_conflict_total{base_key,bucket_key}`（options 漂移检测）。
  - error payload 统一包含 `stage` 与 `reason`，用于区分 `pool/acquire/route/request`。
- Binance 侧业务指标：
  - `binance_api_request_total`。
  - `binance_api_used_weight`。
- 运行日志：
  - `http-services` 对空 allowlist、未信任 terminal、缺失/不可信 IP 标签做限频日志。
  - `http-proxy` 启动时打印最终 labels，便于确认 `labels.ip` 注入状态。

## 风险与回滚

- 风险：
  - `TRUSTED_HTTP_PROXY_TERMINAL_IDS` 未配置或配置错误时会 fail-closed，导致 `E_PROXY_TARGET_NOT_FOUND`。
  - `public_ip` 缺失时落到 `public-ip-unknown`，可能带来跨终端桶共享。
  - 同 `bucketKey` 配置不一致会触发冲突终止（`E_BUCKET_OPTIONS_CONFLICT`），需排查配置来源。
- 回滚：
  - 优先回滚到上一稳定版本（恢复旧 RR/旧 key 行为）。
  - 若需保守运行，可短期将代理链路切换到旧调用路径并观察错误率恢复。

## 未决项与下一步

- 为 `public-ip-unknown` 提供更强隔离 fallback（如拼接 terminal 维度）以降低串桶风险。
- 补充 impl 级 benchmark（高并发 + 多权重混合流量）并固化阈值。
- 把 `stage/error_code` 聚合看板接入告警策略，形成完整 SLO 回归门禁。
