# HUOBI IOC/FOK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `@yuants/vendor-huobi` 增加 `SWAP` 的 `IOrder.order_type = 'IOC' | 'FOK'` 下单支持，并让 `listSwapOrders` 稳定回填 `order_type`。

**Architecture:** 把 Huobi `SWAP` 的订单类型语义拆成两个小型纯映射：提交侧统一生成普通合约账户与统一账户所需的下单字段，回读侧统一根据 `order_price_type` 还原 Yuan `order_type`。然后让 `submitOrder.ts` 与 `listOrders.ts` 共用这些 helper，并用最小 Jest 测试锁住普通账户、统一账户、回读三条链路。

**Tech Stack:** TypeScript, Heft/Jest, Rush, API Extractor

---

### Task 1: 建立 Huobi SWAP 订单类型映射 helper 与测试

**Files:**

- Create: `apps/vendor-huobi/src/services/orders/mapSwapOrderTypeToHuobi.ts`
- Create: `apps/vendor-huobi/src/services/orders/mapHuobiSwapOrderToOrderType.ts`
- Create: `apps/vendor-huobi/src/services/orders/order-type-mapping.test.ts`

- [ ] **Step 1: 写提交映射失败测试**

```ts
import { mapSwapOrderTypeToHuobi, mapUnionSwapOrderTypeToHuobi } from './mapSwapOrderTypeToHuobi';

describe('Huobi swap order type mappings', () => {
  test('maps IOC and FOK for normal swap accounts', () => {
    expect(mapSwapOrderTypeToHuobi('IOC')).toEqual({ order_price_type: 'ioc' });
    expect(mapSwapOrderTypeToHuobi('FOK')).toEqual({ order_price_type: 'fok' });
  });

  test('maps IOC and FOK for unified swap accounts', () => {
    expect(mapUnionSwapOrderTypeToHuobi('IOC')).toEqual({ type: 'limit', time_in_force: 'ioc' });
    expect(mapUnionSwapOrderTypeToHuobi('FOK')).toEqual({ type: 'limit', time_in_force: 'fok' });
  });
});
```

- [ ] **Step 2: 运行测试确认红灯**

Run: `./node_modules/.bin/heft test --test-path-pattern order-type-mapping`
Expected: FAIL，提示找不到 `./mapSwapOrderTypeToHuobi` 或对应导出不存在。

- [ ] **Step 3: 写回读映射失败测试**

```ts
import { mapHuobiSwapOrderToOrderType } from './mapHuobiSwapOrderToOrderType';

describe('mapHuobiSwapOrderToOrderType', () => {
  test('maps Huobi order_price_type values back to Yuan order types', () => {
    expect(mapHuobiSwapOrderToOrderType('lightning')).toBe('MARKET');
    expect(mapHuobiSwapOrderToOrderType('limit')).toBe('LIMIT');
    expect(mapHuobiSwapOrderToOrderType('ioc')).toBe('IOC');
    expect(mapHuobiSwapOrderToOrderType('optimal_20_ioc')).toBe('IOC');
    expect(mapHuobiSwapOrderToOrderType('fok')).toBe('FOK');
  });
});
```

- [ ] **Step 4: 实现最小 helper**

```ts
import { IOrder } from '@yuants/data-order';

export const mapSwapOrderTypeToHuobi = (orderType?: IOrder['order_type']) => {
  if (orderType === 'MARKET') return { order_price_type: 'market' };
  if (orderType === 'LIMIT') return { order_price_type: 'limit' };
  if (orderType === 'IOC') return { order_price_type: 'ioc' };
  if (orderType === 'FOK') return { order_price_type: 'fok' };
  throw new Error(`Unsupported order_type: ${orderType}`);
};

export const mapUnionSwapOrderTypeToHuobi = (orderType?: IOrder['order_type']) => {
  if (orderType === 'MARKET') return { type: 'market' as const, time_in_force: undefined };
  if (orderType === 'LIMIT') return { type: 'limit' as const, time_in_force: undefined };
  if (orderType === 'IOC') return { type: 'limit' as const, time_in_force: 'ioc' };
  if (orderType === 'FOK') return { type: 'limit' as const, time_in_force: 'fok' };
  throw new Error(`Unsupported order_type: ${orderType}`);
};
```

```ts
import { IOrder } from '@yuants/data-order';

export const mapHuobiSwapOrderToOrderType = (orderPriceType?: string): IOrder['order_type'] => {
  if (orderPriceType === 'lightning' || orderPriceType === 'market') return 'MARKET';
  if (orderPriceType === 'fok') return 'FOK';
  if (orderPriceType?.includes('ioc')) return 'IOC';
  return 'LIMIT';
};
```

