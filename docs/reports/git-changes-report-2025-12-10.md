# Git 变更报告（4a65d80af..dcb3ba955）

> **时间范围**：2025-12-09 至 2025-12-10
> **分析深度**：Level 2

## 1. 概览

- **提交数量**：18
- **主要贡献者**：github-actions[bot] (6 commits), humblelittlec1[bot] (5 commits), CZ (5 commits), Siyuan Wang (1 commit), Ryan (1 commit)
- **热点项目**：`apps/vendor-aster` (9 文件), `apps/vendor-binance` (6 文件), `apps/vendor-huobi` (5 文件), `apps/vendor-okx` (5 文件), `apps/vendor-gate` (5 文件), `apps/vendor-hyperliquid` (5 文件)
- **风险指标**：⚠️ 3 个 API 变更（高风险），1 个无测试覆盖（中风险）

## 2. 核心变更

### 2.1 清算价格支持增强

**相关提交**：`ec638fca2`, `9f8b2059d`
**作者**：CZ

**设计意图**：
为多个交易所（Huobi、OKX、Gate、Hyperliquid）的持仓信息添加清算价格（liquidation_price）字段，提升风险监控能力。此前这些交易所的持仓数据缺少清算价格信息，无法在 UI 中显示强平风险。现在统一在 API 响应中添加 `liquidation_price` 字段，并在前端账户信息面板中新增"清算价"列，帮助用户实时监控持仓风险。

