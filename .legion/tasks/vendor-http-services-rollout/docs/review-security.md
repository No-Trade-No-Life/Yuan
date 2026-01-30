# Security Review Report

## 结论

PASS

## Blocking Issues

- None

## 安全建议（非阻塞）

- `apps/vendor-binance/src/api/client.ts:20` [Spoofing] - 无法评估完整认证流程（凭证来源、轮换、权限边界）；需要提供调用方 credential 获取与存储流程说明。
- `apps/vendor-binance/src/api/client.ts:118` [Repudiation] - 无法评估审计日志完整性（请求上下文、请求方标识、链路追踪）；建议补充链路追踪字段或请求 ID。
- `apps/vendor-binance/src/api/client.ts:120` [Information Disclosure] - 已避免记录签名/API key/query；建议统一日志脱敏函数，防止后续新增日志时引入泄露。
- `apps/vendor-binance/src/api/client.ts:120` [Denial of Service] - 无法评估全局速率限制策略（分布式/多实例共享限流）；如多实例部署，建议使用集中式限流或共享配额监控。
- `apps/vendor-binance/package.json:14` [Tampering] - 依赖风险无法评估（workspace:\* 无法判断 CVE）；需提供锁文件或依赖扫描结果。

## 修复指导

1. 建立统一的日志脱敏与错误 payload 过滤器，禁止输出签名、API key、完整 query 或 secret 片段。
2. 在 request/response 日志中追加请求 ID 与调用方标识（不含凭证），用于审计追溯与抗抵赖。
3. 明确 credential 生命周期与存储边界（来源、轮换、权限最小化），并在文档中说明。
4. 多实例场景采用集中式限流或全局配额监控，避免 DoS 或限流绕过。
5. 提供依赖扫描输出（如 SCA 报告或锁文件），补齐 CVE 评估。
