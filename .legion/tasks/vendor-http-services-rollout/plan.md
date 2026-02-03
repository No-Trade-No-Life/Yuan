# vendor-http-services-rollout

TITLE: vendor-http-services-rollout
SLUG: vendor-http-services-rollout
SUBTREE_ROOT: apps

## 目标

用新的 @yuants/http-services 替换 vendor HTTP fetch 调用，先在 vendor-binance 完成调研/文档/实现并通过验证，再按同方案推广至其他指定 vendor。

## 设计真源

- RFC: `/Users/c1/Work/Yuan/.legion/tasks/vendor-http-services-rollout/docs/rfc.md`

## 要点

- 先聚焦 apps/vendor-binance 完成替换与验证，形成可复用的迁移模式
- 调研现有 fetch 使用点、封装层与请求路径，明确替换边界与兼容风险
- 输出 RFC + dev/test/bench/obs specs，包含迁移步骤、接口变更点、回滚策略
- 实现阶段只改 binance；扩展到 okx/gate/hyperliquid/aster/bitget/huobi 作为后续阶段（需用户确认）
- 新增：通过环境变量 USE_HTTP_PROXY 控制是否启用代理 fetch 覆盖，全局副作用需确认

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
