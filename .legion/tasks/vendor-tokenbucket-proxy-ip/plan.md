# vendor-tokenbucket-proxy-ip

TITLE: TokenBucket Proxy IP Key
SLUG: vendor-tokenbucket-proxy-ip

## RFC

- 设计真源: `/Users/c1/Work/http-proxy-whitelist/.legion/tasks/vendor-tokenbucket-proxy-ip/docs/rfc.md`
- 2026-03-25 design-lite: 本文 `## 本轮继续（2026-03-25）`

## 摘要

- 核心流程: 保留 v2 的按 `weight` 主动 `acquireSync` 与 `bucketKey == encodePath([baseKey, ip])`，但删除基于 `terminal_id` 的 HTTPProxy 白名单与 route pin；请求仅按 `labels.ip` 路由。
- 接口变更: `AcquireProxyBucketResult` 从 `{ ip, terminalId, bucketKey }` 收敛为 `{ ip, bucketKey }`；`IRequestContext` 与 vendor 侧请求标签同步移除 `terminalId` / `labels.terminal_id`。
- 信任模型: 同一 host 网络中的 `HTTPProxy` terminal 默认互信；候选池统一收敛为“`HTTPProxy` 服务 + 合法 `tags.ip` + `ip_source=http-services` + IP 去重”。
- 风险分级: Medium。原因是信任模型从 terminal allowlist 改为 host 内默认互信，属于安全边界收敛调整，但范围集中且可回滚。
- 验证策略: 覆盖 env 被忽略、同 IP 去重、移除 `labels.terminal_id`、仅按 `labels.ip` 仍可路由成功，以及 route 阶段无匹配时的 `E_PROXY_TARGET_NOT_FOUND`。

## 本轮继续（2026-03-25）

- 标签: `continue`
- 问题定义: `apps/vendor-binance/src/services/ohlc-service.ts` 直接调用底层 `requestPublic()` 拉取 klines，绕过 `createRequestContext()`；当 `USE_HTTP_PROXY=true` 时会在 `apps/vendor-binance/src/api/client.ts` 抛出 `E_PROXY_TARGET_NOT_FOUND: reason="Missing request context"`。
- 方案摘要: 走 Low 风险 design-lite，在 `apps/vendor-binance/src/api/public-api.ts` 增加 Binance Kline wrapper，由 wrapper 统一创建 `requestContext`、执行主动限流并调用 `requestPublic()`；`ohlc-service` 仅消费 public-api，不再直接碰底层 client。
- 风险分级: Low。原因是仅补齐既有 public-api 分层与 request context 透传，不改外部合约，不涉及数据迁移，且可直接回滚。
- 验收标准:
  1. `ohlc-service` 不再直接 import `requestPublic`。
  2. Binance futures/spot klines 均通过 `public-api` wrapper 创建 `requestContext` 后再请求。
  3. `USE_HTTP_PROXY=true` 时，Kline 拉取链路不再因缺失 `requestContext` 在 client 层提前失败。
  4. 至少完成 `npx tsc --noEmit --project apps/vendor-binance/tsconfig.json`，并更新测试/评审/PR 产物。

## 目标

移除基于 `terminal_id` 的 HTTPProxy 白名单与相关耦合，让 v2 方案对齐“同一 host 网络内 terminal 默认互信”的模型，同时保持按 IP 路由与按 IP 限流同源。

## 要点

- 删除 `TRUSTED_HTTP_PROXY_TERMINAL_IDS` 的解析、缓存、allowlist 日志与 fail-closed 语义。
- `proxy-ip.ts` 内所有导出 helper 统一复用同一套候选构造逻辑，避免半改状态。
- `apps/http-proxy` 不再注册 `labels.terminal_id`；`apps/vendor-binance` 不再消费/发送 `terminalId`。
- 保留 `ip_source=http-services` 与合法 IP 校验，作为当前最小数据有效性约束。
- 通过单测/构建/API report/报告闭环本次 trust model 变更，并明确剩余类似 terminal_id 依赖只保留在日志/缓存命名空间中。

## 范围

- libraries/http-services/src/proxy-ip.ts
- libraries/http-services/src/index.ts
- libraries/http-services/src/client.ts
- libraries/http-services/src/**tests**/proxy-ip.test.ts
- libraries/http-services/src/**tests**/client.test.ts
- libraries/http-services/src/**tests**/integration.test.ts
- libraries/http-services/etc/http-services.api.md
- apps/http-proxy/src/index.ts
- apps/vendor-binance/src/api/client.ts
- apps/vendor-binance/src/api/public-api.ts
- apps/vendor-binance/src/services/ohlc-service.ts
- apps/vendor-binance/SESSION_NOTES.md
- .legion/tasks/vendor-tokenbucket-proxy-ip/docs/rfc.md
- .legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-rfc.md
- .legion/tasks/vendor-tokenbucket-proxy-ip/docs/test-report.md
- .legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-code.md
- .legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-security.md
- .legion/tasks/vendor-tokenbucket-proxy-ip/docs/report-walkthrough.md
- .legion/tasks/vendor-tokenbucket-proxy-ip/docs/pr-body.md

## 阶段概览

1. **continue / 设计收敛** - 更新 RFC，删除 terminal allowlist 与 terminal_id route pin，并完成复审 PASS
2. **实现** - 修改 `http-services` / `http-proxy` / `vendor-binance` / 测试 / API report
3. **验证与评审** - 运行测试、code review、安全 review
4. **报告** - 生成 walkthrough 与可直接用于 PR 的 `pr-body.md`

---

_创建于: 2026-02-04 | 最后更新: 2026-03-25_
