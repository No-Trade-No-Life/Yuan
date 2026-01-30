# Walkthrough 报告 - vendor-binance http-services 接入

## 目标与范围

- 目标：在不改动 `requestPublic/requestPrivate` 接口的前提下，将 `apps/vendor-binance` 的 HTTP 传输层切换到 `@yuants/http-services`，新增 `USE_HTTP_PROXY` 开关与 `fetchImpl` 回退，完成日志脱敏与最小验证。
- 范围：SUBTREE_ROOT `apps/vendor-binance`；伴随更新 WORK_ROOT 文档与依赖锁文件。

## 设计摘要

- RFC：[/Users/c1/Work/Yuan/.legion/tasks/vendor-http-services-rollout/docs/rfc.md](/Users/c1/Work/Yuan/.legion/tasks/vendor-http-services-rollout/docs/rfc.md)
- specs：[/Users/c1/Work/Yuan/.legion/tasks/vendor-http-services-rollout/docs/spec-dev.md](/Users/c1/Work/Yuan/.legion/tasks/vendor-http-services-rollout/docs/spec-dev.md) / [/Users/c1/Work/Yuan/.legion/tasks/vendor-http-services-rollout/docs/spec-test.md](/Users/c1/Work/Yuan/.legion/tasks/vendor-http-services-rollout/docs/spec-test.md) / [/Users/c1/Work/Yuan/.legion/tasks/vendor-http-services-rollout/docs/spec-bench.md](/Users/c1/Work/Yuan/.legion/tasks/vendor-http-services-rollout/docs/spec-bench.md) / [/Users/c1/Work/Yuan/.legion/tasks/vendor-http-services-rollout/docs/spec-obs.md](/Users/c1/Work/Yuan/.legion/tasks/vendor-http-services-rollout/docs/spec-obs.md)
- review：[/Users/c1/Work/Yuan/.legion/tasks/vendor-http-services-rollout/docs/review-code.md](/Users/c1/Work/Yuan/.legion/tasks/vendor-http-services-rollout/docs/review-code.md) / [/Users/c1/Work/Yuan/.legion/tasks/vendor-http-services-rollout/docs/review-security.md](/Users/c1/Work/Yuan/.legion/tasks/vendor-http-services-rollout/docs/review-security.md)

## 改动清单（按模块/文件类型）

- apps/vendor-binance 代码：`src/api/client.ts` 引入 `@yuants/http-services` 的 `fetch`，新增 `USE_HTTP_PROXY` 控制是否覆盖 `globalThis.fetch`；当原生 `fetch` 不可用时回退到 `fetchImpl`；请求日志与 `ACTIVE_RATE_LIMIT` 错误 payload 完成脱敏（不输出 API key/签名/signData/完整 query）。
- apps/vendor-binance 元数据：`package.json` 新增依赖 `@yuants/http-services`；`SESSION_NOTES.md` 记录迁移决策与验证信息。
- 依赖锁文件：`pnpm-lock.yaml` 随 `rush update` 更新。
- WORK_ROOT 文档：RFC/spec-dev/spec-test/spec-bench/spec-obs + review-code/review-security 输出；本报告与 PR body 新增。

## 如何验证

- `rush build -t @yuants/vendor-binance`
  - 预期：依赖解析成功并完成构建。
  - 本次结果：通过。
- `npx tsc --noEmit --project apps/vendor-binance/tsconfig.json`
  - 预期：类型检查通过。
  - 本次结果：失败（环境缺少 TypeScript）。
- 手工验证（可选）：调用 `getSpotExchangeInfo` 等公共链路，确认通过 HTTPProxy 返回 JSON；校验 `Retry-After` 与 `x-mbx-used-weight-1m` 读取正常。
- Review 结果：`review-code` PASS，`review-security` PASS。

## benchmark 结果或门槛说明

- 未配置 baseline，且本阶段仅做传输层切换与日志脱敏；不新增 benchmark（见 spec-bench）。

## 可观测性（metrics/logging）

- 指标保持：`binance_api_request_total`、`binance_api_used_weight` 维持现有采集与语义。
- 日志：`client.ts` 请求/响应日志已脱敏，仅保留 method/host/path/usedWeight/retryAfter。
- HTTPProxy 侧日志与指标由 `@yuants/http-services` 提供，用于跨服务追踪。

## 风险与回滚

- 风险：HTTPProxy 未部署或 `allowedHosts` 未覆盖 `api.binance.com`/`fapi.binance.com`/`papi.binance.com`，请求会失败。
- 风险：`USE_HTTP_PROXY` 打开时引入全局 `fetch` 覆盖；日志脱敏降低排障信息密度，需要配合 proxy 日志定位。
- 回滚：关闭 `USE_HTTP_PROXY`，或移除 `@yuants/http-services` 依赖与 `fetch` import，恢复全局 `fetch`；必要时还原错误 payload 字段。

## 未决项与下一步

- 环境就绪后补跑 `npx tsc --noEmit --project apps/vendor-binance/tsconfig.json`。
- 按 spec-test 规划补齐 R1-R3 单测与最小 smoke check。
- 评估是否引入 labels 进行代理分流。
- 用户确认后推广到其他 vendor（okx/gate/hyperliquid/aster/bitget/huobi）。
- 结合安全 review 建立统一日志脱敏工具与审计字段（request id/调用方标识）。
