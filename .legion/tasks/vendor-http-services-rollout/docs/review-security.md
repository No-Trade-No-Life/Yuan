# Security Review Report

## 结论

PASS

## Blocking Issues

- [ ] 无（仅评审 `apps/vendor-binance`，未发现阻塞项）

## 安全建议（非阻塞）

- `apps/vendor-binance/src/api/client.ts:11` [Elevation of Privilege] - `USE_HTTP_PROXY=true` 时覆盖 `globalThis.fetch` 影响同进程其他模块的出站路径与鉴权边界，存在全局副作用与意外交互风险。
- `apps/vendor-binance/src/api/client.ts:9` [Tampering] - `USE_HTTP_PROXY=false` 且运行时无原生 `fetch` 时仍回退到代理 `fetch`，可能绕过“禁用代理”的预期控制。
- `apps/vendor-binance/src/api/client.ts` [Spoofing] - 无法评估 HTTPProxy 的认证/ACL/证书校验与 `allowedHosts` 策略，需补充代理部署与安全配置说明。
- `apps/vendor-binance/src/api/client.ts:105` [Information Disclosure] - 已确认请求日志与 `ACTIVE_RATE_LIMIT` payload 不包含签名、API key 或完整 query（无须改动）。
- `apps/vendor-binance/src/api/client.ts` [Denial of Service] - 令牌桶与 Retry-After 控制存在，但无法评估代理侧限流与重试策略；建议补充代理侧限流/熔断说明与默认阈值。
- `apps/vendor-binance/src/api/client.ts` [Tampering] - 依赖漏洞未评估（`@yuants/http-services` 及传递依赖）；建议在发布前运行依赖审计。

## 修复指导

- 避免覆盖 `globalThis.fetch`，改为局部 `fetchImpl` 并仅在本模块使用；或仅在 `globalThis.fetch` 缺失时才设置，并记录显式日志说明全局副作用。
- 若 `USE_HTTP_PROXY=false` 代表强制直连，请在无原生 `fetch` 时直接报错并提示运行时要求，避免隐式回退到代理。
- 提供 HTTPProxy 的鉴权/ACL/证书校验与 `allowedHosts` 配置说明，以便评估 Spoofing/Tampering 风险与绕过路径。
- 为代理侧补充速率限制、并发与重试策略的默认配置说明（如限流阈值、熔断策略、超时），避免 DoS 风险评估缺失。
- 运行依赖漏洞扫描（如 pnpm audit 或仓库内既定安全扫描流程），并记录高危/中危修复计划。
