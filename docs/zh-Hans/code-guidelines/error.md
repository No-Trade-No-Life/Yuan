# 错误处理代码规范

核心原则: 错误处理哲学

1. 让错误显而易见：不要隐藏错误，让失败快速暴露

2. 职责边界清晰：每个函数/组件应明确自己的错误处理责任

3. 信息完整性：错误应包含足够信息用于调试和用户反馈

4. 一致性：错误处理方式应在整个代码库中保持一致

5. 简洁性：避免过度复杂的错误处理逻辑，避免华而不实的错误处理方案。

## 抛出异常的具体风格

1. 使用异常而非错误码：优先使用异常机制 (throw-catch) 处理错误，避免使用错误码 (如返回 -1 或 null, undefined 表示错误)
2. 不使用自定义错误类：除非有特殊需求，否则避免创建自定义错误类，使用内置的 Error 类。

   因为这会极大增加协议复杂度，且所有情况下都无必要。但是 Error Helper 函数是允许的。

3. 错误信息应当包含 **错误分类** 和 **上下文参数信息**：错误信息应包含错误的类型（如网络错误、验证错误等）和相关上下文信息（如函数参数、状态等），以便于调试和用户反馈。所有的信息都应当以字符串形式包含在错误消息中。

4. 避免构造复杂错误对象: **抛出异常仅仅是为了打断控制流，并传递错误信息**

   不应当在抛出异常时构造复杂错误对象 (如 error.code, error.type 等)，添加 meta 信息会导致后续很难正确处理错误，且没有任何价值。

   如果需要携带 extra meta，可以通过 error helper 函数将 extra meta 通过别的途径上报 (如日志系统、遥测系统等)，而不是通过异常对象传递。

   无法假设所有被调用的函数都遵循同一套 extra meta 规范，因此不应当依赖异常对象携带 extra meta 信息。永远假设 Error 是 any / unknown 类型。

```ts
// 推荐做法
throw new Error(`NetworkError: Failed to fetch data for userId=${userId}`);
// 推荐做法, 使用辅助函数构建错误信息
import { newError } from '@yuants/utils';
throw newError('NetworkError', { userId, retryCount });

// 错误做法，会输出 [object Object]
throw new Error(`Error: Failed to fetch data for context=${someComplexObject}`);
// 不推荐做法，未使用 Error 类 (不会包含堆栈信息)
throw `NetworkError: Failed to fetch data for userId=${userId}`;
// 错误做法，不包含上下文，使得定位问题困难
throw new Error('NetworkError');
// 不推荐做法，不包含错误分类，使得定位问题困难
throw new Error(`Failed to fetch data for userId=${userId}`);
// 不推荐做法，使用自定义错误类
class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}
throw new NetworkError(`Failed to fetch data for userId=${userId}`);
```

## 捕获异常的具体风格

错误处理永远只有 4 种选择:

1. 知道如何应对 -> 使用备选方案；
2. 认为是偶然性因素导致的 -> 重试；
3. 需要补充上下文信息 -> 捕获并包装异常 (必须保留原始错误堆栈)。
4. 认为是当前无法处理的 -> 汇报展示、控制影响面，通知外部介入处理错误；

除此之外，永远不应当捕获异常。

**因此，仅在如下情形捕获异常**:

1.  提供备用方案：如果有备用方案可以使用（如使用缓存数据），可以捕获异常并执行备用方案。
2.  重试：如果操作可能会暂时失败（如网络请求），可以捕获异常并重试操作。
3.  补充上下文：如果当前层级有关键信息（如 Loop 变量、配置 ID）有助于定位问题，可以捕获异常，使用 `newError` 包装并重新抛出，或者使用 `scopeError` 自动处理。
4.  展示：在接口层 (API, GUI, CLI, 以及 **Delegate 逻辑**) 捕获异常并展示给用户友好的错误信息，并防止错误扩散。

为了澄清概念，特别说明不应当捕获异常的情形:

1.  记录日志：记录日志应当在展示错误的地方进行。
2.  **丢失原始信息的**转换异常类型：禁止直接 `throw new Error(msg)` 而丢弃原始 `error`。如果需要转换，必须使用 `cause` 属性保留原始堆栈。
3.  忽略异常：不应当捕获异常后忽略它，这会导致错误被隐藏，难以调试。

### 提供备用方案

```ts
// 推荐做法：提供备用方案
try {
  const data = JSON.parse(input);
  return data;
} catch (error) {
  return JSONC.parse(input); // 备用方案 (宽松解析)
  // 再不然就抛出异常
}
```

### 重试

```ts
// 推荐做法：重试
async function withRetry(staff, retryCount = 3) {
  try {
    return await staff();
  } catch (error) {
    if (retryCount <= 0) throw error;
    return withRetry(staff, retryCount - 1);
  }
}
// 推荐做法: rxjs 重试 (支持丰富的重试策略)
import { defer, retry } from 'rxjs/operators';

defer(() => staff()).pipe(
  retry({ count: 3, delay: 1000 }), // 重试 3 次, 每次间隔 1 秒
);
```

### 补充上下文信息

**丢失原始信息的**转换异常类型只会增加调试难度，隐藏一部分调用堆栈，并且没有任何价值，必须使用 `cause` 参数保留原始堆栈信息。

