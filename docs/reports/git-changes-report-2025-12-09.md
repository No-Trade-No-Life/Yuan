# Git 变更报告（4d9c58da8..4a65d80af）

> **时间范围**：2025-12-08 至 2025-12-09
> **分析深度**：Level 2

## 1. 概览

- **提交数量**：15
- **主要贡献者**：humblelittlec1[bot] (5 commits), CZ (5 commits), Siyuan Wang (4 commits), Ryan (1 commit)
- **热点项目**：`apps/vendor-gate` (9 文件), `apps/vendor-aster` (7 文件), `apps/vendor-hyperliquid` (7 文件), `apps/vendor-binance` (6 文件)
- **风险指标**：⚠️ 1 个高风险项（API 变更）

## 2. 核心变更

### 2.1 清算价格支持增强

**相关提交**：`ec638fca2`, `9f8b2059d`
**作者**：CZ

**设计意图**：
为多个交易所（Huobi、OKX、Gate、Hyperliquid）的仓位信息添加清算价格字段，提升风险管理能力。此前仓位数据缺少清算价格信息，交易者无法直观了解仓位风险水平；现在统一在仓位信息中暴露 `liquidation_price` 字段，帮助用户监控仓位安全边际，避免因价格波动导致的强制平仓。

**核心代码**：
[swap.ts:L46](apps/vendor-huobi/src/services/accounts/swap.ts#L46)

```typescript
liquidation_price: v.liquidation_price ? `${v.liquidation_price}` : undefined,
```

**影响范围**：
- 影响模块：`vendor-huobi`, `vendor-okx`, `vendor-gate`, `vendor-hyperliquid` 的仓位查询服务
- UI 层已同步更新，在账户信息面板显示清算价列

### 2.2 Binance API 主动限流优化

**相关提交**：`0e69317d1`
**作者**：CZ

**设计意图**：
将全局限流控制改为按接口路径独立控制，避免单一接口触发限流影响其他接口的正常调用。此前使用全局 `retryAfterUntil` 变量，任一接口触发限流会阻塞所有接口；现在改为 `mapPathToRetryAfterUntil` 字典，每个接口独立计算限流时间，提升系统整体可用性。

**核心代码**：
[client.ts:L23-L123](apps/vendor-binance/src/api/client.ts#L23-L123)

```typescript
// 每个接口单独进行主动限流控制
const mapPathToRetryAfterUntil: Record<string, number> = {};

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
- 仅影响 Binance 供应商的 API 调用逻辑
- 提升多接口并发场景下的稳定性

### 2.3 Spot 账户产品映射优化

**相关提交**：`5fad1f6ea`, `cbbfb2ce9`, `f9883ff8c`
**作者**：Siyuan Wang

**设计意图**：
优化现货账户的产品 ID 映射逻辑，从硬编码模式改为动态查询产品列表并构建映射缓存。此前使用固定格式生成 product_id（如 `${asset}-USDC`），无法适应交易所动态产品列表；现在通过 `listProducts()` 获取最新产品信息，构建 `base_currency → product_id` 映射，并添加 24 小时 TTL 缓存提升性能。

**核心代码**：
[spot.ts:L18-L51](apps/vendor-aster/src/services/accounts/spot.ts#L18-L51)

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

const [x, prices, prep, spotProductMap] = await Promise.all([
  getApiV1Account(credential),
  asBNBPrice.query(''),
  getFApiV4Account(credential),
  spotProductMapCache.query(''),
]);

const resolvedSpotProductMap = spotProductMap ?? new Map<string, string>();

product_id: resolvedSpotProductMap.get(b.asset) ?? encodePath('ASTER', 'SPOT', b.asset),
```

**影响范围**：
- 影响模块：`vendor-aster`, `vendor-hyperliquid`, `vendor-gate` 的现货账户服务
- 提升产品 ID 准确性，避免因产品列表变更导致的映射错误

### 2.4 Gate 统一账户服务重构

**相关提交**：`7d834feb5`
**作者**：Siyuan Wang

**设计意图**：
整合 Gate 交易所的现货与期货账户逻辑，移除冗余的 `spot.ts` 和 `future.ts` 文件，统一通过 `unified.ts` 提供服务。此前现货和期货有独立的实现，存在代码重复和维护困难；现在将期货持仓逻辑内联到统一账户服务，并复用现货产品映射缓存，简化架构提升可维护性。

**核心代码**：
[unified.ts:L8-L89](apps/vendor-gate/src/services/accounts/unified.ts#L8-L89)

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

const loadFuturePositions = async (credential: ICredential): Promise<IPosition[]> => {
  const positions: IPosition[] = [];
  const positionsRes = await getFuturePositions(credential, 'usdt');

  for (const position of Array.isArray(positionsRes) ? positionsRes : []) {
    if (!(Math.abs(position.size) > 0)) continue;

    const product_id = encodePath('GATE', 'FUTURE', position.contract);
    const volume = Math.abs(position.size);
    const closable_price = Number(position.mark_price);
    const valuation = volume * closable_price;
    positions.push({
      datasource_id: 'GATE',
      position_id: `${position.contract}-${position.leverage}-${position.mode}`,
      product_id,
      direction:
        position.mode === 'dual_long'
          ? 'LONG'
          : position.mode === 'dual_short'
          ? 'SHORT'
          : position.size > 0
          ? 'LONG'
          : 'SHORT',
      volume,
      free_volume: Math.abs(position.size),
      position_price: Number(position.entry_price),
      closable_price,
      floating_profit: Number(position.unrealised_pnl),
      liquidation_price: position.liq_price,
      valuation,
    });
  }

  return positions;
};
```

**影响范围**：
- 完全重构 Gate 账户服务架构
- 删除 `apps/vendor-gate/src/services/accounts/{spot,future}.ts` 文件
- 统一账户查询逻辑，简化外部调用

### 2.5 Aster 错误处理与持仓方向修复

**相关提交**：`e877cfa13`
**作者**：CZ

**设计意图**：
修复 Aster 交易所 API 错误处理格式，并修正永续合约持仓方向逻辑。此前 API 错误直接抛出字符串，不利于错误追踪；现在使用 `newError` 标准化错误格式。同时发现 Aster 永续合约仅支持单向持仓模式，添加 `isPositionSingleSide` 标志避免错误的 `positionSide` 设置。

**核心代码**：
[submitOrder.ts:L80-L96](apps/vendor-aster/src/services/orders/submitOrder.ts#L80-L96)

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
- 影响 Aster 永续合约订单提交逻辑
- 标准化错误处理提升可观测性

## 3. 贡献者

| 作者 | 提交数 | 主要工作 | 关键提交 |
| ---- | ------ | -------- | -------- |
| CZ | 5 | 清算价格支持、API 限流优化、错误处理 | `ec638fca2`, `0e69317d1`, `e877cfa13` |
| Siyuan Wang | 4 | Spot 产品映射优化、账户服务重构 | `5fad1f6ea`, `cbbfb2ce9`, `f9883ff8c`, `7d834feb5` |
| humblelittlec1[bot] | 5 | 版本发布与变更记录更新 | `baf2f4727`, `8fa79e6e2`, `964396528`, `bcc58c8fa`, `4a65d80af` |
| Ryan | 1 | 符号解析修复 | `fbb85da27` |

## 4. 风险评估

### 兼容性影响

**高风险变更**：
1. **API 接口变更**：`ec638fca2` 修改了 Huobi 的 `getSwapCrossPositionInfo` 接口返回值结构，添加了 `liquidation_price` 等字段
2. **错误处理格式**：`e877cfa13` 将 Aster API 错误从字符串改为 `newError` 对象，可能影响现有错误处理逻辑

**受影响的模块**：
- `vendor-huobi` 的仓位查询客户端
- `vendor-aster` 的错误处理代码

### 配置变更

**新增配置**：无

**修改配置**：无

**删除配置**：无

### 性能影响

**正面影响**：
1. **缓存优化**：Spot 产品映射添加 24 小时 TTL 缓存，减少重复 API 调用
2. **限流优化**：Binance 接口级限流提升多接口并发性能

**潜在风险**：
1. **内存使用**：产品映射缓存可能占用额外内存，但规模可控

### 测试覆盖

**测试缺口**：
- 所有功能变更均未见对应的测试文件更新
- 建议补充以下测试：
  - 清算价格字段的正确解析
  - Spot 产品映射缓存的命中与回退逻辑
  - 统一账户服务的现货与期货集成

---

**报告生成时间**：2025-12-09  
**数据源**：`docs/reports/git-changes-2025-12-09.json`  
**分析工具**：git-changes-reporter v3.0.0

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>