# Walkthrough: http-services terminalInfos 就绪等待与 async proxy ip 选择

## 目标与范围

目标：为 HTTP proxy ip 选择引入 terminalInfos$ 就绪等待，避免启动阶段空池失败；新增 async 选择 helper，统一固定 30s 超时，并将 vendor 调用点改为 await。

范围（Scope）：

- libraries/http-services/src/proxy-ip.ts
- libraries/http-services/src/index.ts
- apps/vendor-binance/src/api/client.ts
- apps/vendor-aster/src/api/public-api.ts
- apps/vendor-aster/src/api/private-api.ts
- apps/vendor-bitget/src/api/client.ts
- apps/vendor-gate/src/api/http-client.ts
- apps/vendor-huobi/src/api/public-api.ts
- apps/vendor-huobi/src/api/private-api.ts
- apps/vendor-hyperliquid/src/api/client.ts
- apps/vendor-okx/src/api/public-api.ts
- apps/vendor-okx/src/api/private-api.ts

## 设计摘要

- RFC：`.legion/tasks/http-services-terminalinfos-ready/docs/rfc.md`
- 新增 async helper：等待 terminalInfos$ 首发后重算 proxy ip 列表，非空返回，否则在 30s 内等待并统一超时语义。
- 超时固定为 30_000ms 且不可配置，错误契约保持 `E_PROXY_TARGET_NOT_FOUND`，payload 统一包含 reason/terminal_id/timeoutMs。
- vendor 调用点改为 await 版本，消除启动阶段 terminalInfos$ 未就绪导致的同步失败。

## 改动清单（按模块/文件类型）

- http-services：新增 async proxy ip 选择与等待逻辑，保留同步 API。
- http-services 导出：补充 async API 导出。
- vendor 调用点：将 proxy ip 选择从同步改为 await 调用。

涉及文件：

- libraries/http-services/src/proxy-ip.ts
- libraries/http-services/src/index.ts
- apps/vendor-binance/src/api/client.ts
- apps/vendor-aster/src/api/public-api.ts
- apps/vendor-aster/src/api/private-api.ts
- apps/vendor-bitget/src/api/client.ts
- apps/vendor-gate/src/api/http-client.ts
- apps/vendor-huobi/src/api/public-api.ts
- apps/vendor-huobi/src/api/private-api.ts
- apps/vendor-hyperliquid/src/api/client.ts
- apps/vendor-okx/src/api/public-api.ts
- apps/vendor-okx/src/api/private-api.ts

## 如何验证

- 命令：`(cd libraries/http-services && rushx build)`
- 预期：heft build + jest 通过（24/24）；API Extractor 可能提示签名变更但不影响通过。

## benchmark 结果或门槛说明

- 本次未运行 benchmark，未提供相关结果。

## 可观测性（metrics/logging）

- 超时与空池统一错误契约：`E_PROXY_TARGET_NOT_FOUND`，payload 包含 reason/terminal_id/timeoutMs（固定 30_000）。
- 超时日志采用限频策略（按 terminal_id）。

## 风险与回滚

- 风险：调用点改为 await 后，启动阶段可能等待最长 30s；无代理配置场景需注意启动延迟。
- 回滚：回退 http-services async helper 与 vendor 调用点 await 变更，恢复同步选择逻辑。
- Review：code/security PASS。

## 未决项与下一步

- 如需扩大覆盖面，可在各 vendor 包运行 `rushx build` 或 `rushx test`。
- 若需性能或等待成本评估，可补充 benchmark 与启动耗时统计。
