# RFC: TokenBucket Proxy IP Key

Status: Draft
Target: `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/rfc.md`
Date: 2026-02-04

## Abstract

为 USE_HTTP_PROXY 场景下的 vendor tokenBucket key 增加“目标 http-proxy 终端 ip 标签”维度，确保限流按真实出口 IP 生效，并保证 key 与实际代理路由一致。

## Motivation

当前 tokenBucket key 多以 host 或固定 key 作为维度。在 USE_HTTP_PROXY=true 时，请求会通过 app-http-proxy 终端出网，真实出口 IP 与 key 不一致，导致限流失真。

## Goals & Non-Goals

### Goals

- 在 USE_HTTP_PROXY=true 时，tokenBucket key 必须包含“目标 proxy 终端的 ip 标签”。
- 在非代理场景下使用本机 `terminal.terminalInfo.tags.public_ip`。
- key 的 ip 维度必须与请求使用的 `labels.ip` 一致。
- 先在 vendor-binance 落地验证，再推广到其他 vendor。

### Non-Goals

- 不改变现有 tokenBucket 限流算法与配额。
- 不改变 HTTPProxy 的负载均衡策略。
- 不引入新的跨进程存储或配置项。

## Definitions

- BaseKey: 现有 vendor 使用的 tokenBucket key 基础部分（host/固定字符串/拼接结果）。
- Proxy IP Label: 由 `@yuants/http-services` 计算并注入到 http-proxy 终端的 `terminalInfo.tags.ip`（语义为真实出口公网 IP）。
- Proxy IP Pool: 从所有 http-proxy 终端收集到的 `ip` 列表（来自 http-services 计算注入的 `tags.ip`）。
- Proxy IP Selector: 位于 `@yuants/http-services` 的 helper，用 round robin 从 `Proxy IP Pool` 选取一个 ip。
- Proxy IP Tagger: 位于 `@yuants/http-services` 的 helper，负责计算出口 ip 并写入 http-proxy 终端 `terminalInfo.tags.ip`。
- Local Public IP: 本机 `terminal.terminalInfo.tags.public_ip`。

## 问题陈述与影响

当 USE_HTTP_PROXY=true 时，请求实际出网由 HTTPProxy 终端完成，但 tokenBucket key 仍以 BaseKey 或本机 IP 作为维度，导致：

- 对同一出口 IP 的请求被拆散进多个 bucket，限流失真。
- 在多 proxy 终端轮转时，单一 bucket 聚合多个出口 IP，误触限流。
- 代理侧真实负载与 vendor 侧限流统计不一致，影响诊断与稳定性。

## Protocol Overview

1. 构造 vendor 请求 `req`。
2. 若 `USE_HTTP_PROXY=true`，枚举所有 HTTPProxy 终端并收集 `terminalInfo.tags.ip` 形成 `Proxy IP Pool`。
3. 用 `Proxy IP Selector`（round robin）选取一个 ip。
4. 以 `BaseKey` 与选取的 ip 生成 tokenBucket key：`encodePath([BaseKey, ip])`。
5. 通过 http-services 的 `fetch` 发送请求，并在 `labels.ip` 中携带该 ip 进行路由。
6. 若 `USE_HTTP_PROXY=false`，使用 `terminal.terminalInfo.tags.public_ip` 作为 ip 维度并直连发送。

## Behavior Requirements

- R1: 当 `USE_HTTP_PROXY=true` 时，tokenBucket key MUST 为 `encodePath([BaseKey, ProxyIp])`。
- R2: 当 `USE_HTTP_PROXY=false` 时，tokenBucket key MUST 为 `encodePath([BaseKey, LocalPublicIp])`。
- R3: `Proxy IP Pool` MUST 由所有 HTTPProxy 终端的 `terminalInfo.tags.ip` 构成。
- R4: 若 `Proxy IP Pool` 为空，MUST 返回 `E_PROXY_TARGET_NOT_FOUND` 且不得发送请求。
- R5: 选取的 `Proxy IP` MUST 通过 `labels.ip` 传递给 http-services `fetch` 用于路由。
- R6: 直连场景下若 `terminal.terminalInfo.tags.public_ip` 缺失，MUST 使用 `public-ip-unknown` 并记录可观测日志并限频。
- R7: BaseKey 的生成规则 MUST 保持现有行为不变，仅作为 `encodePath([BaseKey, ip])` 的第一段。
- R8: 同一 `tags.ip` 对应多个 proxy 终端允许随机路由。

## State Machine

States:

- S0 Init
- S1 DetermineProxyMode
- S2 SelectProxyIp
- S3 BuildTokenBucketKey
- S4 SendRequest
- S5 HandleResponse
- S6 Error

Transitions:

- S0 -> S1: 请求构建完成。
- S1 -> S2: `USE_HTTP_PROXY=true`。
- S1 -> S3: `USE_HTTP_PROXY=false`。
- S2 -> S3: 成功从 `Proxy IP Pool` 选取 `Proxy IP`。
- S2 -> S6: `Proxy IP Pool` 为空。
- S3 -> S4: tokenBucket key 生成完成。
- S4 -> S5: 请求完成（成功或受控失败）。
- S4 -> S6: 网络/代理不可达等不可恢复错误。

