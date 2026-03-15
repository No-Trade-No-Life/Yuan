# 安全审查报告

## 结论

PASS

## 阻塞问题

- [ ] （none）

## 建议（非阻塞）

- `[STRIDE:Tampering]` `libraries/protocol/src/request-service-for-response.ts:97` 当前 NDJSON 解析策略是“逐行 JSON.parse，遇到首个含 res 字段即返回”。建议补充 `Content-Type` 与 `res` 结构的最小校验（如 `code` 字段类型），降低协议漂移或异常上游导致的误解析风险。
- `[STRIDE:Repudiation]` `libraries/protocol/src/request-service-for-response.ts:194` 错误对象已包含 `method`/`host`，但缺少关联 ID。建议允许上层透传/注入 requestId（或 traceId）并纳入错误上下文，便于跨服务审计追踪。
- `[状态机/协议绕过]` `libraries/protocol/src/request-service-for-response.ts:115` 当前“首个含 `res` 的帧即返回”符合当前需求，但建议在文档中明确该约束，避免未来协议扩展（多阶段帧）时出现提前短路。
- `[secure-by-default]` `libraries/protocol/src/request-service-for-response.ts:60` 已默认强制 HTTPS，仅放行 localhost/127.0.0.1/::1 的 HTTP，整体方向正确。建议在 README/API 文档显式声明该安全策略，减少误用。
- `[依赖风险/CVE]` 本次 scope 未引入新依赖，未见新增供应链风险。建议继续在 CI 中保持 SCA/audit，以覆盖间接依赖漏洞。

## 修复指导

1. 若要进一步加固协议完整性，优先补充响应头与 `res` 结构校验。
2. 在公共 API 文档中补充“仅 origin host_url、默认 HTTPS、本地回环 HTTP 例外”的安全约束。
3. 为上层调用链预留 trace 字段透传能力，完善可审计性。
