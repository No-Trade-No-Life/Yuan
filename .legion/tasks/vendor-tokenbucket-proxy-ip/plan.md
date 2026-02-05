# vendor-tokenbucket-proxy-ip

TITLE: TokenBucket Proxy IP Key
SLUG: vendor-tokenbucket-proxy-ip

## RFC

- 设计真源: `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/rfc.md`

## 摘要

- 核心流程: 代理场景枚举 HTTPProxy ip 池并 round robin 选 ip，key 使用该 ip，fetch 通过 labels.ip 路由；直连用 `terminal.terminalInfo.tags.public_ip`。
- 接口变更: `@yuants/http-services` 增加 ip 枚举/选择 helper，并统一注入 `terminalInfo.tags.ip`。
- 文件变更清单: `libraries/http-services/src/client.ts`、`apps/http-proxy/src/index.ts` 与各 vendor API 文件。
- 验证策略: 覆盖 R1-R7 的最小测试 + binance 自测对比 labels.ip 与出口 IP。

## 目标

为各 vendor 的 tokenBucket key 增加“目标 http-proxy 终端 ip 标签”维度，保证 USE_HTTP_PROXY 场景按实际出口 IP 限流，并先在 Binance 落地后推广到其他 vendor。

## 要点

- 梳理 USE_HTTP_PROXY 场景下 http-services 的路由机制与可获取的目标 terminal 标签
- 定义 tokenBucket key 规范：baseKey + 目标 terminal ip（代理）或自身 terminal.tags.public_ip（直连）
- Binance 先行改造并验证 key 拼接逻辑与请求路由一致
- 推广到 aster/hyperliquid/gate/bitget/huobi/okx，保持一致性与最小侵入
- 必要时补充共享 helper（避免多处复制逻辑）

## 范围

- apps/vendor-binance/src/api/client.ts
- apps/vendor-binance/src/api/public-api.ts
- apps/vendor-binance/src/api/private-api.ts
- apps/vendor-aster/src/api/public-api.ts
- apps/vendor-aster/src/api/private-api.ts
- apps/vendor-bitget/src/api/client.ts
- apps/vendor-gate/src/api/http-client.ts
- apps/vendor-huobi/src/api/public-api.ts
- apps/vendor-huobi/src/api/private-api.ts
- apps/vendor-hyperliquid/src/api/client.ts
- apps/vendor-hyperliquid/src/api/rate-limit.ts
- apps/vendor-okx/src/api/public-api.ts
- apps/vendor-okx/src/api/private-api.ts
- libraries/http-services/src/client.ts
- libraries/protocol/src/client.ts

## 阶段概览

1. **调研** - 1 个任务
2. **设计** - 2 个任务
3. **实现** - 2 个任务
4. **验证** - 1 个任务
5. **评审与报告** - 1 个任务

---

_创建于: 2026-02-04 | 最后更新: 2026-02-05_