**核心代码**：
[apps/vendor-huobi/src/api/private-api.ts:L131-L141](apps/vendor-huobi/src/api/private-api.ts#L131-L141)

```typescript
export const getSwapCrossPositionInfo = (
    liquidation_price?: number;
```

[apps/vendor-huobi/src/services/accounts/swap.ts:L46](apps/vendor-huobi/src/services/accounts/swap.ts#L46)

```typescript
liquidation_price: v.liquidation_price ? `${v.liquidation_price}` : undefined,
```

[ui/web/src/modules/AccountInfo/AccountInfoPanel.tsx:L317](ui/web/src/modules/AccountInfo/AccountInfoPanel.tsx#L317)

```typescript
helper.accessor('liquidation_price', { header: () => '清算价' }),
```

**影响范围**：
- 影响模块：`vendor-huobi`, `vendor-okx`, `vendor-gate`, `vendor-hyperliquid` 的账户服务
- 需要关注：前端账户信息面板已更新，新增"清算价"列显示

### 2.2 Binance API 主动限流优化

**相关提交**：`0e69317d1`, `7524db52e`
**作者**：CZ

**设计意图**：
改进 Binance API 的限流控制机制，从全局限流改为按接口路径独立控制，避免单一接口触发限流影响其他接口。同时为利率数据查询添加延迟，防止 API 请求过快触发限速。此前使用全局 `retryAfterUntil` 变量，一个接口限流会影响所有接口；现在使用 `mapPathToRetryAfterUntil` 按路径独立控制，并优化错误信息显示具体等待时间。

**核心代码**：
[apps/vendor-binance/src/api/client.ts:L22-L23](apps/vendor-binance/src/api/client.ts#L22-L23)

```typescript
// 每个接口单独进行主动限流控制
const mapPathToRetryAfterUntil: Record<string, number> = {};
```

[apps/vendor-binance/src/api/client.ts:L86-L98](apps/vendor-binance/src/api/client.ts#L86-L98)

```typescript
const retryAfterUntil = mapPathToRetryAfterUntil[endpoint];

// 主动限流
throw newError('ACTIVE_RATE_LIMIT', {
  wait_time: `${retryAfterUntil - Date.now()}ms`,
  retryAfterUntil,
  url: url.href,
  endpoint,
});
delete mapPathToRetryAfterUntil[endpoint];
mapPathToRetryAfterUntil[endpoint] = Date.now() + parseInt(retryAfter, 10) * 1000;
```

**影响范围**：
- 影响模块：`vendor-binance` API 客户端
- 需要关注：限流错误信息现在包含具体等待时间和接口路径

### 2.3 Spot 账户产品映射缓存优化

**相关提交**：`5fad1f6ea`, `cbbfb2ce9`, `f9883ff8c`
**作者**：Siyuan Wang

**设计意图**：
为 Aster、Gate、Hyperliquid 等交易所的 Spot 账户服务添加产品映射缓存（24 小时 TTL），优化产品列表查询逻辑。此前每次查询持仓都重新拉取产品列表，效率低下且可能触发 API 限速。现在使用 `createCache` 缓存 spot product 映射，构建 base_currency → product_id 的映射表，避免硬编码 product_id 格式。

**核心代码**：
[apps/vendor-aster/src/services/accounts/spot.ts:L18-L22](apps/vendor-aster/src/services/accounts/spot.ts#L18-L22)

```typescript
const spotProductMapCache = createCache(
  async () => {
    const products = await listProducts();
    const map = new Map<string, string>();
    for (const product of products) {
      const [, instType] = product.product_id.split('/');
      if (instType === 'SPOT') {
        map.set(product.base_currency, product.product_id);
      }
    }
    return map;
  },
  { expire: 86_400_000 },
);
```

[apps/vendor-aster/src/services/accounts/spot.ts:L50](apps/vendor-aster/src/services/accounts/spot.ts#L50)

```typescript
product_id: resolvedSpotProductMap.get(b.asset) ?? encodePath('ASTER', 'SPOT', b.asset),
```

**影响范围**：
- 影响模块：`vendor-aster`, `vendor-gate`, `vendor-hyperliquid` 的 spot 账户服务
- 需要关注：缓存失效时间为 24 小时，产品列表变更可能需要等待缓存刷新

### 2.4 Gate 统一账户服务重构

**相关提交**：`7d834feb5`
**作者**：Siyuan Wang

**设计意图**：
重构 Gate 交易所的账户服务，整合现货与期货逻辑到统一服务中，移除冗余的 spot/future 账户实现。此前 spot 和 future 账户逻辑分散在不同文件中，存在代码重复和维护困难。现在将所有账户逻辑整合到 `unified.ts`，统一从 `getUnifiedAccountInfo` 输出头寸，简化代码结构并提高可维护性。

**核心代码**：
[apps/vendor-gate/src/services/accounts/unified.ts:L8-L22](apps/vendor-gate/src/services/accounts/unified.ts#L8-L22)

```typescript
const spotProductMapCache = createCache(
  async () => {
    const products = await listProducts();
    const map = new Map<string, string>();
    for (const product of products ?? []) {
      const [, instType] = product.product_id.split('/');
      if (instType === 'SPOT') {
        map.set(product.base_currency, product.product_id);
      }
    }
    return map;
  },
  { expire: 86_400_000 },
);
```

**影响范围**：
- 影响模块：`vendor-gate` 账户服务
- 需要关注：删除了 `spot.ts` 和 `future.ts` 文件，所有账户逻辑迁移到 `unified.ts`

### 2.5 Aster 错误处理与持仓方向逻辑修复

**相关提交**：`e877cfa13`
**作者**：CZ

**设计意图**：
增强 Aster API 的错误处理，将原始错误信息包装为结构化错误对象。同时修复永续合约持仓方向逻辑，明确标注 Aster 仅支持单向持仓模式。此前 API 错误直接抛出字符串，难以追踪和调试；现在使用 `newError` 创建结构化错误对象。持仓方向逻辑添加 `isPositionSingleSide` 标志，避免错误的方向判断。

**核心代码**：
[apps/vendor-aster/src/api/private-api.ts:L99-L109](apps/vendor-aster/src/api/private-api.ts#L99-L109)

```typescript
throw newError(
  'ASTER_API_ERROR',
  {
    status: response.status,
    statusText: response.statusText,
    resText,
    params,
  },
  e,
);
```

[apps/vendor-aster/src/services/orders/submitOrder.ts:L80-L82](apps/vendor-aster/src/services/orders/submitOrder.ts#L80-L82)

```typescript
const isPositionSingleSide = true; // FIXME: Aster 永续合约仅支持单向持仓模式

const positionSide = isPositionSingleSide
  ? undefined
  : order.order_direction === 'OPEN_LONG' || order.order_direction === 'CLOSE_LONG'
  ? 'LONG'
  : order.order_direction === 'OPEN_SHORT' || order.order_direction === 'CLOSE_SHORT'
  ? 'SHORT'
  : undefined;
```

**影响范围**：
- 影响模块：`vendor-aster` API 客户端和订单服务
- 需要关注：错误信息格式变更，持仓方向逻辑调整

## 3. 贡献者

| 作者 | 提交数 | 主要工作 | 关键提交 |
| ---- | ------ | -------- | -------- |
| CZ | 5 | 清算价格支持、API 限流优化、错误处理增强 | `ec638fca2`, `0e69317d1`, `e877cfa13` |
| Siyuan Wang | 1 | Spot 账户缓存优化、Gate 统一账户重构 | `7d834feb5`, `f9883ff8c` |
| Ryan | 1 | Aster 产品 ID 解析修复 | `fbb85da27` |
| github-actions[bot] | 6 | 版本更新和自动化任务 | `fa4438943`, `8fa79e6e2` |
| humblelittlec1[bot] | 5 | 版本更新和 changelog 维护 | `baf2f4727`, `964396528` |

## 4. 风险评估

### 兼容性影响

**API 变更**：
- `vendor-huobi`: `getSwapCrossPositionInfo` 接口新增 `liquidation_price` 字段
- `vendor-okx`: `getTradingAccountInfo` 接口新增 `liquidation_price` 字段
- `vendor-aster`: API 错误格式从字符串改为结构化错误对象

**配置变更**：
- 无重大配置变更

### 性能影响

**正面影响**：
- Spot 账户产品映射缓存（24 小时 TTL）显著减少 API 调用
- Binance 按接口路径独立限流避免全局影响

**潜在风险**：
- 缓存可能导致产品列表变更延迟生效（最长 24 小时）

### 测试覆盖

**测试状态**：
- 未见测试文件更新，建议为新增功能添加单元测试
- 特别是 API 错误处理和缓存逻辑需要测试验证

### 部署建议

1. **灰度发布**：建议先部署到测试环境验证缓存逻辑
2. **监控重点**：关注 API 限流错误率和缓存命中率
3. **回滚预案**：准备好回滚到旧版本账户服务的方案

---

**报告生成时间**：2025-12-10  
**数据来源**：`docs/reports/git-changes-2025-12-10.json`  
**分析工具**：git-changes-reporter v3.0.0