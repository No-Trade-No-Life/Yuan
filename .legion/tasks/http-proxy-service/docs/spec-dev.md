# Dev Spec: HTTP Proxy Service Implementation

**基于**: RFC - HTTP Proxy Service for Yuan Terminal  
**目标读者**: 开发工程师  
**状态**: Ready for Implementation  
**更新**: 2026-01-26 - 采用 JSON Schema 路由机制

---

## 1. 包结构

```
libraries/http-services/
├── package.json
├── tsconfig.json
├── .heft/
│   └── ... (heft 配置)
├── config/
│   └── api-extractor.json
├── src/
│   ├── index.ts              # 主入口，导出所有公开 API
│   ├── types.ts              # 类型定义
│   ├── server.ts             # provideHTTPProxyService 实现
│   └── client.ts             # requestHTTPProxy 实现
└── lib/                      # 编译输出（CJS）
└── dist/                     # 编译输出（ESM）
```

**注意**：移除了 `utils.ts`（不再需要 label 匹配逻辑）

---

## 2. 依赖清单

### 2.1 Runtime Dependencies

```json
{
  "@yuants/protocol": "workspace:*",
  "@yuants/utils": "workspace:*"
}
```

### 2.2 DevDependencies

```json
{
  "@yuants/tool-kit": "workspace:*",
  "@microsoft/api-extractor": "~7.55.2",
  "@rushstack/heft": "~1.1.7",
  "@rushstack/heft-jest-plugin": "~1.1.7",
  "@rushstack/heft-node-rig": "~2.11.12",
  "@types/heft-jest": "1.0.6",
  "@types/node": "24",
  "typescript": "~5.9.3"
}
```

---

## 3. 文件实现细节

### 3.1 `src/types.ts`

````typescript
/**
 * HTTP Proxy Service Types
 * @packageDocumentation
 */

/**
 * HTTP 代理请求参数
 * @public
 */
export interface IHTTPProxyRequest {
  /** 请求 URL */
  url: string;

  /** HTTP 方法，默认 GET */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

  /** 请求头 */
  headers?: Record<string, string>;

  /** 请求体（字符串，JSON 序列化后） */
  body?: string;

  /** 凭证模式 */
  credentials?: 'omit' | 'same-origin' | 'include';

  /** 重定向模式 */
  redirect?: 'follow' | 'error' | 'manual';

  /** 引用策略 */
  referrerPolicy?: string;

  /** 超时时间（毫秒），默认 30000 */
  timeout?: number;

  /**
   * 标签选择器（用于路由到特定代理节点）
   *
   * @example
   * ```typescript
   * // 只路由到 us-west 区域的代理
   * { labels: { region: 'us-west' } }
   *
   * // 只路由到高带宽节点
   * { labels: { capability: 'high-bandwidth' } }
   *
   * // 同时满足多个条件
   * { labels: { region: 'us-west', tier: 'premium' } }
   * ```
   */
  labels?: Record<string, string>;
}

/**
 * HTTP 代理服务配置选项
 * @public
 */
export interface IHTTPProxyOptions {
  /**
   * 允许访问的主机列表（白名单）
   * - 如果未提供或为空，则允许访问所有主机（不安全，建议配置）
   * - 支持域名（如 "api.example.com"）
   * - 不支持通配符
   */
  allowedHosts?: string[];

  /**
   * 最大响应体大小（字节）
   * - 默认 10MB (10 * 1024 * 1024)
   * - 如果响应体超过此大小，将抛出错误
   */
  maxResponseBodySize?: number;
}

/**
 * HTTP 代理响应
 * @public
 */
export interface IHTTPProxyResponse {
  /** HTTP 状态码 */
  status: number;

  /** HTTP 状态文本 */
  statusText: string;

  /** 响应头（扁平化为 Record） */
  headers: Record<string, string>;

  /** 响应体（字符串） */
  body: string;

  /** 请求是否成功（status 2xx） */
  ok: boolean;

  /** 最终 URL（可能因重定向而改变） */
  url: string;
}
````

---

### 3.2 `src/server.ts`

