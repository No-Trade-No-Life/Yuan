# RFC: HTTP Proxy Service for Yuan Terminal

**状态**: Draft  
**创建时间**: 2026-01-26  
**更新时间**: 2026-01-26 - 采用 JSON Schema 路由机制  
**作者**: Antigravity Agent

---

## 1. 背景与动机

### 1.1 问题陈述

在 Yuan 生态系统中，各个 Terminal 之间通过 Yuan 协议进行通信。然而，当需要访问外部 HTTP 服务时，目前的做法是直接在每个 Terminal 中使用标准的 `fetch` API。这种方式存在以下问题：

1. **缺乏统一的服务发现机制**：无法根据网络位置、地域、性能等因素选择最佳的代理节点
2. **可观测性缺失**：HTTP 请求不经过 Terminal 的 metrics 系统，难以监控和调试
3. **访问控制困难**：无法利用 Terminal 的 `IServiceOptions`（限流、并发控制）
4. **网络隔离场景不友好**：某些 Terminal 可能处于受限网络环境，无法直接访问外网

### 1.2 解决方案概览

本 RFC 提出创建 `@yuants/http-services` 包，提供基于 Yuan Terminal 协议的 HTTP 代理服务。核心思路：

- **服务端**：通过 `provideHTTPProxyService` 将某个 Terminal 注册为 HTTP 代理节点
- **客户端**：通过 `requestHTTPProxy` 发送 HTTP 请求，利用 Terminal 现有的 JSON Schema 路由机制自动选择代理
- **协议封装**：完整支持 fetch 参数（url, method, headers, body 等），返回原始 HTTP 响应

---

## 2. 设计目标

### 2.1 功能目标

- ✅ 支持完整的 HTTP 方法（GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS）
- ✅ 支持完整的 fetch 参数（headers, body, credentials, redirect, signal 等）
- ✅ 返回原始 HTTP 响应（status, statusText, headers, body）
- ✅ 支持标签选择机制（通过 `labels: Record<string, string>` 选择代理节点）
- ✅ 兼容 Yuan Terminal 的服务发现和路由机制

### 2.2 非功能目标

- ✅ **一致性**：API 风格与 `provideQuoteService`、`provideExchangeServices` 保持一致
- ✅ **可观测性**：利用 Terminal 的 metrics 系统记录请求量、延迟、错误率
- ✅ **可控性**：支持 `IServiceOptions`（并发控制、限流、队列）
- ✅ **易用性**：简洁的 API，清晰的类型定义

---

## 3. 接口设计

### 3.1 类型定义

```typescript
/**
 * HTTP 代理请求参数（对齐标准 fetch API）
 */
export interface IHTTPProxyRequest {
  /** 请求 URL */
  url: string;

  /** HTTP 方法 */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

  /** 请求头 */
  headers?: Record<string, string>;

  /** 请求体（JSON 序列化后的字符串） */
  body?: string;

  /** 凭证模式 */
  credentials?: 'omit' | 'same-origin' | 'include';

  /** 重定向模式 */
  redirect?: 'follow' | 'error' | 'manual';

  /** 引用策略 */
  referrerPolicy?: string;

  /** 超时时间（毫秒） */
  timeout?: number;

  /**
   * 标签选择器（用于路由到特定代理节点）
   * 通过 JSON Schema 精确匹配
   */
  labels?: Record<string, string>;
}

/**
 * HTTP 代理响应（原始响应）
 */
export interface IHTTPProxyResponse {
  /** HTTP 状态码 */
  status: number;

  /** HTTP 状态文本 */
  statusText: string;

  /** 响应头 */
  headers: Record<string, string>;

  /** 响应体（字符串） */
  body: string;

  /** 请求是否成功（2xx） */
  ok: boolean;

  /** 响应 URL（可能因重定向而变化） */
  url: string;
}
```

### 3.2 Server 端 API

````typescript
/**
 * 提供 HTTP 代理服务
 *
 * @param terminal - Terminal 实例
 * @param labels - 服务标签（用于客户端选择，如 { region: 'us-west', tier: 'premium' }）
 * @param serviceOptions - 服务选项（并发、限流等）
 * @returns dispose 函数
 *
 * @example
 * ```typescript
 * const terminal = Terminal.fromNodeEnv();
 *
 * provideHTTPProxyService(terminal, {
 *   region: 'us-west',
 *   tier: 'premium'
 * }, {
 *   concurrent: 10,
 *   max_pending_requests: 100
 * });
 * ```
 */
export const provideHTTPProxyService = (
  terminal: Terminal,
  labels: Record<string, string>,
  serviceOptions?: IServiceOptions
): { dispose: () => void };
````

### 3.3 Client 端 API

````typescript
/**
 * 通过代理发送 HTTP 请求
 *
 * @param terminal - Terminal 实例
 * @param request - HTTP 请求参数（包含 labels 用于路由）
 * @returns HTTP 响应
 *
 * @example
 * ```typescript
 * const terminal = Terminal.fromNodeEnv();
 *
 * // 使用 us-west 区域的代理
 * const response = await requestHTTPProxy(terminal, {
 *   url: 'https://api.example.com/data',
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ key: 'value' }),
 *   labels: { region: 'us-west' }  // 自动路由
 * });
 *
 * if (response.data?.ok) {
 *   const data = JSON.parse(response.data.body);
 *   console.log(data);
 * }
 * ```
 */
