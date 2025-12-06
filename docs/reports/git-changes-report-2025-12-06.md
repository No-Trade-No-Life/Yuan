# Git 变更报告（c36262cad..c3b9a3726）

> **时间范围**：2025-12-05 至 2025-12-06
> **分析深度**：Level 2

## 1. 概览

- **提交数量**：21
- **主要贡献者**：humblelittlec1[bot] (9 commits), Ryan (8 commits), CZ (4 commits)
- **热点目录**：`apps` (24 文件), `common` (3 文件)
- **风险指标**：⚠️ 1 个中等风险项（大规模重构）

## 2. 核心变更

### 2.1 订单相关函数重构与 broker tag 支持

**相关提交**：`6f0d6e65c`, `60338d133`, `ac108ab9d`
**作者**：CZ

**设计意图**：
重构订单相关函数，将分散在 `experimental` 目录下的订单操作函数（submitOrder、cancelOrder、modifyOrder）统一迁移到专门的 `orders` 目录，提高代码组织性。同时为订单提交和算法订单添加 broker tag 支持，通过环境变量 `BROKER_TAG` 或 `BROKER_CODE` 传递券商标识，满足合规和追踪需求。

**核心代码**：
[submitOrder.ts:L118](apps/vendor-okx/src/orders/submitOrder.ts#L118)

```typescript
    tag: process.env.BROKER_CODE,
```

[services.ts:L24](apps/vendor-okx/src/services.ts#L24)

```typescript
        msg.req.tag = process.env.BROKER_CODE;
```

**影响范围**：
- 影响模块：`vendor-okx` 订单系统
- 需要关注：环境变量从 `BROKER_TAG` 改为 `BROKER_CODE`，需要相应更新部署配置

### 2.2 市场数据与资金费率支持

**相关提交**：`af56c8e8a`, `4ecf8af00`, `1e77d860a`, `8aa2e3f9d`, `c79ad8cf3`
**作者**：Ryan

**设计意图**：
为多个交易平台（OKX、Hyperliquid、Aster）添加资金费率（interest rate）支持，完善市场数据报价系统。通过 WebSocket 或 REST API 获取资金费率数据，为永续合约提供多头和空头资金费率信息，帮助交易策略计算持仓成本。

**核心代码**：
[quote.ts:L194-L214](apps/vendor-okx/src/public-data/new-quote.ts#L194-L214)

```typescript
const interestRateOfSwap$ = fundingRate$.pipe(
  mergeMap((premiumDataArray) => premiumDataArray),
  map(
    (premiumData): Partial<IQuote> => ({
      datasource_id: 'OKX',
      product_id: encodePath('OKX', 'SWAP', premiumData.instId),
      interest_rate_long: premiumData.fundingRate ? `${-+premiumData.fundingRate}` : undefined,
      interest_rate_short: premiumData.fundingRate,
      interest_rate_next_settled_at: formatTime(+premiumData.fundingTime),
    }),
  ),
);
```

[quote.ts:L40-L41](apps/vendor-hyperliquid/src/services/markets/quote.ts#L40-L41)

```typescript
      interest_rate_long: ctx?.funding ? `${-+ctx.funding}` : undefined,
      interest_rate_short: ctx?.funding,
```

**影响范围**：
- 影响模块：`vendor-okx`, `vendor-hyperliquid`, `vendor-aster` 的报价系统
- 新增数据字段：`interest_rate_long`, `interest_rate_short`, `interest_rate_next_settled_at`

### 2.3 ASTER 平台未平仓合约缓存优化

**相关提交**：`ec771df32`, `8aa2e3f9d`
**作者**：CZ, Ryan

**设计意图**：
优化 ASTER 平台的未平仓合约（open interest）数据获取逻辑。最初暂时移除了缓存和相关限速逻辑以避免 API 限速问题，随后重新实现为受控轮询机制，根据交易所返回的 rate limits 动态计算请求间隔，确保在遵守 API 限制的前提下高效获取数据。

**核心代码**：
[quote.ts:L123-L151](apps/vendor-aster/src/services/markets/quote.ts#L123-L151)

```typescript
const openInterestRotation$ = combineLatest([symbolList$, requestInterval$]).pipe(
  exhaustMap(([symbols, requestInterval]) =>
    defer(() => {
      console.info(
        `Starting open interest rotation for ${symbols.length} symbols with ${requestInterval}ms interval`,
      );
      return from(symbols).pipe(
        concatMap((symbol, index) =>
          (index > 0 ? timer(requestInterval) : of(0)).pipe(
            mergeMap(() => from(openInterestCache.query(symbol))),
            map((openInterest) => ({
              symbol,
              openInterest: openInterest ?? '0',
              timestamp: Date.now(),
            })),
            catchError((err) => {
              console.warn(`Failed to fetch open interest for ${symbol}:`, err);
              return of(undefined);
            }),
          ),
        ),
      );
    }),
  ),
  filter((x) => !!x),
  shareReplay({ bufferSize: 1000, refCount: true }),
);
```

**影响范围**：
- 影响模块：`vendor-aster` 市场数据服务
- 性能影响：通过缓存和限速控制减少 API 调用频率

### 2.4 WebSocket 连接复用优化

**相关提交**：`c79ad8cf3`
**作者**：Ryan

**设计意图**：
优化 OKX WebSocket 客户端连接复用机制，通过全局缓存存储已创建的 WebSocket Observable，实现订阅复用。使用 `shareReplay` 操作符缓存最新数据，新订阅者可以立即获得最新数据，同时当所有订阅者都取消订阅时自动清理资源，减少不必要的 WebSocket 连接。

**核心代码**：
[ws.ts:L274-L332](apps/vendor-okx/src/ws.ts#L274-L332)

```typescript
const fromWsChannelAndInstId = <T>(path: string, channel: string, instId: string) => {
  const cacheKey = encodePath(path, channel, instId);

  // 检查缓存中是否已存在该订阅
  const cached = wsObservableCache.get(cacheKey);
  if (cached) {
    console.info(formatTime(Date.now()), `♻️ Reusing cached subscription: ${cacheKey}`);
    return cached as Observable<T>;
  }

  // 创建新的 Observable
  const observable$ = new Observable<T>((subscriber) => {
    const client = OKXWsClient.GetWsClient(path);
    client.subscribe(channel, instId, (data: T) => {
      subscriber.next(data);
    });
    // ... 连接监听和清理逻辑
  }).pipe(
    // 🔑 关键：使用 shareReplay 实现订阅复用
    // - bufferSize: 1 - 缓存最新的一个值，新订阅者可以立即获得最新数据
    // - refCount: true - 当所有订阅者都取消订阅时，自动取消上游订阅并清理资源
    shareReplay({ bufferSize: 1, refCount: true }),
    // 当订阅完全结束时，从缓存中移除
    tap({
      finalize: () => {
        console.info(formatTime(Date.now()), `🗑️ Removing from cache: ${cacheKey}`);
        wsObservableCache.delete(cacheKey);
      },
    }),
  );

  // 存入缓存
  wsObservableCache.set(cacheKey, observable$);
  console.info(formatTime(Date.now()), `📦 Cached new subscription: ${cacheKey}`);

  return observable$;
};
```

**影响范围**：
- 影响模块：`vendor-okx` WebSocket 客户端
- 性能提升：减少重复的 WebSocket 连接和订阅

## 3. 贡献者

| 作者 | 提交数 | 主要工作 | 关键提交 |
| ---- | ------ | -------- | -------- |
| humblelittlec1[bot] | 9 | 版本更新和 CHANGELOG 维护 | `624436a6e`, `d8d60c1f2`, `82809689b` |
| Ryan | 8 | 资金费率支持、WebSocket 优化、市场数据增强 | `af56c8e8a`, `4ecf8af00`, `c79ad8cf3` |
| CZ | 4 | 订单系统重构、broker tag 支持、API 优化 | `6f0d6e65c`, `60338d133`, `ac108ab9d` |

## 4. 风险评估

### 兼容性影响

1. **环境变量变更**：`BROKER_TAG` 改为 `BROKER_CODE`，需要更新部署环境配置
2. **订单函数路径变更**：订单相关函数从 `experimental/` 目录迁移到 `orders/` 目录，影响相关导入语句
3. **新增数据字段**：报价系统新增 `interest_rate_long`, `interest_rate_short`, `interest_rate_next_settled_at` 字段，下游消费者需要适配

### 配置变更

- 新增环境变量：`BROKER_CODE`（替换 `BROKER_TAG`）
- 新增环境变量：`OPEN_INTEREST_CYCLE_DELAY`（控制 ASTER 未平仓合约轮询间隔）

### 性能影响

1. **正向影响**：
   - WebSocket 连接复用减少连接数
   - ASTER 未平仓合约缓存和限速控制减少 API 调用
   - 资金费率数据通过高效轮询获取

2. **潜在风险**：
   - 大规模重构（`ac108ab9d`）涉及多个文件删除和移动，需要仔细测试

### 测试覆盖

- 未见测试文件更新
- 功能变更较多，建议增加相应单元测试和集成测试
- 资金费率功能涉及多个交易平台，需要跨平台测试验证

---

**报告生成时间**：2025-12-06
**数据来源**：`docs/reports/git-changes-2025-12-06.json`
**分析工具**：git-changes-reporter v3.0.0