````typescript
import { IServiceOptions, Terminal } from '@yuants/protocol';
import { newError } from '@yuants/utils';
import { IHTTPProxyRequest, IHTTPProxyResponse, IHTTPProxyOptions } from './types';

/**
 * 提供 HTTP 代理服务
 *
 * @param terminal - Terminal 实例
 * @param labels - 服务标签（用于客户端路由选择）
 * @param options - 服务选项（包含 allowedHosts, maxResponseBodySize 和 IServiceOptions）
 * @returns dispose 函数
 *
 * @example
 * ```typescript
 * const terminal = Terminal.fromNodeEnv();
 *
 * // 注册一个 us-west 区域的代理
 * provideHTTPProxyService(terminal, {
 *   region: 'us-west',
 *   tier: 'premium',
 *   ip: '192.168.1.100'
 * }, {
 *   concurrent: 10,
 *   max_pending_requests: 100,
 *   allowedHosts: ['api.example.com'],
 *   maxResponseBodySize: 1024 * 1024
 * });
 *
 * // 注册一个 eu-central 区域的代理
 * provideHTTPProxyService(terminal, {
 *   region: 'eu-central',
 *   tier: 'standard'
 * });
 * ```
 *
 * @public
 */
export const provideHTTPProxyService = (
  terminal: Terminal,
  labels: Record<string, string>,
  options?: IServiceOptions & IHTTPProxyOptions,
): { dispose: () => void } => {
  const { allowedHosts, maxResponseBodySize = 10 * 1024 * 1024, ...serviceOptions } = options || {};

  // 1. 构造包含 labels 约束的 JSON Schema（支持部分匹配）
  const labelProperties: Record<string, { const: string }> = {};
  for (const [key, value] of Object.entries(labels)) {
    labelProperties[key] = { const: value };
  }

  const schema = {
    type: 'object',
    required: ['url'],
    properties: {
      url: { type: 'string', format: 'uri' },
      method: {
        type: 'string',
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
      },
      headers: {
        type: 'object',
        additionalProperties: { type: 'string' },
      },
      body: { type: 'string' },
      credentials: {
        type: 'string',
        enum: ['omit', 'same-origin', 'include'],
      },
      redirect: {
        type: 'string',
        enum: ['follow', 'error', 'manual'],
      },
      referrerPolicy: { type: 'string' },
      timeout: { type: 'number', minimum: 0 },
      // labels 约束：只验证提供的 labels 值是否匹配（支持部分匹配）
      labels: {
        type: 'object',
        properties: labelProperties,
      },
    },
  };

  // 2. 注册服务处理器
  const { dispose } = terminal.server.provideService<IHTTPProxyRequest, IHTTPProxyResponse>(
    'HTTPProxy',
    schema,
    async (msg) => {
      const req = msg.req;

      try {
        // 3. 构造 fetch 参数
        const fetchOptions: RequestInit = {
          method: req.method || 'GET',
          headers: req.headers,
          body: req.body,
          credentials: req.credentials,
          redirect: req.redirect,
          // @ts-ignore - referrerPolicy 类型兼容性
          referrerPolicy: req.referrerPolicy,
        };

        // 4. 执行 fetch（带超时）
        const timeoutMs = req.timeout || 30000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetch(req.url, {
            ...fetchOptions,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          // 5. 提取响应信息
          let body = '';
          if (response.body) {
            const reader = response.body.getReader();
            let receivedLength = 0;
            const chunks: Uint8Array[] = [];

            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                if (value) {
                  receivedLength += value.length;
                  if (receivedLength > maxResponseBodySize) {
                    await reader.cancel();
                    throw new Error(`Response size exceeds limit (${maxResponseBodySize} bytes)`);
                  }
                  chunks.push(value);
                }
              }
            } finally {
              reader.releaseLock();
            }

            const result = new Uint8Array(receivedLength);
            let offset = 0;
            for (const chunk of chunks) {
              result.set(chunk, offset);
              offset += chunk.length;
            }
            body = new TextDecoder().decode(result);
          } else {
            const buffer = await response.arrayBuffer();
            if (buffer.byteLength > maxResponseBodySize) {
              throw new Error(`Response size exceeds limit`);
            }
            body = new TextDecoder().decode(buffer);
          }

          const headers: Record<string, string> = {};
          response.headers.forEach((value, key) => {
            headers[key] = value;
          });

          const proxyResponse: IHTTPProxyResponse = {
            status: response.status,
            statusText: response.statusText,
            headers,
            body,
            ok: response.ok,
            url: response.url,
          };

          return {
            res: {
              code: 0,
              message: 'OK',
              data: proxyResponse,
            },
          };
        } catch (err: any) {
          clearTimeout(timeoutId);

          // 超时错误
          if (err.name === 'AbortError') {
            return {
              res: {
                code: 'TIMEOUT',
                message: `Request timeout after ${timeoutMs}ms`,
              },
            };
          }

          // 网络错误
          throw err;
        }
      } catch (err: any) {
        // 捕获所有错误
        return {
          res: {
            code: 'FETCH_FAILED',
            message: err.message || 'Unknown fetch error',
          },
        };
      }
    },
    serviceOptions,
  );

  return { dispose };
};
````

