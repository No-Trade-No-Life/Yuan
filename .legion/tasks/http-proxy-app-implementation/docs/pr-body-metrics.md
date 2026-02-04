## What

为 HTTP Proxy 增加目标域名+路径维度的请求计数指标 `http_proxy_target_host_requests_total`，并在现有 handler 末尾采集 `target_host`、`target_path` 与 `result`。

## Why

当前仅有总量/耗时/错误指标，缺少目标域名维度导致流量分布与异常排查困难。

## How

- 复用 handler 内 `new URL(req.url)` 的解析结果（`parse_result`），不做二次解析。
- `target_host` 使用解析结果规范化或固定占位符（`ip`/`invalid`）。
- `target_path` 使用 `parse_result.pathname`，为空则 `/`。
- `result` 仅基于 handler 抛错与错误码映射，未命中统一为 `error`。

## Testing

```bash
cd /Users/c1/Work/Yuan/libraries/http-services
rushx build
```

## Risk / Rollback

- 安全审查中标注：开放代理风险与 timeout 无上限 DoS 风险为 wontfix（见安全审查报告）。
- 回滚：移除 `http_proxy_target_host_requests_total` 的注册与计数逻辑，并回滚相关测试。

## Links

- RFC: `/Users/c1/Work/Yuan/.legion/tasks/http-proxy-app-implementation/docs/rfc-metrics.md`
- Walkthrough: `/Users/c1/Work/Yuan/.legion/tasks/http-proxy-app-implementation/docs/report-walkthrough-metrics.md`
- Code Review: `/Users/c1/Work/Yuan/.legion/tasks/http-proxy-app-implementation/docs/review-code-metrics.md`
- Security Review: `/Users/c1/Work/Yuan/.legion/tasks/http-proxy-app-implementation/docs/review-security-metrics.md`