export const requestHTTPProxy = async (
  terminal: Terminal,
  request: IHTTPProxyRequest
): Promise<IResponse<IHTTPProxyResponse>>;
````

---

## 4. 技术方案

### 4.1 路由机制（核心创新）

**利用 Terminal 现有的 JSON Schema 路由**（参考 `provideQuoteService`、`provideExchangeServices`）：

1. **Server 端注册**：

   ```typescript
   provideHTTPProxyService(terminal, { region: 'us-west', tier: 'premium' });
   ```

   内部生成包含 labels 约束的 JSON Schema：

   ```json
   {
     "properties": {
       "labels": {
         "type": "object",
         "properties": {
           "region": { "const": "us-west" },
           "tier": { "const": "premium" }
         },
         "required": ["region", "tier"]
       }
     }
   }
   ```

2. **Client 端请求**：

   ```typescript
   requestHTTPProxy(terminal, {
     url: '...',
     labels: { region: 'us-west', tier: 'premium' },
   });
   ```

3. **自动路由**：
   - Terminal 的 `resolveTargetServices` 遍历所有 `HTTPProxy` 服务
   - 用 JSON Schema validator 验证 request
   - 只有 labels 完全匹配的服务才会被选中
   - 如有多个匹配，随机选一个（现有负载均衡）

### 4.2 匹配规则（支持部分匹配）

| Client labels                            | Server labels                            | 匹配结果 | 说明                                     |
| ---------------------------------------- | ---------------------------------------- | -------- | ---------------------------------------- |
| `{ region: 'us-west' }`                  | `{ region: 'us-west' }`                  | ✅       | 完全匹配                                 |
| `{ region: 'us-west', tier: 'premium' }` | `{ region: 'us-west' }`                  | ✅       | 客户端可有额外 labels                    |
| `{ region: 'us-west' }`                  | `{ region: 'us-west', tier: 'premium' }` | ✅       | **部分匹配**（只要提供的 labels 值相同） |
| `{ tier: 'premium' }`                    | `{ region: 'us-west', tier: 'premium' }` | ✅       | **部分匹配**                             |
| `{ region: 'us-east' }`                  | `{ region: 'us-west' }`                  | ❌       | 值不匹配                                 |
| `{}`                                     | `{ region: 'us-west' }`                  | ✅       | 无约束（匹配所有）                       |
| `{}`                                     | `{}`                                     | ✅       | 无约束代理                               |

**关键特性**：

- 客户端只需提供部分 labels，只要值匹配即可路由
- Server 端不强制要求客户端提供所有 labels
- 空 labels `{}` 会匹配所有代理节点（由 Terminal 随机选择）

> [REVIEW] 应该支持部分匹配。
> [RESPONSE] 理解您的需求。当前 JSON Schema 的 required 机制确实要求客户端提供所有 Server 端定义的 labels。
>
> **可以支持部分匹配**，有两种方案：
>
> **方案 1：移除 required 约束**（推荐）
> Server 端生成 Schema 时不设置 required 字段，只验证客户端提供的 labels 值是否匹配。
> 这样匹配规则变为：
>
> - Client { region: "us-west" } → Server { region: "us-west", tier: "premium" } → ✅ 匹配（只要提供的 labels 值相同）
> - Client { tier: "premium" } → Server { region: "us-west", tier: "premium" } → ✅ 匹配
> - Client {} → Server { region: "us-west" } → ✅ 匹配（无约束）
>
> **方案 2：保持 required，客户端必须提供所有 labels**
> 当前设计，更严格但也更明确。
>
> **建议采用方案 1**，在 src/server.ts 实现时移除 required 字段即可。这样既保持精确值匹配，又允许部分匹配。
>
> 是否采纳此修改？
> [STATUS:need-info]

> [REVIEW] 采纳方案 1
> [RESPONSE] 好的，已更新设计：移除 required 约束，支持部分匹配。匹配规则已更新。
> [STATUS:resolved]

### 4.3 HTTP 请求执行

**Server 端处理流程**：

```
1. 接收 IHTTPProxyRequest
2. 构造 fetch 参数（headers, body, method 等）
3. 执行 fetch(url, options)
4. 提取响应信息（status, headers, body）
5. 返回 IHTTPProxyResponse
```

**错误处理**：

- Handler 内部使用 `newError` / `scopeError` 抛出错误
- Terminal Server 捕获异常并生成 `IResponse`
- 典型错误：`FETCH_FAILED`、`TIMEOUT`、`INVALID_URL`、`FORBIDDEN`、`RESPONSE_TOO_LARGE`
- 无匹配代理由 Terminal 自动返回 `NO_TERMINAL_AVAILABLE_FOR_REQUEST`

---

## 5. 数据流示例

