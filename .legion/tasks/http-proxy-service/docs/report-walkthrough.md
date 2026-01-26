# Walkthrough 报告（HTTP Proxy Service）

## 目标与范围（SUBTREE_ROOT）

- 目标：为 Yuan Terminal 提供统一的 HTTP 代理服务，支持 labels 路由、可靠的 fetch 执行与可观测性。
- SUBTREE_ROOT：`libraries/http-services`
- 范围内产物：`provideHTTPProxyService`、`requestHTTPProxy`、类型定义、测试、benchmark、`@yuants/http-services` API 文档。

## 设计摘要（RFC + Specs）

- RFC：`../docs/rfc.md`
- Dev Spec：`../docs/spec-dev.md`
- Test Spec：`../docs/spec-test.md`
- Bench Spec：`../docs/spec-bench.md`
- Observability Spec：`../docs/spec-obs.md`

关键设计：

- 路由使用 Terminal JSON Schema 的 `const` 约束（labels），支持部分匹配，无需额外 selector。
- 安全保护：`allowedHosts` 白名单与 `maxResponseBodySize` 限制。
- 错误处理：统一抛出 `newError` / `scopeError`，由 Terminal Server 将异常转为响应。

## 变更清单（按模块/类型）

- 运行时（src）：`libraries/http-services/src/server.ts`、`libraries/http-services/src/client.ts`、`libraries/http-services/src/types.ts`
- 测试：`libraries/http-services/src/__tests__/`
- Benchmark：`libraries/http-services/benchmarks/`
- 构建配置：`libraries/http-services/package.json`、`libraries/http-services/config/*`、`libraries/http-services/tsconfig.json`
- API 报告：`libraries/http-services/etc/http-services.api.md`

## 验证方式（命令 + 结果）

构建（包含测试）：

```bash
rush build -t @yuants/http-services
```

结果：成功（Jest 仍提示 open handles，但流程正常结束）。

手动路由校验：

- 使用 `allowedHosts: ["httpbin.org"]` 启动代理，使用匹配 `labels` 请求 `https://httpbin.org/get`。
- 期望：成功；labels 不匹配不路由；host 不在白名单返回 `FORBIDDEN`。

## Benchmark（结果与阈值）

执行命令：

```bash
HOST_URL=ws://localhost:8888 rushx bench
```

本地结果：

- Light Load：RPS 2457，P95 7ms，PASS
- Medium Load：RPS 1404.49，P95 8ms，PASS
- Heavy Load：RPS 64.30，P95 188ms，PASS
- High Concurrency：RPS 1923.08，P95 90ms，PASS

阈值（来自 spec）：

- Light：RPS >= 500
- Medium：RPS >= 200
- Heavy：RPS >= 50
- High Concurrency：P95 <= 500ms

## 可观测性（metrics/logging）

- Metrics：
  - `http_proxy_requests_total`（labels: method, status_code, error_code）
  - `http_proxy_request_duration_seconds`
  - `http_proxy_active_requests`
  - `http_proxy_response_size_bytes`
- Logging：JSON 结构化日志，包含请求/响应元数据（service、terminal_id、method、url、status、duration）。

## 安全修复

- SSRF：URL 校验 + `allowedHosts` 白名单。
- DoS：响应体流式读取 + `maxResponseBodySize` 硬限制。
- 信息泄漏：不返回 stack trace，仅由异常类型/上下文生成错误信息。

## 风险与回滚

风险：

- 若未配置 `allowedHosts`，代理能力过宽。
- 代理转发引入额外网络延迟。

回滚：

- 停止注册 `HTTPProxy` 服务或回滚 `libraries/http-services` 变更。
- 移除调用端对 `requestHTTPProxy` 的使用。

## 待办与下一步

- 若需彻底消除 Jest open handles 警告，建议单独定位子进程/WS 句柄来源。
- 若需要更严格 SSRF 防护，可扩展为 CIDR/IP 级别过滤或支持通配白名单。