- [ ] **Step 5: 运行测试确认绿灯**

Run: `./node_modules/.bin/heft test --test-path-pattern order-type-mapping`
Expected: PASS，3 tests passed。

- [ ] **Step 6: 提交 helper 与测试**

```bash
git add apps/vendor-huobi/src/services/orders/mapSwapOrderTypeToHuobi.ts apps/vendor-huobi/src/services/orders/mapHuobiSwapOrderToOrderType.ts apps/vendor-huobi/src/services/orders/order-type-mapping.test.ts
git commit -m "test(huobi): cover ioc fok order type mappings"
```

### Task 2: 接入普通合约账户 submitOrder 的 IOC/FOK 映射

**Files:**

- Modify: `apps/vendor-huobi/src/services/orders/submitOrder.ts`
- Reuse: `apps/vendor-huobi/src/services/orders/mapSwapOrderTypeToHuobi.ts`
- Modify: `apps/vendor-huobi/src/services/orders/order-type-mapping.test.ts`

- [ ] **Step 1: 为普通合约账户写失败测试**

```ts
jest.mock('../../api/private-api', () => ({
  getSwapCrossPositionInfo: jest.fn(),
  postSwapOrder: jest.fn(),
  postUnionAccountSwapOrder: jest.fn(),
}));

test.each([
  ['IOC', 'ioc'],
  ['FOK', 'fok'],
])('submitOrder sends normal swap %s orders with order_price_type=%s', async (orderType, orderPriceType) => {
  // mock getSwapCrossPositionInfo + postSwapOrder
  // call submitOrder with product_id=encodePath('HUOBI', 'SWAP', 'BTC-USDT')
  // assert postSwapOrder payload contains { order_price_type: orderPriceType, price: 12345 }
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `./node_modules/.bin/heft test --test-path-pattern order-type-mapping`
Expected: FAIL，提示 `order_price_type` 仍为 `limit`，或 `Unsupported order_type: IOC/FOK`。

- [ ] **Step 3: 让普通合约账户复用共享 helper**

```ts
import { mapSwapOrderTypeToHuobi } from './mapSwapOrderTypeToHuobi';

const orderTypeParams = mapSwapOrderTypeToHuobi(order.order_type);

