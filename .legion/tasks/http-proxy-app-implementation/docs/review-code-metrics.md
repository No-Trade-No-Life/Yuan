# Code Review Report

## 结论

PASS（基于有限信息的评审；已审查文件：`libraries/http-services/src/server.ts`、`libraries/http-services/src/__tests__/server.test.ts`）

## Blocking Issues

- [ ] 无

## 建议（非阻塞）

- `libraries/http-services/src/__tests__/server.test.ts:202` - 多处直接使用 `mockMetrics.counter.mock.results[0/1]` 依赖注册顺序，维护时容易脆弱；建议统一用 `getCounterMetric` 按名称取值，避免未来变更顺序导致误报。
- `libraries/http-services/src/server.ts:62` - 当前 `target_path` 直接使用 `URL.pathname`，符合 RFC R12，但 RFC R25 对“路径”措辞容易引起误读；建议在 RFC 或代码注释中明确“仅 pathname、无 query/fragment”，避免审计时被误判为泄露原始 URL。

## 修复指导

- `libraries/http-services/src/__tests__/server.test.ts`：将 `mockMetrics.counter.mock.results[0]`/`[1]` 替换为 `getCounterMetric(mockMetrics, 'http_proxy_requests_total')`、`getCounterMetric(mockMetrics, 'http_proxy_errors_total')`、`getCounterMetric(mockMetrics, 'http_proxy_target_host_requests_total')`，消除顺序依赖。
- `libraries/http-services/src/server.ts` 或 `rfc-metrics.md`：补充一句“`target_path` 仅为 `pathname`，不包含 query/fragment”，与 R25 的安全说明对齐。
