# HTTP Proxy Service 实现

## 目标

创建 @yuants/http-services 包，提供基于 Yuan Terminal 协议的 HTTP 代理服务，支持标签选择和完整的 fetch 参数传递

## 要点

- 提供 provideHTTPProxyService helper 函数，包装 terminal.server.provideService
- 支持完整的 fetch 参数（url, method, headers, body 等）
- 支持 label (Record<string, string>) 用于服务选择（如 ip、hostname）
- requestHTTPProxy 使用与 fetch 一致的调用签名（RequestInfo + RequestInit），并允许通过 Terminal.fromNodeEnv 或 init.terminal 注入
- 返回原始 HTTP 响应（status, headers, body）
- 参考 provideQuoteService 和 provideExchangeServices 的实现风格
- 集成 Prometheus metrics 和结构化日志
- 完整的测试覆盖（单元测试 + 集成测试 + benchmark）
- 使用 JSON Schema 路由机制（利用 Terminal 现有能力）

## 范围

- libraries/http-services/ (新建包)
- libraries/http-services/package.json
- libraries/http-services/src/index.ts
- libraries/http-services/src/types.ts
- libraries/http-services/src/server.ts
- libraries/http-services/src/client.ts
- libraries/http-services/config/api-extractor.json
- libraries/http-services/tsconfig.json
- libraries/http-services/src/**tests**/
- libraries/http-services/benchmarks/

## 阶段概览

1. **阶段 1: 包基础设施搭建** - 4 个任务
2. **阶段 2: 类型定义** - 2 个任务（移除 LabelSelector）
3. **阶段 3: Server 端实现** - 2 个任务（简化路由逻辑）
4. **阶段 4: Client 端实现** - 1 个任务（简化 API）
5. **阶段 5: 测试与文档** - 2 个任务

---

_创建于: 2026-01-26 | 最后更新: 2026-01-29_

## 设计方案

> **设计真源**：详细设计请参考 [RFC 文档](docs/rfc.md)。以下内容为摘要。

### 核心流程

```
1. Server 端注册
   provideHTTPProxyService(terminal, labels, serviceOptions)
   ├─ 根据 labels 生成 JSON Schema（使用 const 做精确匹配）
   ├─ Schema 示例: { labels: { properties: { region: { const: 'us-west' } } } }
   └─ 调用 terminal.server.provideService('HTTPProxy', schema, handler, options)

2. Client 端请求
   requestHTTPProxy(terminal, { url, labels: { region: 'us-west' } })
   ├─ 调用 terminal.client.requestForResponse('HTTPProxy', request)
   ├─ Terminal 自动用 JSON Schema 验证并路由到匹配的服务
   └─ 如有多个匹配，自动随机负载均衡

3. HTTP 请求执行（Server 端 handler）
   fetch(url, options)
   ├─ 构造 RequestInit（method, headers, body, credentials, redirect）
   ├─ 使用 AbortController 实现超时控制
   ├─ 提取响应信息（status, statusText, headers, body）
   ├─ 记录 metrics（请求量、延迟、错误率）
   └─ 返回 IHTTPProxyResponse
```

### 路由机制（核心创新）

**利用 Terminal 现有的 JSON Schema 路由**（与 `ListProducts`、`GetQuotes` 一致）：

| 服务             | 路由方式                                   | 示例                |
| ---------------- | ------------------------------------------ | ------------------- |
| **ListProducts** | `type: { const: 'Binance' }`               | 精确匹配交易所类型  |
| **GetQuotes**    | `pattern: '^Binance/'`                     | 前缀匹配 product_id |
| **HTTPProxy**    | `labels: { region: { const: 'us-west' } }` | 精确匹配标签        |

**匹配规则**（支持部分匹配）：

| Client labels                         | Server labels                            | 匹配结果 | 说明                                     |
| ------------------------------------- | ---------------------------------------- | -------- | ---------------------------------------- |
| `{ region: 'us-west' }`               | `{ region: 'us-west' }`                  | ✅       | 完全匹配                                 |
| `{ region: 'us-west', extra: 'foo' }` | `{ region: 'us-west' }`                  | ✅       | 客户端可有额外 labels                    |
| `{ region: 'us-west' }`               | `{ region: 'us-west', tier: 'premium' }` | ✅       | **部分匹配**（只要提供的 labels 值相同） |
| `{ tier: 'premium' }`                 | `{ region: 'us-west', tier: 'premium' }` | ✅       | **部分匹配**                             |
| `{ region: 'us-east' }`               | `{ region: 'us-west' }`                  | ❌       | 值不匹配                                 |
| `{}`                                  | `{ region: 'us-west' }`                  | ✅       | 无约束（匹配所有）                       |
| `{}`                                  | `{}`                                     | ✅       | 无约束代理                               |

