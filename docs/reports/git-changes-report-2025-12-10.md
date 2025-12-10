# Git 变更报告（4a65d80af..dcb3ba955）

> **时间范围**：2025-12-09 至 2025-12-10
> **分析深度**：Level 2

## 1. 概览

- **提交数量**：18
- **主要贡献者**：github-actions[bot] (6 commits), humblelittlec1[bot] (5 commits), CZ (5 commits), Siyuan Wang (1 commit), Ryan (1 commit)
- **热点项目**：`apps/vendor-aster` (6 文件), `apps/vendor-binance` (5 文件), `apps/vendor-gate` (5 文件), `apps/vendor-hyperliquid` (5 文件), `apps/vendor-huobi` (5 文件), `apps/vendor-okx` (5 文件)
- **风险指标**：⚠️ 3 个 API 变更（高风险）

## 2. 核心变更

### 2.1 清算价格支持增强

**相关提交**：`ec638fca2`, `9f8b2059d`
**作者**：CZ

**设计意图**：
为多个交易所（Huobi、OKX、Gate、Hyperliquid）的仓位信息添加清算价格字段，增强风险监控能力。此前仓位数据缺少关键的清算价格信息，无法有效预警强平风险；现在统一在仓位信息中暴露 `liquidation_price` 字段，为风控系统提供必要数据支持。

**核心代码**：
[private-api.ts:L130-L154](apps/vendor-huobi/src/api/private-api.ts#L130-L154)

```typescript
export const getSwapCrossPositionInfo = (
    symbol: string;
    frozen: number;
    cost_open: number;
    profit_rate: number;
    position_margin: number;
    direction: string;
    profit: number;
    last_price: number;
    margin_asset: string;
    margin_mode: string;
    margin_account: string;
    contract_type: string;
    pair: string;
    business_type: string;
    position_mode: string;
    adl_risk_percent: string;
    liquidation_price?: number;
```

**影响范围**：
- 影响模块：`vendor-huobi`, `vendor-okx`, `vendor-gate`, `vendor-hyperliquid`
- 需要关注：所有使用这些交易所仓位数据的风控系统现在可以访问清算价格信息

### 2.2 Binance API 主动限流优化

**相关提交**：`0e69317d1`
**作者**：CZ

**设计意图**：
将全局限流控制改为按接口路径独立控制，避免单一接口限流影响其他正常接口。此前使用全局 `retryAfterUntil` 变量，一个接口触发限流会导致所有接口等待；现在使用 `mapPathToRetryAfterUntil` 映射表，每个接口独立管理限流状态，提高系统整体可用性。

**核心代码**：
[client.ts:L22-L123](apps/vendor-binance/src/api/client.ts#L22-L123)

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
MetricBinanceApiUsedWeight.labels({ endpoint, terminal_id: terminal.terminal_id }).set(+usedWeight1M);
```

**影响范围**：
- 影响模块：`vendor-binance` 所有 API 调用
- 需要关注：监控指标标签从 `terminal_id` 扩展为 `{endpoint, terminal_id}`

### 2.3 Spot 账户产品映射缓存优化

**相关提交**：`5fad1f6ea`, `cbbfb2ce9`, `f9883ff8c`
**作者**：Siyuan Wang

**设计意图**：
为 Aster、Hyperliquid、Gate 等交易所的现货账户服务添加产品映射缓存，避免每次查询仓位都重新拉取产品列表。此前硬编码产品 ID 或每次实时查询，效率低下且可能出错；现在使用 24 小时 TTL 缓存，构建 base_currency → product_id 映射，提升性能并保持数据一致性。

**核心代码**：
[spot.ts:L18-L46](apps/vendor-aster/src/services/accounts/spot.ts#L18-L46)

```typescript
const buildSpotProductMap = async () => {
  const products = await listProducts();
  const map = new Map<string, string>();
  for (const product of products) {
    const [, instType] = product.product_id.split('/');
    if (instType === 'SPOT') {
      map.set(product.base_currency, product.product_id);
    }
  }
  return map;
};

const [x, prices, prep, spotProductMap] = await Promise.all([
  buildSpotProductMap(),
]);

product_id: spotProductMap.get(b.asset) ?? encodePath('ASTER', 'SPOT', b.asset),
```

**影响范围**：
- 影响模块：`vendor-aster`, `vendor-hyperliquid`, `vendor-gate` 的现货账户服务
- 需要关注：缓存失效时间为 24 小时，产品列表更新有延迟

### 2.4 Gate 统一账户服务重构

**相关提交**：`7d834feb5`
**作者**：Siyuan Wang

**设计意图**：
整合 Gate 交易所的现货和期货账户逻辑，移除冗余的 `spot.ts` 和 `future.ts` 文件，统一通过 `unified.ts` 提供服务。此前现货和期货账户逻辑分离，代码重复且维护困难；现在统一账户服务内联永续持仓逻辑，统一输出头寸，简化架构并提高代码复用率。

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
- 影响模块：`vendor-gate` 所有账户相关服务
- 需要关注：删除了 `spot.ts` 和 `future.ts`，所有调用需迁移到 `unified.ts`

### 2.5 Aster 错误处理与仓位方向逻辑修复

**相关提交**：`e877cfa13`
**作者**：CZ

**设计意图**：
增强 Aster API 错误处理，将原始错误信息包装为结构化错误对象；同时修复永续合约仓位方向逻辑，明确标注 Aster 仅支持单向持仓模式。此前错误信息为原始字符串，难以追踪；仓位方向逻辑可能错误地设置 positionSide；现在提供详细错误上下文，并正确标记单向持仓特性。

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
- 影响模块：`vendor-aster` API 调用和订单提交
- 需要关注：错误处理格式变更，仓位方向逻辑调整

## 3. 贡献者

| 作者 | 提交数 | 主要工作 | 关键提交 |
| ---- | ------ | -------- | -------- |
| github-actions[bot] | 6 | 自动化版本发布和报告生成 | `fa4438943` |
| humblelittlec1[bot] | 5 | 版本更新和变更日志维护 | `baf2f4727` |
| CZ | 5 | API 优化、清算价格支持、错误处理 | `ec638fca2`, `0e69317d1` |
| Siyuan Wang | 1 | 账户服务重构、缓存优化 | `7d834feb5`, `f9883ff8c` |
| Ryan | 1 | 符号解析修复 | `fbb85da27` |

## 4. 风险评估

### 兼容性影响

**API 变更**：
- `vendor-huobi`: `getSwapCrossPositionInfo` 接口返回字段结构调整，新增 `liquidation_price` 字段
- `vendor-binance`: API 客户端限流逻辑变更，错误信息格式调整
- `vendor-aster`: 错误处理从字符串改为结构化错误对象

**受影响模块**：
- 所有使用上述接口的客户端代码需要适配新的错误处理格式
- 监控系统需要更新指标标签格式

### 配置变更

**新增配置**：
- 无新增配置项

**修改配置**：
- 无修改配置项

### 性能影响

**正面影响**：
- Binance API 限流优化：按接口独立控制，提高整体可用性
- Spot 产品映射缓存：减少重复 API 调用，提升账户查询性能
- Gate 统一账户服务：减少代码重复，提高维护性

**潜在风险**：
- 缓存一致性：24 小时 TTL 可能导致产品信息更新延迟

### 测试覆盖

**测试状态**：
- 未见测试文件更新，建议补充相关功能的单元测试
- 特别是 API 变更和错误处理逻辑需要测试验证

**建议**：
- 为新增的清算价格字段添加测试用例
- 验证缓存失效和回退逻辑
- 测试单向持仓模式下的订单提交行为