## Data Model

### TokenBucketKey

- 结构: `encodePath([BaseKey, ip])`
- BaseKey: string，沿用现有 vendor 规则。
- ip: string
  - 代理场景: 从 `Proxy IP Pool` 选取的 ip
  - 直连场景: `terminal.terminalInfo.tags.public_ip`，缺失为 `public-ip-unknown`
- 约束: 使用 `encodePath` 避免分隔符冲突（禁止直接 `:` 拼接）。

### Proxy IP Pool

- 结构: `string[]`
- 来源: 从所有 HTTPProxy 终端的 `terminalInfo.tags.ip` 汇总
- 约束: 去重后使用 round robin 选择

### 兼容策略

- 缺失标签不会阻断请求，仅直连场景使用 `public-ip-unknown` 兜底并记录日志。
- 代理场景无 ip 候选时返回 `E_PROXY_TARGET_NOT_FOUND`。
- key 文本会新增 ip 维度（直连与代理均变更）；计数器结构不变。

## 方案设计

### 关键设计点：基于 ip 路由

HTTPProxy 本身支持基于 labels 路由。这里不固定具体 target，而是先选定一个出口 IP，再通过 `labels.ip` 让代理侧路由到匹配 IP 的节点（允许随机）。

### 方案 A（推荐）：在 `@yuants/http-services` 增加 proxy ip 选择 helper

- 新增 helper：枚举所有 HTTPProxy 终端 ip，并用 round robin 选择 ip。
- 调用方流程：
  - 枚举 ip 池 -> round robin 选 ip -> 用 ip 生成 key -> fetch + labels.ip 路由。

labels.ip 用于路由与观测，不固定具体 target。

> [REVIEW] proxy_ip_hint 是什么东西？为什么要有？

> [RESPONSE] 已采纳“仅用 labels.ip 路由”的方向，proxy_ip_hint 相关设计已移除，改为 ip 池 + round robin 选择。
> [STATUS:resolved]

> [REVIEW] 我要的流程是：通过 terminal Info resolve 出来所有的 http-proxy 的 ip（可以做这个假设）然后在这一堆 IP 中使用一个 helper function（你可以定义在 http-services 这个包里）来 round robin 选取 ip，然后放到 fetch 里请求，这样就行了，不用加那么多复杂的东西。

> [RESPONSE] 已采纳并调整：删除固定 target/绑定逻辑，新增 http-services helper 枚举 HTTPProxy 的 ip 池并 round robin 选取，调用 fetch 时仅通过 labels.ip 路由。
> [STATUS:resolved]

优点:

- 复用统一逻辑，避免 vendor 重复实现。
- round robin 选 ip 简单可控，符合“按出口 IP 限流”诉求。

缺点:

- 需要修改 `@yuants/http-services` API（新增 helper，非破坏式）。

### 方案 B：在 vendor 内直接枚举 ip + round robin

- vendor 端自行枚举 HTTPProxy ip 池并 round robin 选择 ip。
- 调用 http-services `fetch`，通过 `labels.ip` 路由。

优点:

- 不修改公共库，影响面更小。

缺点:

- 多处重复逻辑，易产生行为差异。
- vendor 需理解底层协议，提升维护成本。

### 推荐方案

优先采用方案 A，以共享 helper 统一 ip 选择逻辑并保持一致性；若落地期评估为高风险，可短期采用方案 B 作为过渡。

> [REVIEW] 其实 http-proxy fetch 是支持 label 选择的（其中必定含有 ip label）约等于支持 target，你加上这个信息重新思考一下？

> [RESPONSE] 已纳入设计：使用 labels.ip 路由，不再固定 target；通过 helper 选出 ip 后直接调用 fetch。
> [STATUS:resolved]

> [REVIEW] 我认为你不需要新增 fetchViaHTTPProxyTarget 这个接口，直接在现有的 fetch 里加上 labels.ip 就行了。fetch 里本来就支持 labels 选择 target 的。

> [RESPONSE] 已采纳“不新增接口”：不增加新 fetch API，直接使用现有 fetch 的 labels 路由；通过 helper 选出 ip 后填入 labels.ip。

> [STATUS:resolved]

> [REVIEW] 同 IP 多 proxy 根本没意义，外界只会对 IP 限流，所以我说的这种 fetch 加 labels ip 就够了

> [RESPONSE] 已采纳：同 IP 多 proxy 允许随机路由，不再要求确定性选择；fetch 仅需用 labels.ip 做路由即可。RFC 中所有“确定性选择”已删除/改为“允许随机”。
> [STATUS:resolved]

## Error Semantics

- E_PROXY_TARGET_NOT_FOUND: 未发现任何 HTTPProxy 服务或 `Proxy IP Pool` 为空。可恢复性: 可重试（依赖服务注册）。
- E_PROXY_REQUEST_FAILED: 代理请求失败。可恢复性: 依据原有重试策略决定；不得自动回退直连。

错误语义映射:

- `Proxy IP Pool` 为空 -> E_PROXY_TARGET_NOT_FOUND。
- 发送阶段失败 -> E_PROXY_REQUEST_FAILED。

错误码归属:

- Proxy IP Selector 仅返回: `E_PROXY_TARGET_NOT_FOUND`
- 发送阶段才可能产生: `E_PROXY_REQUEST_FAILED`
- 直连场景 public_ip 缺失仅记录日志（不作为 error_code 返回）

## Security Considerations

- 必须验证 `terminalInfo.tags.ip` 为可信来源（仅由 `provideHTTPProxyService` 注入）。
- `terminalInfo.tags.ip` 的计算与注入由 `@yuants/http-services` 统一负责，app-http-proxy 不再自行计算。
- 过滤/校验 `ip` 标签，避免非预期注入导致 key 膨胀或日志污染。
- `labels.ip` 用于路由与观测，应避免外部输入污染。
- 若同一出口 IP 映射多个 proxy 终端，允许随机路由。
- 避免将 `ip` 与敏感信息拼接到可外部访问的日志中。
- 防止过度分桶（大量 proxy 标签变化）导致 tokenBucket 资源耗尽；需要监控 key cardinality。

## Observability

- 缺失 `ip`/`public_ip` 的日志必须限频（建议每 terminal 每小时一次）。
- 记录 tokenBucket key cardinality 的最小监控（例如每分钟 key 数量与 TopN 桶占比）。
- 记录 `E_PROXY_TARGET_NOT_FOUND` 计数，用于识别 proxy 池为空或服务未注册。
- 记录 ip 池缓存命中/刷新次数，用于观察缓存有效性。
- 当发现 HTTPProxy 终端缺失 `tags.ip` 时，记录一次结构化日志（限频）。

> [REVIEW] 给你一点上下文：如果需要的话，可以使用 @yuants/cache 库来做这个缓存。具体你是闲的时候决定

## Backward Compatibility & Rollout

- 新 key 维度在代理与直连均启用（直连场景将新增 `public_ip` 维度）。
- 迁移步骤：
  1. vendor-binance 落地方案 A（或 B 过渡）。
  2. 在 binance 验证 key 分桶与出口 IP 一致后推广到其他 vendor。
- 回滚策略：代码版本回退到旧 key 逻辑（不新增额外开关）。

## Testability

每条 MUST 行为必须有可映射断言：

- R1: 代理场景下 key 等于 `encodePath([BaseKey, ProxyIp])`。
- R2: 直连场景下 key 等于 `encodePath([BaseKey, LocalPublicIp])`。
- R3: `Proxy IP Pool` 由所有 HTTPProxy 终端 `tags.ip` 构成。
- R4: `Proxy IP Pool` 为空时返回 `E_PROXY_TARGET_NOT_FOUND` 且不发送请求。
- R5: 选取的 ip 通过 `labels.ip` 传入 fetch 路由。
- R6: 缺失 `public_ip` 时 key 使用 `public-ip-unknown`。
- R7: BaseKey 未被改变，且仅作为 `encodePath` 的第一段。
- R8: 多 target 共享同一 ip 时允许随机路由。

## Open Questions

1. `terminalInfo.tags.ip` 的来源一致性是否需要在 http-proxy 端强制校验？
2. helper 命名是否与现有 http-services 命名风格保持一致？

## Plan

### 核心流程

1. 代理场景：
   - 若缓存有效：使用缓存 ip 池；否则重新枚举并刷新缓存。
   - round robin 选 ip -> 用 ip 生成 key -> fetch + labels.ip 路由。
2. 直连场景：读取 `terminal.terminalInfo.tags.public_ip` -> 拼接 key -> 直连请求。

### 接口定义

- `@yuants/http-services`:
  - `computeAndInjectProxyIp(terminal): Promise<string>`
  - `listHTTPProxyIps(terminal): string[]`
  - `selectHTTPProxyIpRoundRobin(terminal): string`
  - `fetch(input, init: IHTTPProxyFetchInit): Promise<Response>`（已支持 labels）

注: `computeAndInjectProxyIp` 在 http-proxy 终端启动时执行，写入 `terminalInfo.tags.ip`。
注: `listHTTPProxyIps` 基于 `terminal.terminalInfos` 枚举所有 HTTPProxy 终端并支持缓存。
注: 缓存在 HTTPProxy 终端新增或减少时刷新（可基于服务发现事件或定时重算）。
注: helper 内部维护 round robin 状态，保持调用方无状态。

### 文件变更明细

- `libraries/http-services/src/client.ts` 新增 ip 计算注入、枚举、缓存与 round robin helper。
- `apps/http-proxy/src/index.ts` 移除本地 ip 计算，改用 http-services helper。
- `apps/vendor-binance/src/api/*.ts` 修改 tokenBucket key 生成与请求路径。
- 推广到 `apps/vendor-aster/src/api/*.ts` 等同逻辑。

### 验证策略

- 本地最小验证：单元测试或 mock，覆盖 R1-R7。
- 运行 binance 最小自测，确认 key 中 ip 与 labels.ip 一致。
- 灰度启用 USE_HTTP_PROXY，对比限流日志与出口 IP 统计。