**关键特性**：

- 客户端只需提供部分 labels，只要值匹配即可路由
- Server 端不强制要求客户端提供所有 labels
- 空 labels `{}` 会匹配所有代理节点（由 Terminal 随机选择）

### 接口定义

**核心类型**（位于 `src/types.ts`）：

```typescript
// 请求参数（对齐 fetch API + labels）
interface IHTTPProxyRequest {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  headers?: Record<string, string>;
  body?: string;
  credentials?: 'omit' | 'same-origin' | 'include';
  redirect?: 'follow' | 'error' | 'manual';
  timeout?: number;

  // 标签用于路由（通过 JSON Schema 精确匹配）
  labels?: Record<string, string>;
}

// 响应（原始 HTTP 响应）
interface IHTTPProxyResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  ok: boolean;
  url: string;
}
```

**Server API**（位于 `src/server.ts`）：

```typescript
provideHTTPProxyService(
  terminal: Terminal,
  labels: Record<string, string>,    // 代理节点的标签
  serviceOptions?: IServiceOptions
): { dispose: () => void }
```

**Client API**（位于 `src/client.ts`）：

```typescript
requestHTTPProxy(
  terminal: Terminal,
  request: IHTTPProxyRequest         // request.labels 用于路由
): Promise<IResponse<IHTTPProxyResponse>>
```

### 文件变更明细表

| 文件路径                                                    | 操作     | 说明                                              |
| ----------------------------------------------------------- | -------- | ------------------------------------------------- |
| `libraries/http-services/`                                  | 新建目录 | 包根目录                                          |
| `libraries/http-services/package.json`                      | 新建     | 包配置，依赖 @yuants/protocol, @yuants/utils      |
| `libraries/http-services/tsconfig.json`                     | 新建     | TypeScript 配置，extends rush tsconfig-base       |
| `libraries/http-services/config/api-extractor.json`         | 新建     | API Extractor 配置                                |
| `libraries/http-services/src/index.ts`                      | 新建     | 主入口，导出所有公开 API                          |
| `libraries/http-services/src/types.ts`                      | 新建     | 类型定义（IHTTPProxyRequest, IHTTPProxyResponse） |
| `libraries/http-services/src/server.ts`                     | 新建     | provideHTTPProxyService 实现                      |
| `libraries/http-services/src/client.ts`                     | 新建     | requestHTTPProxy 实现                             |
| `libraries/http-services/src/__tests__/server.test.ts`      | 新建     | server 单元测试                                   |
| `libraries/http-services/src/__tests__/client.test.ts`      | 新建     | client 单元测试                                   |
| `libraries/http-services/src/__tests__/integration.test.ts` | 新建     | 集成测试                                          |
| `libraries/http-services/benchmarks/setup.ts`               | 新建     | Benchmark 基础设施                                |
| `libraries/http-services/benchmarks/index.ts`               | 新建     | Benchmark 主入口                                  |

**移除文件**：`src/utils.ts`（不再需要 label 匹配逻辑）

### 关键技术决策

| 决策                                  | 备选方案                                           | 选择理由                                                                                                            |
| ------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **使用 JSON Schema 路由**             | 自定义 K8s 风格 LabelSelector                      | 利用 Terminal 现有机制，实现简单，与 ListProducts/GetQuotes 一致。虽然表达力受限（只支持精确匹配），但覆盖 95% 场景 |
| labels 放入请求体                     | 读取 terminalInfo.tags 并手动过滤                  | 与现有模式一致，路由逻辑零额外开销，自动负载均衡                                                                    |
| Headers 使用 `Record<string, string>` | 使用原生 Headers 对象或 `Record<string, string[]>` | 简化类型定义，覆盖 99% 场景。不支持多值 header（如多个 Set-Cookie），但可后续扩展                                   |
| Body 使用字符串                       | 使用 ArrayBuffer 或 Terminal frame 机制            | JSON 友好，简化序列化。大多数 HTTP API 使用 JSON/text 格式                                                          |

