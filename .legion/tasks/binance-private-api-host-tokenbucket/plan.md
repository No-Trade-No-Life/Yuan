# Binance private-api 按 host 选择 tokenBucket 并按权重限流

## 目标

在 apps/vendor-binance 的 private-api 与 public-api 发起请求前，根据 URL host 选择对应的 tokenBucket，并按接口权重调用 acquireSync 做限流。

## 要点

- 复用 apps/vendor-binance/src/api/client.ts 中已定义的 3 个 tokenBucket（首次 create，后续仅用 bucketId 获取，不再传 options）
- 在 private-api / public-api 里对每次请求解析 URL host，使用 `tokenBucket(url.host)` 获取对应 bucket
- 请求前 `bucket.acquireSync(weight)`；weight 来自方法文档注释中的“权重”
- 用 `scopeError` 包装 acquireSync 并记录 metadata（host、path、method、weight、bucketId），token 不够时自动 throw，不捕获
- public-api 同样落地相同的限流逻辑；修改尽量局部并保持可读性
- 补一个最小单测：给不同 host 的 URL 断言选择不同 bucketId + weight 被传入（可用 spy/mock）

## 范围

- apps/vendor-binance/src/api/private-api.ts
- apps/vendor-binance/src/api/public-api.ts
- apps/vendor-binance/src/api/client.ts
- apps/vendor-binance/src/api/private-api.rateLimit.test.ts
- apps/vendor-binance/src/api/public-api.rateLimit.test.ts

## 阶段概览

1. **调研** - 1 个任务
2. **设计（先让你 review）** - 1 个任务
3. **实现** - 1 个任务
4. **验证** - 1 个任务

---

## 设计细节（已确认）

### 0) 前置条件（不动代码的前提）

- `apps/vendor-binance/src/api/client.ts` 已在模块初始化阶段创建以下 3 个 bucket（即你说的“第一次调用是 create”）：
  - `tokenBucket('api.binance.com', ...)`
  - `tokenBucket('fapi.binance.com', ...)`
  - `tokenBucket('papi.binance.com', ...)`
- private-api 侧仅会再次调用 `tokenBucket(url.host)` 获取既有 bucket（不再传 options）。

> 注：如果你当前工作区里 `client.ts` 还没落地这 3 个 bucket，后续实现阶段第一步需要先补上（这会改代码，必须等你允许再做）。

### 1) host -> bucket 映射规则

- `api.binance.com`：使用 bucketId=`api.binance.com`（spotAPIBucket）
- `fapi.binance.com`：使用 bucketId=`fapi.binance.com`（futureAPIBucket）
- `papi.binance.com`：使用 bucketId=`papi.binance.com`（unifiedAPIBucket）

说明：

- 选择规则只看 `new URL(endpoint).host`，不看 path（例如 `https://api.binance.com/papi/*` 仍然归到 `api.binance.com`）。
- private-api 内不会重复初始化桶：只会 `tokenBucket(bucketId)` 获取已存在的 bucket 实例（create 已在 `apps/vendor-binance/src/api/client.ts` 发生）。
- 不需要补充 host guard：你已确认 endpoint host 已穷举覆盖，不会遗漏。

### 2) 权重来源与落地方式

- 每个导出的 API 方法在调用 `requestPrivate` 前，显式传入该方法注释中的“权重”数值（如权重包含条件分支，则在方法内判定）。
- 按你的 review：不抽 `requestPrivateWithRateLimit` 这类 wrapper；所有 `tokenBucket + acquireSync + scopeError` 都直接写在每个具体的 API 方法里。
  - `acquireSync(weight)` 的 `weight` 必须由具体方法在调用点传入/计算（因为只有方法自己知道这次调用对应的权重）。

### 3) 示例（你可以直接照抄的调用方式）

