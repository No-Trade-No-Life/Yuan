# Huobi public/private API tokenBucket：按业务与接口类型主动限流

## 目标

在 apps/vendor-huobi 的 public-api/private-api 发起请求前，按业务线（现货 / U 本位合约）与接口类型（行情/非行情，交易/查询）选择对应 tokenBucket 并 acquireSync(1) 做主动限流。

## 要点

- public-api/private-api 里创建 bucket（首次 create），请求时只 `acquireSync(1)`，不捕获 token 不足异常
- 不做“运行时识别/分类判断”：在每个 API 文件内提供固定的 request helper，并在调用点显式选择
  - public：`spotMarketRequest / spotNonMarketRequest / linearSwapMarketRequest / linearSwapNonMarketRequest`
  - private：`spotPrivateQueryRequest / spotPrivateTradeRequest / linearSwapPrivateQueryRequest / linearSwapPrivateTradeRequest`
- public（IP 维度）分两类，调用点直接选择对应 helper
  - 行情类（market data）：`800/1s`（spot 与 linear-swap 共享总额度，并额外扣减各自业务 bucket）
  - 非行情类（non-market public）：`120/3s`
- private（UID 维度，以 `credential.access_key` 作为隔离 key）分两类，调用点直接选择对应 helper
  - 交易接口（trade）：`36/3s`
  - 查询接口（query）：`36/3s`（包含 `swap_cross_openorders` / `swap_cross_position_info` 这类 POST 但语义为查询的接口）
- 兼容“共享总额度”与“业务线拆分”两种口径：对行情类与私有 trade/query 同时扣减 `global bucket` + `business bucket`
- 用 `scopeError` 仅包裹 acquireSync 并记录 metadata（api_root/path/method/bucketId/interfaceType/business），异常直接 throw

> [REVIEW] 你理解的不对，行清类

## 范围

- apps/vendor-huobi/src/api/public-api.ts
- apps/vendor-huobi/src/api/private-api.ts
- apps/vendor-huobi/src/api/public-api.rateLimit.test.ts
- apps/vendor-huobi/src/api/private-api.rateLimit.test.ts
- .legion/tasks/huobi-publicprivate-api-tokenbucket/plan.md
- .legion/tasks/huobi-publicprivate-api-tokenbucket/context.md
- .legion/tasks/huobi-publicprivate-api-tokenbucket/tasks.md

## 阶段概览

1. **调研** - 1 个任务
2. **设计（先写文档）** - 1 个任务
3. **实现** - 1 个任务
4. **验证与交接** - 1 个任务

---

## 设计细节

### 1) bucket 列表（首次 create）

public（IP 维度）：

- `HUOBI_PUBLIC_MARKET_IP_1S_ALL`：800/1s（行情类，spot 与 linear-swap 共享）
- `HUOBI_PUBLIC_MARKET_IP_1S_LINEAR_SWAP`：800/1s（U 本位合约）
- `HUOBI_PUBLIC_MARKET_IP_1S_SPOT`：800/1s（现货行情，暂与合约同口径）
- `HUOBI_PUBLIC_NON_MARKET_IP_3S_ALL`：120/3s（非行情公开接口）

private（UID 维度，以 `access_key` 隔离；同时扣减 global + business）：

- `HUOBI_PRIVATE_TRADE_UID_3S_ALL:<access_key>`：36/3s
- `HUOBI_PRIVATE_QUERY_UID_3S_ALL:<access_key>`：36/3s
- `HUOBI_PRIVATE_TRADE_UID_3S_<BUSINESS>:<access_key>`：36/3s（BUSINESS=linear-swap/spot）
- `HUOBI_PRIVATE_QUERY_UID_3S_<BUSINESS>:<access_key>`：36/3s

### 2) 接口类型识别规则

不在 request 内部做自动识别。每个 exported API 调用点在编写时直接选择对应的 helper：

- public：该 endpoint 是否属于行情类（market data）由调用点决定（与文档注释对应）
- private：该 endpoint 是否属于 trade/query 由调用点决定（与文档“读取/交易”对应）

### 3) 示例（可直接照抄）

```ts
import { scopeError } from '@yuants/utils';

const acquire = (bucketId: string, meta: Record<string, unknown>) =>
  scopeError('HUOBI_API_RATE_LIMIT', { ...meta, bucketId }, () => tokenBucket(bucketId).acquireSync(1));

const spotMarketRequest = async (method: string, path: string, params?: unknown) => {
  const meta = {
    method,
    api_root: 'api.huobi.pro',
    path,
    business: 'spot' as const,
    interfaceType: 'market' as const,
  };
  acquire('HUOBI_PUBLIC_MARKET_IP_1S_ALL', meta);
  acquire('HUOBI_PUBLIC_MARKET_IP_1S_SPOT', meta);
  // ...then fetch
};
```

_创建于: 2025-12-26 | 最后更新: 2025-12-26_
