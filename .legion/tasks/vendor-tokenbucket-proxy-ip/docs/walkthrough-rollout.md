# Walkthrough Report - vendor-tokenbucket-proxy-ip (rollout)

## 目标与范围

目标：在 USE_HTTP_PROXY 场景下，tokenBucket key 增加目标代理出口 IP 维度，保证 key 与实际路由一致；直连场景使用 public_ip 维度。

范围（本阶段 rollout 覆盖的 vendor 文件）：

- `apps/vendor-bitget/src/api/client.ts`
- `apps/vendor-gate/src/api/http-client.ts`
- `apps/vendor-huobi/src/api/public-api.ts`
- `apps/vendor-huobi/src/api/private-api.ts`
- `apps/vendor-hyperliquid/src/api/client.ts`
- `apps/vendor-hyperliquid/src/api/rate-limit.ts`
- `apps/vendor-okx/src/api/public-api.ts`
- `apps/vendor-okx/src/api/private-api.ts`

## 设计摘要

RFC：`.legion/tasks/vendor-tokenbucket-proxy-ip/docs/rfc.md`

核心流程：

- USE_HTTP_PROXY=true 时，从 http-proxy 终端的 `terminalInfo.tags.ip` 枚举 Proxy IP Pool，round robin 选 ip。
- tokenBucket key 使用 `encodePath([BaseKey, ip])`。
- 通过 http-services `fetch` 将 `labels.ip` 传入以路由到对应出口 IP。
- 直连场景使用 `terminal.terminalInfo.tags.public_ip`，缺失时使用 `public-ip-unknown` 并记录可观测日志。

评审参考：

- Code Review: `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-code-rollout.md`
- Security Review: `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-security-rollout.md`

## 改动清单

按模块：

- Bitget
  - tokenBucket key 增加 ip 维度；USE_HTTP_PROXY 时走 labels.ip 路由；直连使用 public_ip fallback。
- Gate
  - HTTP client 侧 key 拼接与 labels.ip 路由对齐；直连使用 public_ip fallback。
- Huobi
  - public/private API 的 key 与 proxy 路由按 RFC 对齐；直连 public_ip fallback。
- Hyperliquid
  - client/rate-limit 侧引入 ip 维度并通过 proxyContext 传递；保持与 labels.ip 路由一致。
- OKX
  - public/private API 的 key 与 labels.ip 路由对齐；直连 public_ip fallback。

## 如何验证

命令：

```bash
rush build
```

预期：

- 构建通过，无新增 TypeScript 错误。

## Benchmark 结果或门槛说明

- selector 微基准：`(cd libraries/http-services && npm run bench)` 已通过，S1-S4 阈值达标；仅使用本地 HOST（非本地 HOST 被忽略）。
- 本阶段未新增 bench 项目。

## 可观测性

- 记录 `E_PROXY_TARGET_NOT_FOUND` 计数，定位 proxy 池为空或服务未注册。
- 记录缺失 `tags.ip`/`public_ip` 的结构化日志并限频。
- 监控 tokenBucket key cardinality 与 TopN 桶占比。
- 需要时在 DEBUG 级记录 labels.ip 使用情况（脱敏/限频）。

## 风险与回滚

风险：

- `public_ip` 缺失时 `public-ip-unknown` 可能导致多终端共享 bucket（跨终端互相限流）。
- `Proxy IP Pool` 为空会导致请求失败（E_PROXY_TARGET_NOT_FOUND）。
- Debug 日志打印响应/headers 有潜在信息泄露风险（见安全审查）。

回滚：

- 通过版本回退恢复旧 key 逻辑（不新增开关）。

## 未决项与下一步

- 处理安全审查建议：public_ip 缺失时改用更稳定隔离的 fallback（如 `terminal_id` + 缺省标记）。
- OKX proxy 路由场景增加可审计的 DEBUG 日志（脱敏）。
- Gate DEBUG 日志输出敏感信息的风险提示或降噪。
- Hyperliquid 若恢复 `afterRestResponse` 调用，补齐 ip 参数（见 code review）。