```ts
import { requestPrivate, type ICredential } from './client';
import { scopeError, tokenBucket } from '@yuants/utils';

// 例：Spot openOrders，权重: 带 symbol 6 / 不带 80
export const getSpotOpenOrders = (credential: ICredential, params?: { symbol?: string }) => {
  const endpoint = 'https://api.binance.com/api/v3/openOrders';
  const url = new URL(endpoint);
  const weight = params?.symbol ? 6 : 80;
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    {
      method: 'GET',
      host: url.host,
      path: url.pathname,
      bucketId: url.host,
      weight,
      hasSymbol: !!params?.symbol,
    },
    () => tokenBucket(url.host).acquireSync(weight),
  );
  return requestPrivate<unknown>(credential, 'GET', endpoint, params);
};
```

> [REVIEW] 请你确认上述 host->bucket 映射是否符合你的预期：尤其是 `https://api.binance.com/papi/*` 这类 endpoint 是否也应该按 host=`api.binance.com` 归到 spot bucket？还是你希望 path 里含 `/papi/` 也强制走 unified bucket？
>
> 目前按你的 review 结论：严格按 URL host 路由（`new URL(endpoint).host`），不看 path；并且不做未知 host 兜底。
>
> [STATUS:resolved]

> [REVIEW:blocking] 若以上设计无误，请回复“OK，可以开始实现”；如还要补充 host 列表或权重规则，也请直接写在这里。
>
> [RESPONSE] 已收到你在本轮对话中的确认：“你解决完之后可以自行工作了”。我将其视为允许开始实现；接下来会进入阶段 3 改代码，并在完成后补最小校验与更新交接。
> [STATUS:resolved]

> [REVIEW] 不需要补充这个 guard 了，因为我看了一下代码，所有的调用的 host 都是我穷举过的，所以不会有遗漏的情况。
>
> [RESPONSE] 接受：已按你的补充 review 移除 host guard（不再对 url.host 做显式校验/throw）；文档与示例改为直接使用 `tokenBucket(url.host)`，依赖你已穷举的 host 列表保证不会遗漏。
> [STATUS:resolved]

> [REVIEW] 所有的 callApi 都要走限流，因为限流是按照 IP 限流的，然后我看了一下，我应该穷举了所有的调用的 api host 了，所以不会有遗漏的情况，你不需要弄一个 pickBucketIdByHost 去兜底未知 host 的情况。直接用 host 去 pick 就行了，然后你要在每个 request 里进行请求 bucket 然后限流 cal，比如 getUnifiedAccountInfo 请求 20 个 weight，因为在每个 request 里你才知道要 acquire 多大的 weight。
>
> [RESPONSE] 接受：所有 private-api 请求在调用 requestPrivate 前都 `tokenBucket(url.host).acquireSync(weight)`；weight 由每个具体 API 方法在调用点传入/计算；不做 wrapper/兜底（host 按你已穷举的列表覆盖）。实现会等你在 R2（blocking）确认后再开始。
> [STATUS:resolved]

> [REVIEW] 你不要抽这个 requestPrivateWithRateLimit 了，所有 tokenBucket 相关的工作都直接在具体的 api 完成。
>
> [RESPONSE] 接受：已移除“抽 wrapper”方案；plan.md 示例改为在具体 API 方法中直接执行 `tokenBucket(url.host).acquireSync(weight)` 并用 `scopeError` 注入 metadata。后续实现会按此方式逐个方法落地。
> [STATUS:resolved]

> [REVIEW] public-api 也需要限流，按照一样的方式继续实现。
>
> [RESPONSE] 接受：将 public-api 也按同样方式做主动限流（在每个具体 public API 方法里：解析 endpoint 的 url.host，`tokenBucket(url.host).acquireSync(weight)`，再调用 requestPublic；不抽 wrapper）。我会先把这一点补进 plan.md 的范围/要点与实现清单，然后开始改 `apps/vendor-binance/src/api/public-api.ts` 并补最小测试/校验。
> [STATUS:resolved]

_创建于: 2025-12-24 | 最后更新: 2025-12-24_
