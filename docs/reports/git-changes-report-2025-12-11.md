# Git 变更报告（dcb3ba955..a23c52dc5）

> **时间范围**：2025-12-10 至 2025-12-11
> **分析深度**：Level 2

## 1. 概览

- **提交数量**：15
- **主要贡献者**：CZ (12 commits), humblelittlec1[bot] (2 commits), Siyuan Wang (1 commit)
- **热点目录**：`apps` (46 文件), `common` (20 文件), `libraries` (12 文件)
- **风险指标**：⚠️ 1 个中风险项（缺少测试覆盖）

## 2. 核心变更

### 2.1 订单接口增强与填充逻辑

**相关提交**：`a23c52dc5`, `29249f062`
**作者**：CZ

**设计意图**：
增强订单接口以支持更灵活的交易操作，新增 `size` 和 `is_close` 字段，使订单能够直接指定净交易数量和是否为平仓单。同时实现订单填充逻辑，自动根据产品配置计算订单方向和数量，简化 VEX 代理的使用。通过 `polyfillOrders` 函数统一处理订单预处理，确保订单参数符合交易所要求。

**核心代码**：
[position.ts:L95-L124](apps/virtual-exchange/src/position.ts#L95-L124)

```typescript
export const polyfillOrders = async (orders: IOrder[]): Promise<IOrder[]> => {
  for (const order of orders) {
    const theProduct = await productCache.query(order.product_id);
    if (theProduct) {
      if (order.size !== undefined) {
        const sizeNum = +order.size;
        const sizeStep = theProduct.volume_step * theProduct.value_scale;
        if (!(sizeStep > 0)) throw newError('INVALID_SIZE_STEP', { product: theProduct, sizeStep });
        // check size is multiple of sizeStep
        if (Math.abs(sizeNum - Math.round(sizeNum / sizeStep) * sizeStep) > 1e-16) {
          throw newError('INVALID_ORDER_SIZE_NOT_MULTIPLE_OF_SIZE_STEP', {
            order,
            sizeStep,
            sizeNum,
            product: theProduct,
          });
        }

        if (sizeNum >= 0) {
          order.order_direction = order.is_close ? 'CLOSE_SHORT' : 'OPEN_LONG';
        } else {
          order.order_direction = order.is_close ? 'CLOSE_LONG' : 'OPEN_SHORT';
        }
        order.volume = Math.abs(sizeNum) / theProduct.value_scale;
      }
    }
  }
  return orders;
};
```

**影响范围**：

- 影响模块：`apps/virtual-exchange`, `libraries/data-order`
- 需要关注：所有使用订单服务的模块现在会自动应用填充逻辑，确保订单参数正确性

### 2.2 利息率结算时间估算优化

**相关提交**：`29249f062`
**作者**：CZ

**设计意图**：
改进利息率间隔计算逻辑，不仅返回间隔时间，还计算并返回前一个、前前一个时间点以及下一个预估结算时间。当行情数据中没有明确的下一个结算时间时，使用历史利息率数据的时间间隔来估算下一个结算时间，提高持仓结算时间预测的准确性。

**核心代码**：
[position.ts:L25-L34](apps/virtual-exchange/src/position.ts#L25-L34)

```typescript
const interestRateIntervalCache = createCache(async (product_id: string) => {
  const rates = await requestSQL<{ created_at: string }>(/* ... */);
  const prev = new Date(rates[0].created_at).getTime();
  const prevOfPrev = new Date(rates[1].created_at).getTime();
  const interval = prev - prevOfPrev;
  const next = prev + interval;
  return {
    prev,
    prevOfPrev,
    interval,
    next,
  };
});
```

**影响范围**：

- 影响模块：`apps/virtual-exchange` 持仓计算
- 期货持仓的结算时间预测更加准确

### 2.3 分页查询修复与数据系列模式更新

**相关提交**：`4fba13b81`, `74d563a65`
**作者**：CZ

**设计意图**：
修复 Bitget 利息率查询的分页逻辑，将 `current_page` 初始值从 0 改为 1，确保分页查询从第一页开始。同时更新数据系列的模式匹配逻辑，正确处理前缀部分数组参数，确保数据系列查询能够正确匹配带有多个前缀部分的系列 ID。

**核心代码**：
[interest-rate.ts:L32](apps/vendor-bitget/src/services/markets/interest-rate.ts#L32)

```typescript
let current_page = 1;
```

**影响范围**：

- 影响模块：`apps/vendor-bitget`, `libraries/data-series`
- 修复了分页查询可能跳过第一页数据的问题

## 3. 贡献者

| 作者 | 提交数 | 主要工作 | 关键提交 |
| ---- | ------ | -------- | -------- |
| CZ | 12 | 订单接口增强、利息率计算优化、错误修复 | `a23c52dc5`, `29249f062` |
| humblelittlec1[bot] | 2 | 版本更新、CHANGELOG 维护 | `7f984624d` |
| Siyuan Wang | 1 | Git 变更报告生成 | `6c88d4217` |

## 4. 风险评估

### 兼容性影响

**低风险**：订单接口新增了 `size` 和 `is_close` 可选字段，不影响现有代码。`polyfillOrders` 函数会透明处理订单填充，调用方无需修改。

### 配置变更

**无配置变更**：本次变更不涉及配置文件修改。

### 性能影响

**轻微影响**：`polyfillOrders` 函数增加了订单预处理步骤，但性能开销可忽略。利息率间隔缓存机制优化了结算时间计算性能。

### 测试覆盖

**中风险**：JSON 分析显示存在"缺少测试覆盖"风险指标。新增的订单填充逻辑和利息率计算优化需要相应的单元测试覆盖。

---
**报告生成时间**：2025-12-11
**数据来源**：docs/reports/git-changes-2025-12-11.json
**技能版本**：git-changes-reporter 3.0.0