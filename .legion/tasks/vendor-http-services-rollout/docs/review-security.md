# Security Review Report

## 结论

PASS

## Blocking Issues

- [ ] 无（未发现阻塞项）

## 安全建议（非阻塞）

- `apps/vendor-gate/src/api/http-client.ts:159` [Information Disclosure] - 私有请求在 INFO 级别记录 `url.href` + `body`，可能包含提现地址/交易参数；建议改为仅记录 method/host/path/trace_id，完整 body 仅在 DEBUG 且脱敏后输出。
- `apps/vendor-bitget/src/api/client.ts:89` [Information Disclosure] - 私有请求日志包含完整 body；建议对敏感字段（地址、clientOrderId、amount）做脱敏或仅保留字段名。
- `apps/vendor-hyperliquid/src/api/client.ts:75` [Information Disclosure] - DEBUG 时记录完整响应文本，若未来接入私有接口可能泄露账户数据；建议在 DEBUG 仍做字段级脱敏并明确禁止生产开启。
- `apps/vendor-okx/src/api/private-api.ts:4` [Spoofing] - `USE_HTTP_PROXY` 置 true 会全局覆盖 `globalThis.fetch`，代理若被劫持可伪造上游响应或窃听；建议在 http-proxy 层强制 allowlist、mTLS/鉴权，并优先使用局部 fetch 注入替代全局覆盖。
- `apps/vendor-okx/src/api/private-api.ts:61` [Denial of Service] - 多数私有请求未设置超时/重试退避，代理或上游卡住会导致资源耗尽；建议统一加 AbortController 超时与指数退避。

## 修复指导

- 日志脱敏：保持不记录 API key/签名/secret，私有请求的 body/响应在 INFO 级别避免输出，DEBUG 级别也需字段级脱敏。
- USE_HTTP_PROXY 风险控制：仅在受控环境启用；在代理侧实施 host allowlist、TLS pinning 或 mTLS，记录代理链路审计日志。
- 依赖与 CVE：未在本次评审中完成（缺少 lockfile 扫描结果）。建议运行 `pnpm audit`/`npm audit` 或 SCA 扫描并记录结论。
- 协议/状态机绕过：未提供完整鉴权/业务流程上下文，无法评估；如需深入评审请提供调用链与状态机文档。
