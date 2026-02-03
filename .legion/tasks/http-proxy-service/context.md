# HTTP Proxy Service 实现 - 上下文

## 会话进展 (2026-01-26)

### ✅ 已完成

- 加载 legionmind skill
- 创建任务提案并获得批准
- 生成 RFC 文档（rfc.md）
- 生成 Dev Spec（spec-dev.md）
- 生成 Test Spec（spec-test.md）
- 生成 Bench Spec（spec-bench.md）
- 生成 Observability Spec（spec-obs.md）
- 加载 legionmind skill
- 创建任务提案并获得批准
- 生成 RFC 文档（rfc.md）
- 生成 Dev Spec（spec-dev.md）
- 生成 Test Spec（spec-test.md）
- 生成 Bench Spec（spec-bench.md）
- 生成 Observability Spec（spec-obs.md）
- 设计自检与用户确认
- Review Agent 评审 Label Selector 设计
- 考察现有 Terminal tags 和路由机制
- 加载 legionmind skill
- 创建任务提案并获得批准
- 生成 RFC 文档（rfc.md）
- 生成 Dev Spec（spec-dev.md）
- 生成 Test Spec（spec-test.md）
- 生成 Bench Spec（spec-bench.md）
- 生成 Observability Spec（spec-obs.md）
- 设计自检与用户确认
- Review Agent 评审 Label Selector 设计
- 考察现有 Terminal tags 和路由机制
- 修改设计为 JSON Schema 路由方案
- 更新 RFC 文档
- 更新 Dev Spec 文档
- 更新 plan.md
- 加载 legionmind skill
- 创建任务提案并获得批准
- 生成 RFC 文档（rfc.md）
- 生成 Dev Spec（spec-dev.md）
- 生成 Test Spec（spec-test.md）
- 生成 Bench Spec（spec-bench.md）
- 生成 Observability Spec（spec-obs.md）
- 设计自检与用户确认
- Review Agent 评审 Label Selector 设计
- 考察现有 Terminal tags 和路由机制
- 修改设计为 JSON Schema 路由方案
- 更新 RFC 文档
- 更新 Dev Spec 文档
- 更新 plan.md
- 响应 RFC 中的 review（部分匹配问题）
- 加载 legionmind skill
- 创建任务提案并获得批准
- 生成 RFC 文档（rfc.md）
- 生成 Dev Spec（spec-dev.md）
- 生成 Test Spec（spec-test.md）
- 生成 Bench Spec（spec-bench.md）
- 生成 Observability Spec（spec-obs.md）
- 设计自检与用户确认
- Review Agent 评审 Label Selector 设计
- 考察现有 Terminal tags 和路由机制
- 修改设计为 JSON Schema 路由方案
- 更新 RFC 文档
- 更新 Dev Spec 文档
- 更新 plan.md
- 响应 RFC 中的 review（部分匹配问题）
- 用户确认采纳方案 1（移除 required）
- 加载 legionmind skill
- 创建任务提案并获得批准
- 生成 RFC 文档（rfc.md）
- 生成 Dev Spec（spec-dev.md）
- 生成 Test Spec（spec-test.md）
- 生成 Bench Spec（spec-bench.md）
- 生成 Observability Spec（spec-obs.md）
- 设计自检与用户确认
- Review Agent 评审 Label Selector 设计
- 考察现有 Terminal tags 和路由机制
- 修改设计为 JSON Schema 路由方案
- 更新 RFC 文档
- 更新 Dev Spec 文档
- 更新 plan.md
- 响应 RFC 中的 review（部分匹配问题）
- 用户确认采纳方案 1（移除 required）
- 更新所有文档以反映部分匹配特性
- 创建 @yuants/http-services 包基础结构与配置（package.json/tsconfig/api-extractor/rig/typescript/jest）
- 实现 HTTP Proxy 服务端与客户端代码（JSON Schema 路由 + fetch/timeout）
- 生成 API 报告文件 etc/http-services.api.md
- 执行 rush build -t @yuants/http-services 完成编译验证（含测试日志噪声）
- 完成 SSRF/DoS/Info Leak 修复
- 实现 HTTP Proxy Service benchmark 脚本（setup/index），包含阈值判定与结果 JSON 输出
- impl-dev 完成包结构与核心实现（含 JSON Schema 路由与安全修复）
- impl-test 完成单元/集成测试文件
- impl-bench 完成 benchmark 脚本与阈值判定
- review-code 完成代码评审（建议加强 referrerPolicy 类型）
- review-security 完成安全评审并给出修复建议
- 生成 walkthrough 与 PR body 文档
- impl-dev 完成包结构与核心实现（含 JSON Schema 路由与安全修复）
- impl-test 完成单元/集成测试文件
- impl-bench 完成 benchmark 脚本与阈值判定
- review-code 完成代码评审（建议加强 referrerPolicy 类型）
- review-security 完成安全评审并给出修复建议
- 生成 walkthrough 与 PR body 文档
- 修复 client.test.ts 和 server.test.ts 中的 WebSocket 连接错误与异步泄漏
- rush build -t @yuants/http-services 构建成功
- 修复单元测试 WebSocket 连接错误：用 mock connection 避免真实 WS 连接（client.test.ts/server.test.ts）
- server.test.ts 使用 spy 捕获 handler 避免依赖内部 \_mapMethodToService
- provideHTTPProxyService 注入 labels 到 terminal.terminalInfo.tags
- integration.test.ts 标记为 skip 以避免无 Host 环境超时
- rush build -t @yuants/http-services 通过（但有 Jest worker 未退出警告）
- 执行 rush build -t @yuants/http-services（测试通过但有 Jest open handles 警告）
- 集成测试改为本地 Host + 本地 HTTP Server（使用 app-host/lib）
- 执行 rush build -t @yuants/http-services（通过但仍有 Jest open handles 警告）
- 集成测试改为使用 apps/host/lib 启动 Host，并使用本地 HTTP Server
- 尝试通过 Rush 传递 --detectOpenHandles（不支持）
- 尝试用 pnpm exec heft test（pnpm 报错 rawSpec.startsWith）
- 集成测试增加 DEBUG_OPEN_HANDLES 诊断输出（未捕获句柄列表）
- 执行 DEBUG_OPEN_HANDLES=true rush build 仍提示 open handles
- 启用 jest detectOpenHandles（maxWorkers=1）并通过 rush build -t @yuants/http-services
- 将 HTTPProxy 错误处理改为 newError/scopeError 抛出
- 更新 server.test.ts 断言异常行为
- 更新 RFC 与 Dev Spec 错误处理说明
- 临时启用 detectOpenHandles/maxWorkers=1 进行定位后已回退
- 执行 rush build -t @yuants/http-services（仍有 open handles 警告）
- 将集成测试 Host 子进程 stdio 改为 ignore 并调整类型（未消除 open handles 警告）
- 执行 rush build -t @yuants/http-services（仍有 open handles 警告）
- 修复 bench 启动流程：自动启动本地 Host（apps/host/lib）并使用动态端口
- 执行 bench（rushx bench，HOST_URL=ws://localhost:8888）并通过全部阈值
- 将 walkthrough 报告改为中文
- client.ts 改为 fetch 兼容接口，支持 terminal 注入并返回 Response
- Updated RFC with Section 7 'Implementation Details' covering server.ts modifications
- Added 'Prometheus Label Cardinality' to Security Considerations in RFC