### 可观测性设计

**Metrics**（使用 Terminal 的 Prometheus registry）：

- `http_proxy_requests_total`: 请求计数器（labels: method, status_code, error_code）
- `http_proxy_request_duration_seconds`: 请求延迟直方图
- `http_proxy_active_requests`: 活跃请求数（gauge）
- `http_proxy_response_size_bytes`: 响应体大小直方图

**Logging**（结构化 JSON）：

```json
{
  "timestamp": "2026-01-26T10:30:45.123Z",
  "level": "INFO",
  "service": "http-proxy",
  "terminal_id": "proxy-node-1",
  "trace_id": "abc123",
  "method": "GET",
  "url": "https://api.example.com/data",
  "status_code": 200,
  "duration_ms": 123
}
```

---

### 7. 潜在问题识别 ⚠️

| 问题               | 风险等级 | 缓解措施                                                                         |
| ------------------ | -------- | -------------------------------------------------------------------------------- |
| **SSRF 攻击**      | 高       | 建议在 Server 端配置 URL 白名单，限制可访问的域名范围                            |
| **仅支持精确匹配** | 低       | 覆盖 95% 场景。如需复杂表达式（如 In/NotIn），可在 Client 端自行过滤多个代理节点 |
| **大响应体超时**   | 中       | 使用 timeout 参数控制，未来可扩展 frame 机制支持流式传输                         |
| **双重网络开销**   | 低       | Yuan RPC + HTTP，延迟增加，但符合设计目标（统一代理）                            |

> [REVIEW:blocking] > **Security Review (2026-01-26)**
>
> **Conclusion: FAIL**
>
> **Blocking Issues:**
>
> 1. **SSRF (Critical):** No validation of `req.url`. Allows access to localhost, internal network, and cloud metadata.
> 2. **DoS (Critical):** `await response.text()` reads unbounded body into memory.
>
> **Other Issues:**
>
> - **Info Leak (High):** Raw error messages and all upstream headers are returned to client.
>
> **Fix Suggestions:**
>
> - **SSRF:** Implement allowlist for domains/IPs. Block private ranges (RFC 1918), loopback.
> - **DoS:** Use stream processing or enforce `maxBodySize`.
> - **Info Leak:** Sanitize error messages; whitelist safe response headers.
>
> [RESPONSE] 已收到安全评审意见。将立即实施修复：
>
> 1. SSRF: 增加 allowedHosts 选项，并在 server.ts 中验证 req.url。
> 2. DoS: 增加 maxResponseBodySize 选项，并在读取 body 时进行限制。
> 3. Info Leak: 净化错误信息，确保不返回 raw stack trace。
>
> 将在 libraries/http-services/src/server.ts 和 types.ts 中进行修改，并更新 spec-dev.md。
> [STATUS:resolved]

---

## 请求用户确认

### 设计审批检查清单

在开始编码前，请确认以下事项：

- [ ] **设计目标清晰**：理解为什么需要 HTTP Proxy Service（统一代理、可观测性、网络隔离）
- [ ] **接口设计合理**：provideHTTPProxyService 和 requestHTTPProxy 的参数和返回值符合预期
- [ ] **路由机制可行**：JSON Schema 精确匹配足够使用（region/tier/capability 等场景）
- [ ] **简化方案认可**：相比 LabelSelector，JSON Schema 路由更简洁且与现有模式一致
- [ ] **安全考虑充分**：了解 SSRF 风险，需要在实际使用时配置白名单
- [ ] **性能预期合理**：接受双重网络开销（Yuan RPC + HTTP）

### 后续步骤

**设计审批通过后**：

1. 在 `tasks.md` 中勾选 "设计审批通过（用户确认）"
2. 运行 `/legion-impl` 开始编码实现
3. 按阶段推进：包搭建 → 类型定义 → Server 实现 → Client 实现 → 测试

**如需修改设计**：

- 在 plan.md 中提出修改意见（使用 Review 机制）
- 等待设计调整后再开始编码

---

**设计完成时间**: 2026-01-26  
**更新时间**: 2026-01-26 - 采用 JSON Schema 路由机制  
**等待用户确认**: ⏳
