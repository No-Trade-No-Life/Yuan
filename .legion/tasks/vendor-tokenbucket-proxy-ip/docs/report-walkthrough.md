# Walkthrough Report - vendor-tokenbucket-proxy-ip

## 目标与范围

- 目标：为 USE_HTTP_PROXY 场景的 tokenBucket key 增加“目标 http-proxy 终端 ip 标签”维度，确保限流与实际出口 IP 一致；直连场景按本机 `public_ip` 维度。
- 范围（计划范围）：
  - `apps/vendor-binance/src/api/client.ts`
  - `apps/vendor-binance/src/api/public-api.ts`
  - `apps/vendor-binance/src/api/private-api.ts`
  - `apps/vendor-aster/src/api/public-api.ts`
  - `apps/vendor-aster/src/api/private-api.ts`
  - `apps/vendor-bitget/src/api/client.ts`
  - `apps/vendor-gate/src/api/http-client.ts`
  - `apps/vendor-huobi/src/api/public-api.ts`
  - `apps/vendor-huobi/src/api/private-api.ts`
  - `apps/vendor-hyperliquid/src/api/client.ts`
  - `apps/vendor-hyperliquid/src/api/rate-limit.ts`
  - `apps/vendor-okx/src/api/public-api.ts`
  - `apps/vendor-okx/src/api/private-api.ts`
  - `libraries/http-services/src/client.ts`
  - `libraries/protocol/src/client.ts`
- 本次实际改动集中在 `libraries/http-services`、`apps/http-proxy` 与 `apps/vendor-binance`，其余 vendor 仍待推广。

## 设计摘要

- RFC：`.legion/tasks/vendor-tokenbucket-proxy-ip/docs/rfc.md`
- Code Review：`.legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-code.md`
- Security Review：`.legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-security.md`

设计要点：

- 在 `@yuants/http-services` 统一计算/注入 proxy 终端 `tags.ip`，并从所有 HTTPProxy 终端收集 ip 池，round robin 选取 ip。
- tokenBucket key 统一为 `encodePath([BaseKey, ip])`，代理场景使用选取的 proxy ip；直连场景使用 `terminal.terminalInfo.tags.public_ip`，缺失时使用 `public-ip-unknown` 并记录观测。
- 通过 `fetch` 的 `labels.ip` 路由请求，保证 key 的 ip 与实际路由一致。
- 可信来源闭环：写入 `tags.ip` 时标记 `ip_source=http-services`；读取候选时仅采信可信来源；http-proxy 仅注入可信 `labels.ip`。

## 改动清单（按模块）

- `libraries/http-services`
  - 新增 proxy ip 计算与注入逻辑；枚举 HTTPProxy ip 池并缓存；round robin 选择 ip。
  - 限制 `PROXY_IP_FETCH_URL` 为 https；空 ip 不覆盖已有标签。
  - 暴露 helper 与 API 文档更新。
- `apps/http-proxy`
  - 启动时使用 http-services helper 写入/校验 `tags.ip` 与 `ip_source`。
  - 仅在可信来源时注入 `labels.ip`，避免标签污染。
- `apps/vendor-binance`
  - tokenBucket key 增加 ip 维度（`encodePath([BaseKey, ip])`）。
  - 代理场景使用 `labels.ip` 路由；直连场景使用 `public_ip` 维度。

## 如何验证

已执行：

- `(cd libraries/http-services && npx heft test --clean)` -> PASS（Jest 3 suites, 0 failures；API Extractor 提示缺少 release tag）。

未通过/未执行：

- `npx tsc --noEmit --project apps/vendor-binance/tsconfig.json` -> FAIL（本地环境未解析到 TypeScript；预计补齐工具链后可通过）。
- vendor-binance 未提供独立 test/bench 脚本或用例，按现状无法执行针对性测试。

## Benchmark

- 无基准数据或门槛；本次改动未提供性能 benchmark。

## 可观测性

- 缺失 `tags.ip` 或 `public_ip` 需记录结构化日志并限频。
- 统计 `E_PROXY_TARGET_NOT_FOUND` 计数，判断 proxy 池为空或服务未注册。
- 记录 key cardinality 指标（如分钟级 key 数量与 TopN 桶占比）。
- 记录 ip 池缓存命中/刷新次数，观察缓存有效性。

## 风险与回滚

- 风险：
  - key 维度新增 ip，可能提升 key cardinality，影响限流存储规模。
  - proxy ip 池为空会阻断代理请求（`E_PROXY_TARGET_NOT_FOUND`）。
  - proxy ip 可信来源/获取 URL 配置错误导致标签污染或不可用。
- 回滚：通过版本回退到旧 key 逻辑（不新增功能开关）。

## 未决项与下一步

- 补齐 TypeScript 工具链后重跑 `npx tsc --noEmit --project apps/vendor-binance/tsconfig.json`。
- 评估并按 review 建议补强：统一可信来源常量、公网 IP 获取超时、错误上下文、日志最小化/allowlist 等。
- 将同样的 key 逻辑推广到其他 vendor（aster/hyperliquid/gate/bitget/huobi/okx）。
