# vendor-http-services-rollout

TITLE: vendor-http-services-rollout
SLUG: vendor-http-services-rollout
SUBTREE_ROOT: apps

## 目标

为 HTTP Proxy 服务增加按目标域名统计的指标与采集方案，并在设计门禁后进入实现。

## 设计真源

- RFC: `/Users/c1/Work/Yuan/.legion/tasks/vendor-http-services-rollout/docs/rfc.md`

## 要点

- 设计真源：/Users/c1/Work/Yuan/.legion/tasks/http-proxy-app-implementation/docs/rfc-metrics.md
- 指标口径：按目标域名统计请求量、错误量与时延，兼容现有 http_proxy_requests_total/request_duration/errors/active
- 高基数防护：仅在 allowedHosts 命中时打点或做域名归一化，避免放大 Prometheus label 基数
- 验证方案：更新最小单测/集成验证说明，覆盖成功与错误路径
- 不改动外部接口语义；必要时扩展 IHTTPProxyOptions/labels 以支持指标策略

## 范围

- apps/vendor-binance
- apps/vendor-okx
- apps/vendor-gate
- apps/vendor-hyperliquid
- apps/vendor-aster
- apps/vendor-bitget
- apps/vendor-huobi
- libraries/http-services (usage only)
- docs/ (design outputs in .legion task docs)

## 阶段概览

1. **调研** - 1 个任务
2. **设计** - 1 个任务
3. **实现（仅 binance）** - 1 个任务
4. **推广（其他 vendor）** - 1 个任务

## 摘要

- 核心流程：http-services 缓存 `globalThis.__yuantsNativeFetch` 并标记 proxy fetch；`terminal.ts` 使用稳定 native fetch，`USE_HTTP_PROXY=true` 时跳过 public IP 获取以避免递归。
- 接口变更：无，`Terminal.fromNodeEnv()` 与调用方签名保持兼容。
- 文件变更清单：`libraries/protocol/src/terminal.ts`（必需）；`libraries/http-services/src/client.ts`（可选，仅在引入禁用开关时）。
- 验证策略：覆盖 RFC R1-R4 的单测或最小集成测试；启用 `USE_HTTP_PROXY` 回归一次真实请求。

---

_创建于: 2026-01-29 | 最后更新: 2026-02-03_