---

### 3.3 `src/client.ts`

````typescript
import { IResponse, Terminal } from '@yuants/protocol';
import { IHTTPProxyRequest, IHTTPProxyResponse } from './types';

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
 *   labels: { region: 'us-west' }  // 自动路由到匹配的代理
 * });
 *
 * // 不指定 labels，使用任意可用代理
 * const response2 = await requestHTTPProxy(terminal, {
 *   url: 'https://api.example.com/public'
 * });
 *
 * if (response.data?.ok) {
 *   const data = JSON.parse(response.data.body);
 *   console.log(data);
 * }
 * ```
 *
 * @public
 */
export const requestHTTPProxy = async (
  terminal: Terminal,
  request: IHTTPProxyRequest,
): Promise<IResponse<IHTTPProxyResponse>> => {
  // 利用 Terminal 现有的 JSON Schema 路由机制
  // 如果 request.labels 匹配某个服务的 schema，会自动路由过去
  return terminal.client.requestForResponse<IHTTPProxyRequest, IHTTPProxyResponse>('HTTPProxy', request);
};
````

---

### 3.4 `src/index.ts`

```typescript
/**
 * HTTP Proxy Services for Yuan Terminal
 *
 * @packageDocumentation
 */

export * from './types';
export * from './server';
export * from './client';
```

---

## 4. 配置文件

### 4.1 `package.json`

```json
{
  "name": "@yuants/http-services",
  "version": "0.1.0",
  "description": "HTTP proxy service for Yuan Terminal",
  "main": "lib/index.js",
  "module": "dist/index.js",
  "types": "lib/index.d.ts",
  "files": ["dist", "lib", "temp"],
  "scripts": {
    "build": "heft test --clean && api-extractor run --local --config ./config/api-extractor.json && yuan-toolkit post-build"
  },
  "publishConfig": {
    "registry": "https://registry.npmjs.org",
    "access": "public"
  },
  "devDependencies": {
    "@yuants/tool-kit": "workspace:*",
    "@microsoft/api-extractor": "~7.55.2",
    "@rushstack/heft": "~1.1.7",
    "@rushstack/heft-jest-plugin": "~1.1.7",
    "@rushstack/heft-node-rig": "~2.11.12",
    "@types/heft-jest": "1.0.6",
    "@types/node": "24",
    "typescript": "~5.9.3"
  },
  "dependencies": {
    "@yuants/protocol": "workspace:*",
    "@yuants/utils": "workspace:*"
  }
}
```

### 4.2 `tsconfig.json`

```json
{
  "extends": "../../common/config/rush/tsconfig-base.json",
  "compilerOptions": {
    "outDir": "lib",
    "rootDir": "src",
    "types": ["heft-jest", "node"]
  }
}
```

### 4.3 `config/api-extractor.json`

```json
{
  "extends": "../../common/config/rush/api-extractor-base.json",
  "mainEntryPointFilePath": "<projectFolder>/lib/index.d.ts",
  "apiReport": {
    "enabled": true,
    "reportFolder": "<projectFolder>/etc/"
  },
  "docModel": {
    "enabled": false
  },
  "dtsRollup": {
    "enabled": false
  }
}
```

---

## 5. 路由机制说明

### 5.1 工作原理

**利用 Terminal 现有的 JSON Schema 路由**：

1. **Server 端注册**：

   ```typescript
   provideHTTPProxyService(terminal, { region: 'us-west', tier: 'premium' });
   ```

   生成 Schema：

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
3. **自动路由**：Terminal 的 `resolveTargetServices` 会用 JSON Schema 验证所有 `HTTPProxy` 服务，只有 labels 完全匹配的服务才会被选中。

### 5.2 匹配规则

| Client labels                            | Server labels                            | 匹配结果                           |
| ---------------------------------------- | ---------------------------------------- | ---------------------------------- |
| `{ region: 'us-west' }`                  | `{ region: 'us-west' }`                  | ✅ 匹配                            |
| `{ region: 'us-west', tier: 'premium' }` | `{ region: 'us-west' }`                  | ✅ 匹配（客户端可以有额外 labels） |
| `{ region: 'us-west' }`                  | `{ region: 'us-west', tier: 'premium' }` | ❌ 不匹配（缺少 tier）             |
| `{ region: 'us-east' }`                  | `{ region: 'us-west' }`                  | ❌ 不匹配（值不同）                |
| `{}`                                     | `{ region: 'us-west' }`                  | ❌ 不匹配（缺少 region）           |
| `{}`                                     | `{}`                                     | ✅ 匹配（无约束）                  |

### 5.3 负载均衡

如果多个代理节点都匹配，Terminal 会自动随机选择一个（现有的负载均衡逻辑）。

---

## 6. 实现注意事项

### 6.1 错误处理

错误通过抛出 `newError` / `scopeError` 交由 Terminal Server 捕获并转换为 `IResponse`。

常见错误类型：

- `TIMEOUT` - 请求超时
- `INVALID_URL` - URL 非法
- `FORBIDDEN` - Host 不在 allowedHosts 列表
- `FETCH_FAILED` - Fetch 失败
- `RESPONSE_TOO_LARGE` - 响应体超过限制
- `READ_BODY_FAILED` - 响应体读取失败（fallback 路径）

### 6.2 Schema 约束

- Server 端 labels 使用 `const` 精确匹配
- 不设置 `required`，支持部分匹配
- Client 可以提供额外的 labels（不影响路由）

### 6.3 性能优化

- Schema validator 会被 Terminal 缓存（无需重复编译）
- Headers 遍历使用 `forEach` 而非 `entries()`（兼容性）
- 使用 AbortController 实现超时控制

---

## 7. 测试覆盖

### 7.1 单元测试（`src/__tests__/`）

- `server.test.ts` - provideHTTPProxyService 基本功能
- `client.test.ts` - requestHTTPProxy 路由逻辑
- `integration.test.ts` - 端到端测试

### 7.2 路由测试重点

- 精确匹配：labels 完全相同
- 部分匹配：客户端 labels 超集
- 不匹配：labels 值不同、缺少必需字段
- 无 labels：任意代理都可接受

---

## 8. 文件变更清单

| 文件路径                                            | 操作 | 说明               |
| --------------------------------------------------- | ---- | ------------------ |
| `libraries/http-services/`                          | 新建 | 包根目录           |
| `libraries/http-services/package.json`              | 新建 | 包配置             |
| `libraries/http-services/tsconfig.json`             | 新建 | TS 配置            |
| `libraries/http-services/config/api-extractor.json` | 新建 | API Extractor 配置 |
| `libraries/http-services/src/index.ts`              | 新建 | 主入口             |
| `libraries/http-services/src/types.ts`              | 新建 | 类型定义           |
| `libraries/http-services/src/server.ts`             | 新建 | Server 端实现      |
| `libraries/http-services/src/client.ts`             | 新建 | Client 端实现      |

**移除文件**：`src/utils.ts`（不再需要）

---

**验收标准**：

- [ ] 所有文件按照上述结构创建
- [ ] `npm run build` 成功执行
- [ ] 生成 `etc/http-services.api.md`
- [ ] 路由测试通过（labels 匹配逻辑）
- [ ] 代码风格符合 Yuan 仓库规范（prettier）
