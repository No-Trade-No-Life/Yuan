# RFC: Proxy IP TokenBucket v2（按权重负载均衡 + 主动限流）

Status: Draft (Design Only)
Target Path: `/Users/c1/Work/Yuan/.legion/tasks/vendor-tokenbucket-proxy-ip/docs/rfc.md`
Date: 2026-02-07

## Abstract

本文定义多 `http-proxy` IP 场景下的 v2 协议：在发送请求前先完成 IP 选择与令牌获取，优先尝试可承载当前 `weight` 的 bucket，降低 `acquireSync(weight)` 失败与上游 429 概率。本文是实现阶段唯一设计真源。

## Motivation

现网流程是先 RR 选 IP，再对该 IP 执行一次 `acquireSync(weight)`。在多 IP、混合权重流量下，该流程对实时余量不敏感，导致局部耗尽与全局容量浪费。

### Problem / Constraints（来自现状调研）

1. `tokenBucket` 以 `bucketId` 全局共享；同 `bucketId` 后续 options 会被忽略；`acquireSync(tokens)` 令牌不足即抛错；`read()` 无 ETA。
2. `fetch` 使用 `labels.ip` 路由；当 `labels.ip` 无匹配目标时会在路由阶段失败。
3. 现网 vendor 的 bucket options 来源在 vendor 侧，若 helper 使用隐式默认 options 会与现网容量语义漂移。

## Goals & Non-Goals

### Goals

- 在 `USE_HTTP_PROXY=true` 时，请求 MUST 在发送前完成“选 IP + acquire”。
- 调度 MUST 优先尝试“当前 `read() >= weight` 的候选组”，再尝试其余候选组。
- `bucketKey` 中 IP 与 `fetch.labels.ip` MUST 同源，确保限流与路由一致。
- 首次落地 `apps/vendor-binance`，随后 MAY 推广到其他 vendor。

### Non-Goals

- 不修改 `tokenBucket` 底层算法与 semaphore 机制。
- 不改造交易所业务语义（签名、业务错误处理、业务重试）。
- 不引入中心化存储；调度状态仅进程内维护。

## Definitions

- `BaseKey`: 现网 vendor 的限流基键。
- `IPPool`: 当前可用 proxy IP 集合，来源于 `http-services`。
- `BucketKey`: `encodePath([BaseKey, ip])`。
- `BucketOptionsSource`: bucket options 来源函数，定义为 `getBucketOptions(baseKey)`。
- `Stage`: 错误归属阶段，取值 `{pool|acquire|route|request}`。
- `Mode`: 灰度模式，固定为 `legacy_rr_single_try` / `rr_multi_try` / `helper_acquire_proxy_bucket`。

## Protocol Overview（端到端流程）

1. vendor 计算 `baseKey` 与 `weight`，并传入 `getBucketOptions(baseKey)`。
2. `USE_HTTP_PROXY=true` 时，helper 拉取 `IPPool` 并过滤非法/重复 IP。
3. helper 按“可承载组优先”构造候选顺序：先 `read() >= weight` 组，再其余组。
4. helper 对候选逐个执行 `acquireSync(weight)`；成功即返回 `{ ip, bucketKey }`。
5. helper 成功后，vendor MUST 使用返回 `ip` 写入 `labels.ip` 并发起请求。
6. 失败按阶段映射错误码，不允许跨阶段吞并错误码。

## 设计选项与推荐

### 方案 A：`rr_multi_try`

- RR 产出候选顺序，逐个尝试 acquire，失败切下一候选。
- 优点：改动较小。
- 缺点：状态分散在 vendor，易产生行为漂移。

### 方案 B：`helper_acquire_proxy_bucket`（推荐）

- 在 `libraries/http-services` 提供统一 helper，集中维护候选选择、cooldown、错误映射、观测。
- vendor 仅消费 `{ip, bucketKey}` 并发请求。

### 方案 C：`legacy_rr_single_try`（仅回滚）

- 现网旧行为：RR 选一个 IP，只尝试一次 acquire。
- 不推荐继续演进，仅用于故障回滚。

## State Machine

States:

- `S0_INIT`: 输入 `(baseKey, weight, terminal, getBucketOptions)`。
- `S1_POOL_READY`: 得到有效 `IPPool`。
- `S2_SELECT`: 构造候选顺序（可承载组优先 + cooldown 过滤）。
- `S3_ACQUIRE`: 对候选执行 `acquireSync(weight)`。
- `S4_ROUTE`: 写入 `labels.ip` 并由 `fetch` 路由。
- `S5_REQUEST`: 已路由到目标代理，执行请求。
- `S_DONE`: 请求完成。
- `S_ERR`: 错误终态。

Transitions:

- `S0_INIT -> S1_POOL_READY`: 进入 proxy 分支。
- `S1_POOL_READY -> S_ERR`: `IPPool` 为空（`E_PROXY_TARGET_NOT_FOUND`）。
- `S1_POOL_READY -> S2_SELECT`: 有候选。
- `S2_SELECT -> S_ERR`: 候选遍历完（`E_PROXY_BUCKET_EXHAUSTED`）。
- `S2_SELECT -> S3_ACQUIRE`: 选到下一候选。
- `S3_ACQUIRE -> S2_SELECT`: acquire 不足或可恢复失败。
- `S3_ACQUIRE -> S4_ROUTE`: acquire 成功。
- `S4_ROUTE -> S_ERR`: 路由无匹配（`E_PROXY_TARGET_NOT_FOUND`）。
- `S4_ROUTE -> S5_REQUEST`: 路由成功。
- `S5_REQUEST -> S_ERR`: 代理网络/上游失败（`E_PROXY_REQUEST_FAILED`）。
- `S5_REQUEST -> S_DONE`: 请求完成。

## Data Model

### AcquireProxyBucketInput

```ts
type AcquireProxyBucketInput = {
  baseKey: string;
  weight: number;
  terminal: ITerminal;
  getBucketOptions: (baseKey: string) => TokenBucketOptions;
};
```

- 兼容策略：本 RFC 在“`bucketOptions` 直接传入 / `getBucketOptions(baseKey)` 回调”二选一中固定采用回调方案。
- 约束：调用方若为固定 options，MUST 通过回调返回常量；MUST NOT 使用 helper 内置隐式默认 options。

### BucketRuntimeState

- `bucketKey: string`
- `tokensAvailable: number`
- `lastAcquireResult: "ok" | "insufficient" | "error"`
- `cooldownUntil?: number`

### 冲突观测

- `bucket_options_conflict_total{base_key,bucket_key}`: counter
- 触发条件：同 `bucketKey` 首次 options 与后续 options 指纹不一致。

## Requirements

- `R1` 代理模式下，helper MUST 在请求发送前完成 IP 选择与 `acquireSync(weight)`。
- `R2` helper MUST 使用 `getBucketOptions(baseKey)` 作为唯一 options 来源。
- `R3` helper MUST NOT 使用隐式默认 options；options 来源 MUST 与现网 vendor 一致。
- `R4` 被选中 IP 的 `bucketKey` MUST 为 `encodePath([baseKey, ip])`。
- `R5` 请求 `labels.ip` MUST 与 `bucketKey` 的 ip 完全一致。
- `R6` 单次请求若某 IP acquire 失败，MUST 尝试下一候选 IP。
- `R7` 候选全部失败时，MUST 返回 `E_PROXY_BUCKET_EXHAUSTED`，且 MUST NOT 外发请求。
- `R8` `IPPool` 为空时，MUST 返回 `E_PROXY_TARGET_NOT_FOUND`。
- `R9` `SEMAPHORE_INSUFFICIENT_PERMS` MUST 映射为可恢复容量失败，不得作为未分类系统异常抛出。
- `R10` helper MUST 先尝试 `read() >= weight` 候选组，再尝试其余候选组。
- `R11` 对同一 `baseKey`，helper MUST 维护独立选择状态，避免跨桶串扰。
- `R12` 同 `bucketKey` 出现 options 冲突时，helper MUST 增加 `bucket_options_conflict_total`，并 MUST 返回 `E_BUCKET_OPTIONS_CONFLICT` 终止本次流程。
- `R13` `USE_HTTP_PROXY=false` 时，MUST 保持现有直连限流路径，不进入 proxy 调度。

## Error Semantics

### 错误阶段归属表

| stage     | 触发条件                              | MUST 返回错误码             | 可恢复性         |
| --------- | ------------------------------------- | --------------------------- | ---------------- |
| `pool`    | 无可用 proxy 服务或 `IPPool` 为空     | `E_PROXY_TARGET_NOT_FOUND`  | 可重试（长退避） |
| `acquire` | 候选均 acquire 失败 / cooldown 不可用 | `E_PROXY_BUCKET_EXHAUSTED`  | 可重试（短退避） |
| `acquire` | 同 `bucketKey` options 冲突           | `E_BUCKET_OPTIONS_CONFLICT` | 需修配置后重试   |
| `route`   | `labels.ip` 无匹配或路由解析失败      | `E_PROXY_TARGET_NOT_FOUND`  | 可重试（长退避） |
| `request` | 已路由后代理网络/上游失败             | `E_PROXY_REQUEST_FAILED`    | 按既有策略重试   |

### 边界封闭规则

- `R14` route 阶段失败（含 `labels.ip` 无匹配）MUST 映射为 `E_PROXY_TARGET_NOT_FOUND`。
- `R15` `E_PROXY_REQUEST_FAILED` MUST 仅允许在 request 阶段产生。

### 重试语义

- `E_PROXY_BUCKET_EXHAUSTED` SHOULD 使用短退避 + 抖动重试。
- `E_PROXY_TARGET_NOT_FOUND` SHOULD 使用长退避并触发告警。
- `E_PROXY_REQUEST_FAILED` MAY 按 vendor 既有请求重试策略执行。
- `E_BUCKET_OPTIONS_CONFLICT` MUST NOT 自动重试。

## Security Considerations

