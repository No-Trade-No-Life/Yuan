# Git 变更报告（e44fdfa6c..4d9c58da8）

> **时间范围**：2025-12-07 至 2025-12-08
> **分析深度**：Level 2

## 1. 概览

- **提交数量**：13
- **主要贡献者**：humblelittlec1[bot] (6 commits), CZ (5 commits), Siyuan Wang (1 commit), Ryan (1 commit)
- **热点项目**：`common` (25 文件), `apps/vendor-gate` (8 文件), `apps/vendor-aster` (6 文件)
- **风险指标**：⚠️ 2 个风险项（1 个高风险，1 个中风险）

## 2. 核心变更

### 2.1 Aster 交易所现货产品支持

**相关提交**：`540b69760`
**作者**：Siyuan Wang

**设计意图**：
为 Aster 交易所添加现货交易对支持，扩展 API 接口以同时处理期货和现货产品。此前仅支持期货交易对，现在通过分离期货和现货的 base URL，使系统能够获取现货交易对信息，包括价格/数量步长等过滤器配置，为现货交易功能提供基础支持。

**核心代码**：
[public-api.ts:L8-L38](apps/vendor-aster/src/api/public-api.ts#L8-L38)

```typescript
const request = async <T>(
  method: string,
  baseUrl: string,
  endpoint: string,
  params: any = {},
): Promise<T> => {
  const url = new URL(baseUrl);

const createApi =
  (baseUrl: string) =>
  (method: string, endpoint: string) =>
    request<TRes>(method, baseUrl, endpoint, params);

const createFutureApi = createApi('https://fapi.asterdex.com');
const createSpotApi = createApi('https://sapi.asterdex.com');
```

**影响范围**：
- 影响模块：`vendor-aster` 的公共 API 接口
- 需要关注：现货交易对信息的获取逻辑与期货保持一致，确保过滤器配置正确

### 2.2 Binance API 使用量指标跟踪

**相关提交**：`a083a19a3`
**作者**：CZ

**设计意图**：
为 Binance 客户端添加 API 使用量指标跟踪功能，通过记录请求次数、响应时间等关键指标，帮助监控 API 调用频率和性能。这有助于识别潜在的限速问题，优化请求策略，并为系统性能监控提供数据支持。

**核心代码**：
[binance.ts:L1-L15](apps/vendor-binance/src/public-data/binance.ts#L1-L15)

```typescript
export const getBinanceMetrics = () => {
  const metrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    lastRequestTime: null as Date | null,
  };
  return metrics;
};
```

**影响范围**：
- 影响模块：`vendor-binance` 的所有 API 调用
- 需要关注：指标收集可能增加少量性能开销，需监控内存使用情况

### 2.3 Gate 和 Huobi API 端点更新与错误处理优化

**相关提交**：`1b048f71f`
**作者**：CZ

**设计意图**：
统一更新 Gate 和 Huobi 交易所的 API 端点，并改进错误处理机制。通过标准化错误响应格式和增加重试逻辑，提高系统在面对网络波动或交易所限速时的稳定性。同时更新过时的 API 端点，确保与交易所最新接口兼容。

**核心代码**：
[gate.ts:L42-L58](apps/vendor-gate/src/trade/gate.ts#L42-L58)

```typescript
const handleApiError = (error: any, endpoint: string) => {
  if (error.response?.status === 429) {
    logger.warn(`Rate limit exceeded for ${endpoint}, retrying...`);
    return { shouldRetry: true, delay: 1000 };
  }
  if (error.response?.status >= 500) {
    logger.error(`Server error for ${endpoint}: ${error.message}`);
    return { shouldRetry: true, delay: 2000 };
  }
  return { shouldRetry: false };
};
```

**影响范围**：
- 影响模块：`vendor-gate`, `vendor-huobi` 的交易和公共数据接口
- 需要关注：重试逻辑可能增加请求延迟，需合理配置重试次数和间隔

### 2.4 虚拟交易所凭证 ID 缓存优化

**相关提交**：`790b62bff`
**作者**：CZ

**设计意图**：
通过实现凭证 ID 缓存机制，减少重复的凭证验证请求，提高虚拟交易所的性能。使用 `createCache` 函数缓存已解析的凭证 ID，避免每次请求都进行 JSON 解析和远程调用，特别在高频访问场景下能显著降低延迟。

**核心代码**：
[credential.ts:L25-L52](apps/virtual-exchange/src/credential.ts#L25-L52)

```typescript
const credentialIdCache = createCache(async (credentialKey: string) => {
  const credential = JSON.parse(credentialKey) as IExchangeCredential;
  const res = await getCredentialId(terminal, credential);
  return res.data;
});

const res = await credentialIdCache.query(JSON.stringify(credential));
if (res) {
  result.credentialId = res;
}
```

**影响范围**：
- 影响模块：`app-virtual-exchange` 的凭证管理
- 需要关注：缓存失效策略和内存管理，确保凭证更新时缓存能及时刷新

## 3. 贡献者

| 作者 | 提交数 | 主要工作 | 关键提交 |
| ---- | ------ | -------- | -------- |
| humblelittlec1[bot] | 6 | 版本更新和变更日志维护 | `39712dbdd`, `88632ee3c`, `4d9c58da8` |
| CZ | 5 | API 优化、错误处理、指标跟踪 | `790b62bff`, `a083a19a3`, `1b048f71f` |
| Siyuan Wang | 1 | Aster 现货产品支持 | `540b69760` |
| Ryan | 1 | OKX 交易修复 | `1c8dab325` |

## 4. 风险评估

### 兼容性影响

**高风险**：3 个提交涉及 API 或接口定义变更
- `540b69760`: Aster API 接口重构，分离期货和现货 base URL
- `a083a19a3`: Binance 客户端添加指标接口
- `1b048f71f`: Gate 和 Huobi API 端点更新

这些变更可能影响依赖这些接口的客户端代码，需要更新相应的调用方式。

### 配置变更

无重大配置变更。主要变更集中在代码逻辑优化和功能扩展。

### 性能影响

- **正面影响**：凭证 ID 缓存机制 (`790b62bff`) 将减少重复的远程调用
- **潜在影响**：API 指标跟踪 (`a083a19a3`) 可能增加少量内存和 CPU 开销
- **优化**：错误处理重试逻辑 (`1b048f71f`) 提高系统稳定性但可能增加延迟

### 测试覆盖

**中风险**：包含功能或修复提交但未见测试文件更新

建议为以下新增功能添加测试：
1. Aster 现货产品支持的 API 接口
2. Binance 指标跟踪功能
3. Gate/Huobi 错误处理重试逻辑
4. 虚拟交易所凭证缓存机制