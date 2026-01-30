# Walkthrough 报告 - vendor http-services 推广与日志脱敏

## 目标与范围

- 目标：在不改动各 vendor 对外 API 签名的前提下，用 `@yuants/http-services` 统一接入 HTTPProxy；增加 `USE_HTTP_PROXY` 开关与 `fetchImpl` 回退；推广到 okx/gate/hyperliquid/aster/bitget/huobi；完成日志脱敏修复并给出 review/test 结论。
- 范围：SUBTREE_ROOT `apps`；覆盖 `apps/vendor-binance` 与 `apps/vendor-okx`/`apps/vendor-gate`/`apps/vendor-hyperliquid`/`apps/vendor-aster`/`apps/vendor-bitget`/`apps/vendor-huobi`，并更新 WORK_ROOT 文档与依赖锁文件。

## 设计摘要

- RFC：[rfc.md](rfc.md)
- specs：[spec-dev.md](spec-dev.md) / [spec-test.md](spec-test.md) / [spec-bench.md](spec-bench.md) / [spec-obs.md](spec-obs.md)
- review：[review-code.md](review-code.md) / [review-security.md](review-security.md)

## 改动清单（按模块/文件类型）

- apps/vendor-binance：`src/api/client.ts` 引入 `@yuants/http-services` 的 `fetch`，增加 `USE_HTTP_PROXY` 控制 `globalThis.fetch` 覆盖，`fetchImpl` 回退逻辑；请求日志与 `ACTIVE_RATE_LIMIT` 错误 payload 完成脱敏。
- apps/vendor-okx：`src/api/public-api.ts`/`src/api/private-api.ts` 引入 `fetchImpl` 与 `USE_HTTP_PROXY`；私有请求日志脱敏（移除含签名/查询的 URL 与 headers 输出）。
- apps/vendor-gate：`src/api/http-client.ts` 引入 `fetchImpl` 与 `USE_HTTP_PROXY`。
- apps/vendor-hyperliquid：`src/api/client.ts` 引入 `fetchImpl` 与 `USE_HTTP_PROXY`；私有请求日志脱敏（移除完整 URL/params 输出，仅保留 host/path/status）。
- apps/vendor-aster：`src/api/public-api.ts`/`src/api/private-api.ts` 引入 `fetchImpl` 与 `USE_HTTP_PROXY`；`src/services/accounts/spot.ts` 的 coingecko 请求切换至 `fetchImpl`；私有请求日志脱敏。
- apps/vendor-bitget：`src/api/client.ts` 引入 `fetchImpl` 与 `USE_HTTP_PROXY`。
- apps/vendor-huobi：`src/api/public-api.ts`/`src/api/private-api.ts` 引入 `fetchImpl` 与 `USE_HTTP_PROXY`；私有请求元数据脱敏（移除 access_key 字段）。
- vendor package.json：为 okx/gate/hyperliquid/aster/bitget/huobi/binance 增加 `@yuants/http-services` 依赖。
- SESSION_NOTES：更新 gate/hyperliquid/aster/bitget 记录迁移与未运行测试。
- 依赖锁文件：`pnpm-lock.yaml` 随 `rush update` 更新。
- WORK_ROOT 文档：RFC/spec-dev/spec-test/spec-bench/spec-obs + review-code/review-security + 本报告 + PR body。

## 如何验证

- `rush build -t @yuants/vendor-binance`
  - 预期：依赖解析成功并完成构建。
  - 本次结果：通过。
- `rush build -t @yuants/vendor-okx`
  - 预期：依赖解析成功并完成构建。
  - 本次结果：通过。
- `rush build -t @yuants/vendor-gate`
  - 预期：依赖解析成功并完成构建。
  - 本次结果：通过。
- `rush build -t @yuants/vendor-hyperliquid`
  - 预期：依赖解析成功并完成构建。
  - 本次结果：通过。
- `rush build -t @yuants/vendor-aster`
  - 预期：依赖解析成功并完成构建。
  - 本次结果：通过。
- `rush build -t @yuants/vendor-bitget`
  - 预期：依赖解析成功并完成构建。
  - 本次结果：通过。
- `rush build -t @yuants/vendor-huobi`
  - 预期：依赖解析成功并完成构建。
  - 本次结果：通过。
- 手工验证（可选）：选取各 vendor 的 public + private 调用链，确认通过 HTTPProxy 返回 JSON；校验 `Retry-After`、`x-mbx-used-weight-1m` 等 header 读取正常。
- Review 结果：`review-code` PASS，`review-security` PASS。

## benchmark 结果或门槛说明

- 未配置 baseline，且本阶段仅做传输层切换与日志脱敏；不新增 benchmark（见 spec-bench）。

## 可观测性（metrics/logging）

- 指标保持：各 vendor 现有请求/限流指标采集与语义保持不变。
- 日志：私有请求日志与错误 payload 已脱敏，移除 API key/签名/signData/完整 query/headers/params 等敏感字段，仅保留 method/host/path/status/usedWeight/retryAfter 等必要信息。
- HTTPProxy 侧日志与指标由 `@yuants/http-services` 提供，用于跨服务追踪。

## 风险与回滚

- 风险：HTTPProxy 未部署或 `allowedHosts` 未覆盖对应交易所域名，代理请求失败。
- 风险：`USE_HTTP_PROXY=true` 时引入全局 `fetch` 覆盖；日志脱敏降低排障细节密度，需要配合 proxy 日志定位。
- 回滚：关闭 `USE_HTTP_PROXY`，或移除 `@yuants/http-services` 依赖与 `fetch` import，恢复原生 `fetch` 与日志字段。

## 未决项与下一步

- 环境就绪后补跑各 vendor 的手工验证（USE_HTTP_PROXY=true/false）。
- 按 spec-test 规划补齐 R1-R3 用例与最小 smoke check。
- 评估是否引入 labels 进行代理分流；核对 HTTPProxy `allowedHosts` 覆盖新增域名（含 coingecko）。
- 结合安全 review 建立统一日志脱敏工具与审计字段（request id/调用方标识）。
