# Aster public/private API 按 host 选择 tokenBucket 并主动限流

## 目标

在 apps/vendor-aster 的 public-api/private-api 发起请求前，根据 URL host 选择对应的 tokenBucket，并在请求前按权重调用 acquireSync 做限流。

## 要点

- 在模块初始化阶段创建按 host 区分的 tokenBucket：`fapi.asterdex.com` / `sapi.asterdex.com`（首次 create，后续仅用 bucketId 获取，不再传 options）
- 在 public-api/private-api 的每个具体 API 方法里，在发起 fetch 前执行：`tokenBucket(url.host).acquireSync(weight)`
- weight 优先来自 Aster 官方文档的“权重”；未明确的接口先暂定 `weight=1` 并记录待补齐点
- `scopeError` 仅包裹 `acquireSync` 并注入 metadata（method/endpoint/host/path/bucketId/weight/关键条件参数），token 不足直接 throw，不捕获
- 最小单测覆盖：不同 host 选择不同 bucket；条件 weight 正确透传到 `acquireSync`
- 更新 `apps/vendor-aster/SESSION_NOTES.md`：记录改动摘要与本地验证命令/结果

## 范围

- apps/vendor-aster/src/api/private-api.ts
- apps/vendor-aster/src/api/public-api.ts
- apps/vendor-aster/src/api/client.ts
- apps/vendor-aster/src/api/private-api.rateLimit.test.ts
- apps/vendor-aster/src/api/public-api.rateLimit.test.ts
- apps/vendor-aster/SESSION_NOTES.md
- .legion/tasks/aster-publicprivate-api-host-tokenbucket/plan.md
- .legion/tasks/aster-publicprivate-api-host-tokenbucket/context.md
- .legion/tasks/aster-publicprivate-api-host-tokenbucket/tasks.md

## 阶段概览

1. **调研** - 1 个任务
2. **设计（先 review）** - 1 个任务
3. **实现** - 1 个任务
4. **验证与交接** - 1 个任务

---

## 设计细节

### 1) host -> bucket 规则

- `fapi.asterdex.com`：bucketId=`fapi.asterdex.com`（Futures）
- `sapi.asterdex.com`：bucketId=`sapi.asterdex.com`（Spot）

说明：

- 严格按 `new URL(baseURL).host` / `new URL(endpoint).host` 取 host；不做未知 host 兜底（依赖调用点穷举的 baseURL 列表）。
- tokenBucket 的首次 create 只在 `apps/vendor-aster/src/api/client.ts` 做；private/public API 调用点只用 `tokenBucket(url.host)` 获取既有桶。

### 2) bucket 参数（来源：exchangeInfo.rateLimits）

- Futures (`fapi.asterdex.com`)：`REQUEST_WEIGHT` 上限 `2400/min`
  - `capacity=2400, refillInterval=60_000, refillAmount=2400`
- Spot (`sapi.asterdex.com`)：`REQUEST_WEIGHT` 上限 `6000/min`
  - `capacity=6000, refillInterval=60_000, refillAmount=6000`

> 注：文档中还定义了 `ORDERS` 类限频（尤其 futures `1200/min`、spot `6000/min` + `300/10s`）。本任务仅对齐 “请求权重（REQUEST_WEIGHT）” 的主动限流；订单类限频是否需要单独 bucket，后续再单独开任务评估。

### 3) weight 规则（按当前 vendor-aster 代码使用到的 endpoints）

Futures（来自 `aster-finance-futures-api_CN.md`）：

- `GET /fapi/v1/exchangeInfo`：weight=1
- `GET /fapi/v1/fundingRate`：weight=1
- `GET /fapi/v1/premiumIndex`：weight=1
- `GET /fapi/v1/ticker/price`：带 symbol=1；不带=2（当前实现固定不带 symbol，使用 2）
- `GET /fapi/v1/klines`：weight 取决于 `limit`（默认 500）
  - `[1,100)` -> 1
  - `[100,500)` -> 2
  - `[500,1000]` -> 5
  - `>1000` -> 10
- `GET /fapi/v1/openOrders`：带 symbol=1；不带=40
- `POST /fapi/v1/order`：weight=1
- `DELETE /fapi/v1/order`：weight=1
- `GET /fapi/v2/balance`：weight=5
- `GET /fapi/v2/positionRisk`：weight=5
- `GET /fapi/v4/account`：weight=5

Spot（来自 `aster-finance-spot-api_CN.md`）：

- `GET /api/v1/exchangeInfo`：weight=1
- `GET /api/v1/ticker/price`：带 symbol=1；不带=2（当前实现固定不带 symbol，使用 2）
- `GET /api/v1/openOrders`：带 symbol=1；不带=40
- `GET /api/v1/account`：weight=5
- `POST /api/v1/order`：weight=1
- `DELETE /api/v1/order`：weight=1

待补齐：

- `GET /fapi/v1/openInterest`：当前代码使用但文档缺失权重说明，暂定 `weight=1` 并记录到 context。
- `GET /api/v1/klines`：spot 文档未标注权重，暂按 futures 同规则计算（按 limit 表），后续如确认文档/实际口径不同再调整。

### 4) 示例（可直接照抄）

```ts
import { scopeError, tokenBucket } from '@yuants/utils';

export const getFApiV1FundingRate = async (params: { symbol?: string }) => {
  const baseURL = 'https://fapi.asterdex.com';
  const endpoint = '/fapi/v1/fundingRate';
  const url = new URL(baseURL);
  url.pathname = endpoint;
  const weight = 1;
  scopeError(
    'ASTER_API_RATE_LIMIT',
    { method: 'GET', endpoint, host: url.host, path: url.pathname, bucketId: url.host, weight },
    () => tokenBucket(url.host).acquireSync(weight),
  );
  return request('GET', baseURL, endpoint, params);
};
```

_创建于: 2025-12-24 | 最后更新: 2025-12-24_
