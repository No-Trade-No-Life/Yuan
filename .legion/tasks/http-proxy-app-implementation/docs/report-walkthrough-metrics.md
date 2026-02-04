# Walkthrough 报告：HTTP Proxy 目标域名指标

## 目标与范围

- 目标：为 HTTP Proxy 增加“目标域名”维度的请求计数指标，便于按域名聚合观测，不改变现有请求处理与 SSRF 行为。
- 范围（Scope 绑定）：
  - 代码：`/Users/c1/Work/Yuan/libraries/http-services/src/server.ts`
  - 测试：`/Users/c1/Work/Yuan/libraries/http-services/src/__tests__/server.test.ts`
  - 设计与评审：
    - RFC：`/Users/c1/Work/Yuan/.legion/tasks/http-proxy-app-implementation/docs/rfc-metrics.md`
    - 代码审查：`/Users/c1/Work/Yuan/.legion/tasks/http-proxy-app-implementation/docs/review-code-metrics.md`
    - 安全审查：`/Users/c1/Work/Yuan/.legion/tasks/http-proxy-app-implementation/docs/review-security-metrics.md`

## 设计摘要

- 设计真源：`/Users/c1/Work/Yuan/.legion/tasks/http-proxy-app-implementation/docs/rfc-metrics.md`
- 关键设计点：
  - 指标解析仅复用 handler 内 `new URL(req.url)` 的 `parse_result`，不做二次解析。
  - `target_host`：IP 字面量固定为 `ip`，解析失败或 hostname 为空为 `invalid`，其余按 `allowedHosts` 规范化命中则记录主机名，否则为 `disallowed`。
  - `result`：仅基于 handler 返回/抛错与 `error.code`/等价信号映射（TIMEOUT/FORBIDDEN/INVALID_URL 等），未命中为 `error`。
  - `allowedHosts` 仅作为基数控制（规范化匹配，含端口仅告警且不匹配）；空/缺失时不注册目标域名指标并告警。
- 可选插件产物：无。

## 改动清单

- 业务逻辑（`server.ts`）：
  - 新增指标 `http_proxy_target_host_requests_total`，注册条件与计数点落在请求生命周期末尾。
  - 增加 `target_host` 与 `result` 解析逻辑，复用 `parse_result` 与错误码映射。
  - 对 `allowedHosts` 进行规范化匹配，含端口的配置仅告警且不参与匹配。
- 单元测试（`server.test.ts`）：
  - 覆盖 `invalid_url`/空 hostname/IP 字面量/allowedHosts 端口告警等指标行为。

## 如何验证

1. 运行构建与测试（库内）：

```bash
cd /Users/c1/Work/Yuan/libraries/http-services
rushx build
```

预期：构建通过，Jest 用例通过（与 `server.test.ts` 相关的 metrics 用例全部为 PASS）。

2. 手工验证（可选）：

- 通过真实代理请求触发不同 target_host/result，确认 metrics 中 `target_host` 仅出现白名单命中或固定占位符。

## Benchmark 结果或门槛说明

- 未提供 benchmark 结果；本次变更未执行基准测试。

## 可观测性（metrics/logging）

- 新增指标：`http_proxy_target_host_requests_total{target_host,result}`。
- 相关指标仍保留：`http_proxy_requests_total`、`http_proxy_request_duration_seconds`、`http_proxy_active_requests`、`http_proxy_errors_total`。
- 日志：
  - allowedHosts 为空/缺失时输出一次告警并禁用 target_host 指标。
  - allowedHosts 项包含端口时输出一次告警。
  - 被阻断的主机名会记录 warn（已有行为）。

## 风险与回滚

- 风险：
  - 安全审查中对 `allowedHosts` 为空导致开放代理风险、`req.timeout` 无上限的 DoS 风险标记为 wontfix（见安全审查报告）。
  - 日志中可能包含被阻断的 hostname（潜在信息泄露风险）。
- 回滚：
  - 删除/禁用 `http_proxy_target_host_requests_total` 的注册与计数点（`server.ts`），并回滚相关测试断言。

## 未决项与下一步

- 未决项（来自代码审查建议）：
  - 增补 allowedHosts 规范化命中/未命中测试与“allowedHosts 为空不注册指标”测试。
  - 若 `resolveResultFromError` 继续保留，应补充覆盖测试；否则删除以降低维护成本。
- 下一步建议：
  - 如需提升安全基线，评估对 `allowedHosts` 空值的 fail-fast 与 `req.timeout` 上限裁剪的可行性。