const params = {
  contract_code: contractCode,
  contract_type: 'swap',
  price: order.price,
  volume: order.volume,
  offset: order.order_direction === 'OPEN_LONG' || order.order_direction === 'OPEN_SHORT' ? 'open' : 'close',
  direction:
    order.order_direction === 'OPEN_LONG' || order.order_direction === 'CLOSE_SHORT' ? 'buy' : 'sell',
  lever_rate,
  ...orderTypeParams,
  channel_code: process.env.BROKER_ID,
};
```

- [ ] **Step 4: 保持价格和方向逻辑不变**

Expected:

- `price` 仍直接透传 `order.price`
- `volume`、`offset`、`direction`、`lever_rate` 行为不变
- 仅把 `order_price_type` 从内联三元表达式切换为 helper

- [ ] **Step 5: 运行测试确认通过**

Run: `./node_modules/.bin/heft test --test-path-pattern order-type-mapping`
Expected: PASS。

- [ ] **Step 6: 提交普通合约账户 submitOrder 改动**

```bash
git add apps/vendor-huobi/src/services/orders/submitOrder.ts apps/vendor-huobi/src/services/orders/mapSwapOrderTypeToHuobi.ts apps/vendor-huobi/src/services/orders/order-type-mapping.test.ts
git commit -m "feat(huobi): support ioc fok for swap orders"
```

### Task 3: 接入统一账户 submitOrder 与 listOrders 回读闭环

**Files:**

- Modify: `apps/vendor-huobi/src/services/orders/submitOrder.ts`
- Modify: `apps/vendor-huobi/src/services/orders/listOrders.ts`
- Reuse: `apps/vendor-huobi/src/services/orders/mapSwapOrderTypeToHuobi.ts`
- Reuse: `apps/vendor-huobi/src/services/orders/mapHuobiSwapOrderToOrderType.ts`
- Modify: `apps/vendor-huobi/src/services/orders/order-type-mapping.test.ts`

- [ ] **Step 1: 为统一账户 submitOrder 写失败测试**

```ts
test.each([
  ['IOC', 'ioc'],
  ['FOK', 'fok'],
])('submitOrder sends unified swap %s orders with time_in_force=%s', async (orderType, timeInForce) => {
  // mock accountModeCache.query to return 1
  // mock postUnionAccountSwapOrder
  // assert payload contains { type: 'limit', time_in_force: timeInForce, price: 12345 }
});
```

- [ ] **Step 2: 为 listOrders 回填写失败测试**

```ts
test('listSwapOrders maps order_price_type back to Yuan order types', async () => {
  // mock getSwapOpenOrders to return rows with:
  // { order_price_type: 'lightning' }
  // { order_price_type: 'limit' }
  // { order_price_type: 'ioc' }
  // { order_price_type: 'fok' }
  // expect order_type to be MARKET / LIMIT / IOC / FOK
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `./node_modules/.bin/heft test --test-path-pattern order-type-mapping`
Expected: FAIL，提示统一账户没有透传 `time_in_force`，或 `listSwapOrders` 返回值未使用共享回读 helper。

- [ ] **Step 4: 让统一账户复用共享 helper**

```ts
import { mapUnionSwapOrderTypeToHuobi } from './mapSwapOrderTypeToHuobi';

const orderTypeParams = mapUnionSwapOrderTypeToHuobi(order.order_type);

const params = {
  contract_code: contractCode,
  margin_mode: 'cross',
  price: order.price,
  volume: order.volume,
  position_side: 'both',
  side: order.order_direction === 'OPEN_LONG' || order.order_direction === 'CLOSE_SHORT' ? 'buy' : 'sell',
  ...orderTypeParams,
  channel_code: process.env.BROKER_ID,
  reduce_only: order.is_close ? 1 : 0,
};
```

- [ ] **Step 5: 让 listOrders 复用共享回读 helper**

```ts
import { mapHuobiSwapOrderToOrderType } from './mapHuobiSwapOrderToOrderType';

order_type: mapHuobiSwapOrderToOrderType(v.order_price_type),
```

- [ ] **Step 6: 运行测试确认通过**

Run: `./node_modules/.bin/heft test --test-path-pattern order-type-mapping`
Expected: PASS。

- [ ] **Step 7: 提交统一账户与回读闭环改动**

```bash
git add apps/vendor-huobi/src/services/orders/submitOrder.ts apps/vendor-huobi/src/services/orders/listOrders.ts apps/vendor-huobi/src/services/orders/mapSwapOrderTypeToHuobi.ts apps/vendor-huobi/src/services/orders/mapHuobiSwapOrderToOrderType.ts apps/vendor-huobi/src/services/orders/order-type-mapping.test.ts
git commit -m "feat(huobi): align swap ioc fok order readback"
```

### Task 4: 文档同步、change file、验证与 PR 更新

**Files:**

- Modify: `docs/zh-Hans/vendor-supporting.md`
- Create: `common/changes/@yuants/vendor-huobi/*.json`
- Verify: `docs/superpowers/specs/2026-04-21-huobi-ioc-fok-design.md`
- Verify: `docs/superpowers/plans/2026-04-21-huobi-ioc-fok.md`

- [ ] **Step 1: 更新外部能力表说明**

在 `docs/zh-Hans/vendor-supporting.md` 的 HTX 注释附近补一句：

```md
> 注：HTX 合约账户下单当前支持 `LIMIT`、`MARKET`、`IOC`、`FOK`；其中统一账户的 `IOC/FOK` 通过 `type='limit' + time_in_force` 实现。
```

- [ ] **Step 2: 暂存相关改动**

Run: `git add apps/vendor-huobi/src docs/zh-Hans/vendor-supporting.md docs/superpowers/specs docs/superpowers/plans`
Expected: 相关文件进入 staged。

- [ ] **Step 3: 运行 `rush change` 生成 change file**

Run: `rush change`
Expected: 生成 `@yuants/vendor-huobi` 的 patch change file，描述 “add IOC/FOK order type support for Huobi swap order submission and listOrders readback mapping”。

- [ ] **Step 4: 提交 change file 与文档**

```bash
git add common/changes docs/zh-Hans/vendor-supporting.md
git commit -m "chore: add vendor-huobi change file for ioc fok"
```

- [ ] **Step 5: 运行最终验证**

Run: `./node_modules/.bin/heft test --clean`
Expected: `apps/vendor-huobi` 包内测试通过。

Run: `node common/scripts/install-run-rush.js build -t @yuants/vendor-huobi`
Expected: 若再次被 `@yuants/http-services` 的既有集成测试阻塞，则在结果中明确标记为仓库基线问题，而不是 Huobi IOC/FOK 回归。

- [ ] **Step 6: 推送分支并更新 PR**

```bash
git push
```

在 PR 中补充验证结果：

```md
- `./node_modules/.bin/heft test --clean`（apps/vendor-huobi） ✅
- `node common/scripts/install-run-rush.js build -t @yuants/vendor-huobi` ⚠️ blocked by pre-existing `@yuants/http-services` integration test failure
```