### 5.1 场景：Client 请求外部 API

```
┌─────────────┐                 ┌──────────────┐                 ┌─────────────┐
│  Client     │                 │  Proxy Node  │                 │  External   │
│  Terminal   │                 │  Terminal    │                 │  HTTP API   │
└──────┬──────┘                 └──────┬───────┘                 └──────┬──────┘
       │                                │                                │
       │  1. requestHTTPProxy()         │                                │
       │     + labels: { region: ...}   │                                │
       ├────────────────────────────────>│                                │
       │                                │                                │
       │  2. Terminal 自动路由           │                                │
       │     (JSON Schema 匹配)          │                                │
       │                                │                                │
       │  3. Yuan RPC 调用              │                                │
       │     method: 'HTTPProxy'        │                                │
       ├────────────────────────────────>│                                │
       │                                │  4. fetch(url, options)        │
       │                                ├───────────────────────────────>│
       │                                │                                │
       │                                │  5. HTTP Response              │
       │                                │<───────────────────────────────┤
       │                                │                                │
       │  6. Yuan RPC 响应              │                                │
       │<────────────────────────────────┤                                │
       │                                │                                │
```

---

## 6. 安全考虑

### 6.1 潜在风险

1. **SSRF 攻击**：恶意客户端可能利用代理节点访问内网资源
2. **资源滥用**：大量请求可能耗尽代理节点资源
3. **敏感信息泄露**：代理节点可以看到完整的请求和响应

### 6.2 缓解措施

1. **URL 白名单**（推荐）：

   - Server 端配置允许的域名/IP 范围
   - Schema 中使用 `pattern` 限制 URL 格式

2. **访问控制**：

   - 使用 Terminal 的身份验证机制
   - 限制特定 terminal_id 访问

3. **限流与配额**：

   - 利用 `IServiceOptions` 的 `concurrent`、`max_pending_requests`
   - 按 terminal_id 限制请求频率

4. **审计日志**：
   - 记录所有请求的 URL、source_terminal_id
   - 利用 Terminal metrics 监控异常模式

---

## 7. 性能考虑

### 7.1 瓶颈分析

- **网络延迟**：Yuan RPC + HTTP 请求，双重网络开销
- **序列化开销**：Body 需要 JSON 序列化/反序列化
- **代理节点负载**：高并发场景下可能成为瓶颈

### 7.2 优化策略

1. **连接复用**：代理节点使用 HTTP keep-alive
2. **并发控制**：合理配置 `concurrent` 参数
3. **超时设置**：避免长时间挂起的请求
4. **监控指标**：通过 metrics 识别慢请求

---

## 8. 兼容性与迁移

### 8.1 向后兼容

- 新增包，不影响现有代码
- 遵循 Yuan 生态的约定（provideService 模式）
- 使用现有的 JSON Schema 路由，无需新增机制

### 8.2 与现有服务对比

| 服务          | 路由机制                                   | 示例                |
| ------------- | ------------------------------------------ | ------------------- |
| ListProducts  | `type: { const: 'Binance' }`               | 精确匹配交易所类型  |
| GetQuotes     | `pattern: '^Binance/'`                     | 前缀匹配 product_id |
| **HTTPProxy** | `labels: { region: { const: 'us-west' } }` | 精确匹配标签        |

---

## 9. 决策记录

| 决策                                    | 理由                             | 备选方案                      | 影响                                          |
| --------------------------------------- | -------------------------------- | ----------------------------- | --------------------------------------------- |
| 使用 JSON Schema 路由替代 LabelSelector | 利用现有机制，一致性高，实现简单 | 自定义 K8s 风格 LabelSelector | 表达力受限（只支持精确匹配），但覆盖 95% 场景 |
| labels 放入请求体而非 tags              | 与 ListProducts 等现有模式一致   | 读取 terminalInfo.tags 并过滤 | 请求体略大，但路由逻辑零开销                  |
| Body 使用字符串而非 ArrayBuffer         | 简化序列化，JSON 友好            | 支持二进制流                  | 大文件场景受限                                |
| Headers 使用 Record<string, string>     | 类型简单                         | Headers 对象                  | 不支持多值 header                             |

---

## 10. 验收标准

### 10.1 功能验收

- [ ] `provideHTTPProxyService` 能够注册服务并处理请求
- [ ] `requestHTTPProxy` 能够通过 labels 自动路由
- [ ] 支持所有 HTTP 方法
- [ ] 支持完整的 fetch 参数
- [ ] Label 路由逻辑正确（精确匹配）

### 10.2 质量验收

- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试验证端到端流程
- [ ] API 文档生成（api-extractor）
- [ ] 错误处理完善（所有异常分支有对应的 error code）

---

## 11. 参考资料

- `@yuants/protocol` - Terminal 协议实现
- `@yuants/exchange` - provideQuoteService、provideExchangeServices 参考实现
- Fetch API Standard: https://fetch.spec.whatwg.org/
- JSON Schema: https://json-schema.org/

---

**状态更新**: 2026-01-26 - RFC 完成，采用 JSON Schema 路由机制
