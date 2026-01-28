# HTTP Proxy App Implementation

## 目标

Create a simple @yuants/app-http-proxy application that starts a terminal and registers an HTTP service using http-services.

## 要点

- Simple application wrapper around http-services
- Registers as a Terminal
- Exposes HTTP service capability
- Configurable via Environment Variables

## 范围

- apps/http-proxy

## 阶段概览

1. **Design** - 3 个任务
2. **Implementation** - 2 个任务

---

## Review

> [REVIEW:blocking] docs/spec-dev.md:24-30 - 配置只覆盖 TERMINAL_ID/HOST_URL/REGION，但未要求或配置 `allowedHosts`。`provideHTTPProxyService` 在 `allowedHosts` 为空时等于开放代理，存在 SSRF 风险。请新增 `ALLOWED_HOSTS`（逗号分隔）并默认 fail fast，或在文档中明确这是可接受的风险与隔离前提。
>
> [RESPONSE] 已在 spec-dev 中新增 ALLOWED_HOSTS 并要求为空 fail fast，同时在 RFC 中声明安全默认，避免开放代理。
> [STATUS:resolved] > [REVIEW:blocking] docs/spec-dev.md:24-28, docs/rfc.md:11 - 方案声明支持 `TERMINAL_ID` 默认 `http-proxy`，但 `Terminal.fromNodeEnv()` 不读取该变量，会导致 terminal_id 每次启动随机。需明确使用 `new Terminal(HOST_URL, { terminal_id })` 或扩展 `fromNodeEnv`，否则与目标不一致。
>
> [RESPONSE] 已补充 maxResponseBodySize、concurrent、max_pending_requests 的环境变量映射。
>
> [RESPONSE] 补充更正：已在 spec-dev 明确使用 new Terminal(HOST_URL, { terminal_id }) 并保留 TERMINAL_ID 默认值。
> [STATUS:resolved] > [REVIEW:blocking] 方案未明确 ws/wss 安全默认、鉴权/授权边界、输入校验与资源限制、日志脱敏要求。
>
> [RESPONSE] 已在 RFC/spec-dev 增加 ws/wss 安全默认、鉴权边界说明、资源限制与日志脱敏要求。
> [STATUS:resolved] > [REVIEW:suggestion] docs/spec-dev.md:23-30 - 建议补充 `labels` 规则（例如 `REGION`/`TIER`/`IP`）并明确传入 `provideHTTPProxyService(terminal, labels, options)`，便于客户端路由选择与运维定位。
>
> [RESPONSE] 已在 spec-dev 增加 labels 映射与传参说明。
> [STATUS:resolved] > [REVIEW:suggestion] docs/spec-dev.md:23-30 - 建议补充 `maxResponseBodySize`、`concurrent`、`max_pending_requests` 等 `IServiceOptions` 的环境变量映射，避免默认值与部署预期不一致。
>
> [RESPONSE] 已在 spec-dev 补充 maxResponseBodySize/concurrent/max_pending_requests 环境变量映射。
> [STATUS:resolved] > [REVIEW:suggestion] docs/spec-test.md:8-13 - 集成测试可补充“如何验证服务注册”（如通过 Host terminalInfo/serviceInfo 查询或复用 `libraries/http-services` 的集成测试方式），便于落地。
>
> [RESPONSE] 已在 spec-test 补充服务注册验证方式说明。
> [STATUS:resolved] > [REVIEW:suggestion] apps/http-proxy/package.json - `@yuants/utils` 未被入口使用，建议移除以避免依赖漂移与无效安装。
>
> [RESPONSE] 已移除未使用的 @yuants/utils 依赖。
> [STATUS:resolved] > [REVIEW:suggestion] apps/http-proxy/src/index.ts:44-48 - `max_pending_requests` 采用 snake_case 与其他 options 的 camelCase 混用，建议确认 `IServiceOptions` 期望字段并统一命名，避免配置无效。
>
> [RESPONSE] IServiceOptions 定义为 snake_case（max_pending_requests），保留现有字段避免失效。
> [STATUS:wontfix] > [REVIEW:suggestion] apps/http-proxy/src/index.ts:64-75 - `dispose()`/`terminal.dispose()` 缺少错误兜底与超时处理，建议用 try/catch 包裹并记录错误，避免优雅关闭流程被中断。
>
> [RESPONSE] 已为 shutdown 增加 try/catch 与错误日志。
> [STATUS:resolved] > [REVIEW:blocking] 安全与威胁建模审查（只读）
> 结论: FAIL
> Blocking:
>
> - 资源耗尽风险: `CONCURRENT`/`MAX_PENDING_REQUESTS` 默认未设置且未做上限校验，可能导致默认无限并发/排队，不符合 secure-by-default。
> - 输入校验不足: `MAX_RESPONSE_BODY_SIZE`/`CONCURRENT`/`MAX_PENDING_REQUESTS` 允许负值或过大值，可能放大内存/队列占用。
>   修复建议:
> - 为 `CONCURRENT`/`MAX_PENDING_REQUESTS` 设置保守默认值并强制上限（例如 100/1000），同时拒绝非正数。
> - 为 `MAX_RESPONSE_BODY_SIZE` 设定合理范围（例如 1KB–50MB），并在解析时校验上下界，超出直接拒绝启动。
>
> [RESPONSE] 已为 CONCURRENT/MAX_PENDING_REQUESTS 设置默认值与上限，并对 MAX_RESPONSE_BODY_SIZE/CONCURRENT/MAX_PENDING_REQUESTS 增加范围校验。
> [STATUS:resolved]

_创建于: 2026-01-28 | 最后更新: 2026-01-28_