### 🟡 进行中

(暂无)

### ⚠️ 阻塞/待定

(暂无)

---

## Benchmark 记录

**新增 benchmark**:

- `libraries/http-services/benchmarks/setup.ts`：本地 HTTP 测试服务器 + 代理/客户端 Terminal 启动
- `libraries/http-services/benchmarks/index.ts`：基准主入口，固定采样参数与阈值判定

**执行方式**:

```bash
cd libraries/http-services
npm run bench
```

可选：

```bash
cd libraries/http-services
npm run bench:profile
npm run bench:flame
```

**环境假设**:

- 需要本地 Terminal Host：`ws://localhost:8888`（可通过 `HOST_URL` 覆盖）
- 本地测试 HTTP Server 端口：`3000`

**采样参数**:

- iterations: 1000
- concurrency: 10
- high concurrency: 100
- warmup requests: 1

**输出格式**:

- 控制台固定字段：Requests/Duration/RPS/Latency
- 每场景输出 `ResultJSON: { ... }`，含 iterations/concurrency/rps/p50/p95/p99/threshold/pass

**阈值判定**:

- Light Load RPS >= 500
- Medium Load RPS >= 200
- Heavy Load RPS >= 50
- High Concurrency P95 <= 500ms
- 任一场景未达标：进程退出码为 1

## 关键文件

