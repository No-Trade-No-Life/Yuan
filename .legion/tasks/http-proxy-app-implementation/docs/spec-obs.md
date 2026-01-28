# Specification: Observability

## 1. 日志 (Logs)

- 格式: 纯文本或 JSON (取决于全局配置)。
- 关键事件:
  - `INFO`: "[http-proxy] received {signal}, shutting down"
  - `ERROR`: "[http-proxy] shutdown failed"
  - `ERROR`: "[http-proxy] shutdown timeout, forcing exit"
- 脱敏要求: 不记录完整 URL/Authorization/Cookie 等敏感信息，仅输出 host 与错误码。

## 2. 指标 (Metrics)

- 使用 `@yuants/protocol` 内置的 Terminal 指标（连接状态、消息吞吐）。
- `http-services` 内部提供的请求计数指标（如有）。