- `labels.ip` MUST 仅来自 helper 选择结果，不接受外部透传。
- proxy IP 来源 MUST 限定 `ip_source=http-services`。
- IP 文本 MUST 通过格式校验（IPv4/IPv6）；非法值不得参与 `bucketKey`。
- MUST 控制 key cardinality，防止异常标签放大 bucket 数量。
- MUST 对错误日志做限频，避免失败风暴导致资源耗尽。

## Backward Compatibility & Rollout

### 模式命名（固定）

- `legacy_rr_single_try`: 现网旧行为，仅单次 acquire。
- `rr_multi_try`: 方案 A，RR 候选 + 多次 acquire。
- `helper_acquire_proxy_bucket`: 方案 B，统一 helper。

### 默认值 / 灰度值 / 回滚值

- 默认值（新部署）: `rr_multi_try`。
- 灰度值（目标）: `helper_acquire_proxy_bucket`。
- 回滚值（故障）: `legacy_rr_single_try`。

### 最小可执行灰度步骤

1. 在 `vendor-binance` 选定 1-2 个高频 endpoint，模式从 `rr_multi_try` 切到 `helper_acquire_proxy_bucket`。
2. 连续观测 30 分钟窗口：`E_PROXY_BUCKET_EXHAUSTED`、`E_PROXY_TARGET_NOT_FOUND`、429、请求成功率。
3. 指标劣化超阈值时，5 分钟内切回 `legacy_rr_single_try`，并保留同窗口对比数据。

## Observability

必须输出以下指标：

- `proxy_bucket_acquire_total{base_key,ip,result}`。
- `proxy_bucket_fallback_total{base_key}`（候选切换次数）。
- `proxy_request_total{base_key,ip,status_code}`。
- `proxy_error_total{stage,error_code,base_key}`。
- `bucket_options_conflict_total{base_key,bucket_key}`。

要求：错误类指标 MUST 包含 `stage={pool|acquire|route|request}` 与 `error_code` 维度。

## Testability

每条 MUST 需求映射测试断言：

- `T-R1`: 发送前必须先拿到 `{ip,bucketKey}`。
- `T-R2`: helper 使用 `getBucketOptions(baseKey)`；缺失回调时构造失败。
- `T-R3`: helper 无隐式默认 options；来源与现网 vendor 提供值一致。
- `T-R4`: `bucketKey == encodePath([baseKey, ip])`。
- `T-R5`: `labels.ip` 与 `bucketKey` 的 ip 一致。
- `T-R6`: 首候选 acquire 失败后切换次候选并成功。
- `T-R7`: 候选全失败返回 `E_PROXY_BUCKET_EXHAUSTED` 且无外发请求。
- `T-R8`: 空池返回 `E_PROXY_TARGET_NOT_FOUND`。
- `T-R9`: `SEMAPHORE_INSUFFICIENT_PERMS` 被映射为容量失败。
- `T-R10`: 存在 `read() >= weight` 候选时优先尝试该组。
- `T-R11`: 不同 `baseKey` 的状态互不影响。
- `T-R12`: 同 `bucketKey` options 冲突时，`bucket_options_conflict_total` +1 且返回 `E_BUCKET_OPTIONS_CONFLICT`。
- `T-R13`: 非 proxy 模式不触发 proxy 调度。
- `T-R14` (负例): acquire 成功后若 `labels.ip` 无匹配，必须返回 `E_PROXY_TARGET_NOT_FOUND`。
- `T-R15` (负例): request 阶段之前不得返回 `E_PROXY_REQUEST_FAILED`。

覆盖场景至少包括：高权重请求、多 IP 余量不均、IP 下线、空池、route 无匹配、options 冲突。

## Open Questions

1. `cooldown` 参数是否需要按交易所或 endpoint 分层配置（当前先固定默认值）？
2. `acquireProxyBucket` 是否需要返回 `attemptedIps` 用于调试追踪（不影响主流程）？

## Plan

### 核心流程

1. 在 `http-services` 暴露统一入口：`acquireProxyBucket(input)`，强制 `getBucketOptions` 输入。
2. helper 执行：`IPPool` 获取 -> 可承载组优先 -> acquire 多次尝试 -> 返回 `{ip,bucketKey}` 或标准错误。
3. vendor 仅消费返回值并发请求，错误按阶段归属表统一处理。

### 接口定义

- `listHTTPProxyIps(terminal): string[]`（现有）
- `selectHTTPProxyIpRoundRobinAsync(terminal): Promise<string>`（现有，回滚模式保留）
- `acquireProxyBucket(input: AcquireProxyBucketInput): { ip: string; bucketKey: string } | throws ProxyBucketError`（新增）

### 文件变更明细（设计范围）

- `libraries/http-services`: 增加 `acquireProxyBucket` 与冲突观测、阶段错误映射。
- `apps/vendor-binance`: 接入 helper 与模式开关（仅设计约束，不含实现细节）。
- `apps/http-proxy`: 维持 `tags.ip + ip_source=http-services` 契约。

### 验证策略

1. 单测覆盖 `T-R1` 到 `T-R15`（含两条负例）。
2. 集成测试验证 `bucketKey.ip == labels.ip` 与 stage 错误码边界。
3. 灰度验证按 30 分钟窗口执行，出现劣化按回滚值切换。