- `libraries/http-services/benchmarks/setup.ts`
- `libraries/http-services/benchmarks/index.ts`

---

## 关键决策

| 决策                                                           | 原因                                                                                                                                                                                                                                | 替代方案                                                        | 日期       |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------- |
| 使用 Record<string, string> 作为 HTTP headers 类型             | 简化类型定义，避免 Headers 对象的复杂性。虽然不支持多值 header（如多个 Set-Cookie），但覆盖了 99% 的使用场景。                                                                                                                      | 使用原生 Headers 对象或 Record<string, string[]>                | 2026-01-26 |
| Body 使用字符串而非 ArrayBuffer                                | 简化序列化，JSON 友好。大多数 HTTP API 使用 JSON/text 格式。                                                                                                                                                                        | 支持二进制流（ArrayBuffer）或使用 Terminal 的 frame 机制        | 2026-01-26 |
| Label 选择器参考 Kubernetes                                    | 成熟的业界标准，支持 matchLabels（精确匹配）和 matchExpressions（表达式），灵活且易于理解。                                                                                                                                         | 自定义查询语言（如 SQL-like）                                   | 2026-01-26 |
| 使用 JSON Schema 路由机制替代 LabelSelector                    | Terminal 已有成熟的 JSON Schema 路由机制（参考 ListProducts、GetQuotes）。将 labels 放入请求体 Schema，利用现有的 validator 路由，无需新增 filter 逻辑。虽然表达力受限（只支持精确匹配），但覆盖了 95% 场景，且与现有模式一致性高。 | 自定义 LabelSelector（K8s 风格）                                | 2026-01-26 |
| 移除 JSON Schema 中的 required 约束，支持部分匹配              | 用户反馈希望支持部分匹配。移除 required 后，客户端可以只提供部分 labels（如 { region: 'us-west' }），只要值匹配即可路由到对应的代理节点。这提高了灵活性，同时保持了精确值匹配的特性。                                               | 保持 required 约束（客户端必须提供所有 Server 端定义的 labels） | 2026-01-26 |
| 增加 allowedHosts 和 maxResponseBodySize 选项以增强安全性      | 响应安全评审指出的 SSRF 和 DoS 风险，必须限制可访问的主机和响应体大小。                                                                                                                                                             | 不进行限制（不安全），或者使用复杂的 ACL 策略（过度设计）       | 2026-01-26 |
| HTTPProxy JSON Schema 使用 as const 收窄类型以兼容 JSONSchema7 | 解决 TS2345 类型不匹配，保持 schema 与 Terminal 路由一致                                                                                                                                                                            | 引入 JSONSchema7 类型断言或从 @types/json-schema 导入显式类型   | 2026-01-26 |
| 通过 allowedHosts 白名单和 maxResponseBodySize 限制响应体大小  | 满足安全评审并避免 SSRF/DoS 风险                                                                                                                                                                                                    | 仅记录警告不限制或使用复杂 ACL                                  | 2026-01-26 |
| 单元测试改用 mock connection 而非真实 WebSocket                | 避免无 Host 环境下的连接错误与异步泄漏                                                                                                                                                                                              | 启动本地 Host 运行真实连接；在 jest 环境 mock ws 包             | 2026-01-26 |
| 集成测试暂时 skip（无 Host 环境）                              | 当前 monorepo CI/本地未提供 ws://localhost:8888 Host，测试易超时；先保证单元测试与构建稳定。                                                                                                                                        | 引入本地 Host 或 mock transport 以启用集成测试                  | 2026-01-26 |
| 集成测试使用 app-host/lib 启动本地 Host                        | 仓库已包含 apps/host/lib 构建产物，可直接启动 Host，无需 ts-node 或 mock transport。                                                                                                                                                | 使用 ts-node 运行 apps/host/src 或继续 mock connection          | 2026-01-26 |
| bench 自动启动本地 Host（apps/host/lib/index.js）              | 避免依赖外部 ws://localhost:8888 Host，保证 bench 可独立运行                                                                                                                                                                        | 要求用户手动启动 Host 并设置 HOST_URL                           | 2026-01-26 |

---

## 快速交接

**下次继续从这里开始：**

1. 如需同步 PR body 为中文，可继续调整 `docs/pr-body.md`

**注意事项：**

- `docs/report-walkthrough.md` 已改为中文版本

---

_最后更新: 2026-01-26 23:12 by Claude_