```ts
// 推荐做法: 补充上下文信息 (使用 newError, withErrorContext 辅助函数)
import { newError, withErrorContext } from '@yuants/utils';

await withErrorContext('FetchDataError', { url, retryCount }, async () => {
  const response = await fetch(url);
  if (!response.ok) {
    throw newError('HTTPError', { status: response.status, statusText: response.statusText });
  }
  return await response.json();
});

// 错误做法: 转换异常类型，丢失原始堆栈信息
try {
  const data = await fetchData();
  return data;
} catch (error) {
  throw new Error(`DataFetchError: ${error.message}`);
}

// 不推荐做法: 模版代码多 (try-catch)
try {
  const data = await fetchData(userId);
  return data;
} catch (error) {
  throw new Error(
    `DataFetchError: Failed to fetch data for userId=${userId}, original error: ${error.message}`,
    { cause: error },
  );
}
```

### 展示错误信息

不推荐做法: 捕获异常仅用于记录日志，或进行丢失信息的异常转换。

你永远只需要在展示错误信息的地方记录日志，其他情形下的日志都没有价值。

```ts
// 推荐做法: Service API 展示错误信息
// 在 Yuan Server 中已经内置支持，不需要额外代码
terminal.server.provideService('<METHOD>', '<JSON-SCHEMA', async (msg) => {
  // 业务逻辑，如果抛出异常，Yuan Server 会捕获并展示错误信息，无需额外处理
});

// 推荐做法: GUI 展示错误信息 (React 组件，由用户操作触发，经过异步调用并失败)
function MyComponent() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const handleClick = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await api.callSomeService();
    } catch (error) {
      setError(error); // 展示错误信息
      console.error(error); // 记录日志
      reportError(error); // 可选: 上报错误
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleClick} disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Click Me'}
      </button>
      {error && <div className="error">Error: {error.message}</div>}
    </div>
  );
}

// 推荐做法: GUI 展示错误信息 (@tanstack/react-query)
// 使用已经封装好的异步数据获取库，会自动处理加载状态和错误状态，简化代码
// 还会有 caching, 重试等功能
import { useQuery } from '@tanstack/react-query';

function MyComponent() {
  const { data, error, isLoading } = useQuery(['someData'], () => api.callSomeService(), {
    onError: (error) => {
      console.error(error); // 记录日志
      reportError(error); // 可选: 上报错误
    },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div className="error">Error: {(error as Error).message}</div>;

  return <div>Data: {JSON.stringify(data)}</div>;
}

// 推荐做法: GUI 使用 ErrorBoundary 捕获渲染错误 (react-error-boundary)
// 在页面级别捕获渲染错误，防止整个应用崩溃
// 通常，会对 Layout 组件使用 ErrorBoundary，这样可以将错误限制在某个视觉区域内
// 并允许用户重新尝试加载该区域
// 提示: 根据视觉区域的设计大小，灵活使用不同的 Fallback 组件
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  useEffect(() => {
    console.error(error); // 记录日志
    reportError(error); // 可选: 上报错误
  }, []);

  return (
    <div role="alert">
      <p>Something went wrong:</p>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );
}

function Layout() {
  return (
    <div>
      <div>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          {/** 可能的崩溃点 */}
          <MyHeader />
        </ErrorBoundary>
      </div>
      <div>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          {/** 可能的崩溃点 */}
          <MySidebar />
        </ErrorBoundary>
      </div>
      <div>
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          {/** 可能的崩溃点 */}
          <MyMainContent />
        </ErrorBoundary>
      </div>
    </div>
  );
}

// 不推荐做法: 仅记录日志
try {
  const data = await fetchData();
  return data;
} catch (error) {
  console.error('Failed to fetch data', error);
  throw error; // 重新抛出异常，未提供任何处理
}
```

## Proposal: 使用 Error Helper 函数构建错误信息

为了简化错误信息的构建，并确保错误信息的一致性，可以使用辅助函数 `newError` 和 `scopeError`。

1. **`newError`**: 用于手动构建错误对象，支持 `cause` 参数保留原始堆栈。
2. **`scopeError`**: 高阶函数，用于创建一个错误作用域。自动捕获作用域内的异常，附加 Context 后重新抛出。

### 优势

1. **减少样板代码**: 避免了显式的 `try-catch` 块，代码更线性。
2. **强制 Context**: 开发者被迫思考 `type` 和 `context`。
3. **统一处理**: 同时支持同步和异步函数。

```ts
import { createRegistry } from '@yuants/prometheus';

export const errorRegistry = createRegistry();
const errorCounter = errorRegistry.counter('new_errors_total', 'Total number of errors');

export function newError(type: string, context: Record<string, any>, originalError?: unknown) {
  const contextStr = Object.entries(context)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(', ');
  errorCounter.labels({ type }).inc();
  return new Error(`${type}: ${contextStr}`, { cause: originalError });
}

export function scopeError<T>(
  type: string,
  context: Record<string, any> | (() => Record<string, any>),
  staff: () => T,
): T {
  try {
    const result = staff();
    if (result instanceof Promise) {
      return result.catch((e) => {
        throw newError(type, context, e);
      }) as any;
    }
    return result;
  } catch (e) {
    throw newError(type, context, e);
  }
}

// 使用示例
import { newError, scopeError } from '@yuants/utils';

// 场景 1: 业务逻辑主动抛错
throw newError('TimeoutError', { url: '...', timeout: 5000 });

// 场景 2: 使用 scopeError 自动捕获并补充上下文 (推荐)
// 读作: "Scope this error as 'NetworkError' with context { url }, then do fetch"
await scopeError('NetworkError', { url }, async () => {
  await fetch(url);
  // ... 其他逻辑
});

// 场景 3: Lazy Context (高性能场景)
// 只有在报错时才会计算 Context，避免无谓的序列化开销
await scopeError(
  'HeavyComputationError',
  () => ({ result: heavySerialize(data) }),
  async () => {
    // ...
  },
);
```
