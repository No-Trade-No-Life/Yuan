# Gate IOC/FOK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `@yuants/vendor-gate` 增加 `IOrder.order_type = 'IOC' | 'FOK'` 的永续下单支持，并让 `listOrders` 基于 `tif + price` 回填 `order_type`。

**Architecture:** 先把 Gate 订单类型映射拆成两个纯函数：提交侧 `order_type -> tif` 与回读侧 `tif + price -> order_type`。然后让 `submitOrder.ts` 与 `listOrders.ts` 复用这些 helper，并用最小集成测试锁住 Gate 特有的 `MARKET` 与 `IOC` 同为 `ioc` 的语义差异。

**Tech Stack:** TypeScript, Heft/Jest, Rush, API Extractor

---

### Task 1: 建立 Gate 订单类型映射 helper 与测试

**Files:**

- Create: `apps/vendor-gate/src/services/orders/mapOrderTypeToTif.ts`
- Create: `apps/vendor-gate/src/services/orders/mapGateOrderToOrderType.ts`
- Create: `apps/vendor-gate/src/services/orders/order-type-mapping.test.ts`

- [ ] **Step 1: 写提交映射失败测试**

```ts
import { mapOrderTypeToTif } from './mapOrderTypeToTif';

describe('mapOrderTypeToTif', () => {
  test('maps IOC and FOK to Gate tif values', () => {
    expect(mapOrderTypeToTif('IOC')).toBe('ioc');
    expect(mapOrderTypeToTif('FOK')).toBe('fok');
  });
});
```

- [ ] **Step 2: 运行测试确认红灯**

Run: `./node_modules/.bin/heft test --test-path-pattern order-type-mapping`
Expected: FAIL，提示 `Cannot find module './mapOrderTypeToTif'` 或导出不存在。

- [ ] **Step 3: 写回读映射失败测试**

```ts
import { mapGateOrderToOrderType } from './mapGateOrderToOrderType';

describe('mapGateOrderToOrderType', () => {
  test('maps Gate tif and price to Yuan order types', () => {
    expect(mapGateOrderToOrderType({ tif: 'ioc', price: '0' })).toBe('MARKET');
    expect(mapGateOrderToOrderType({ tif: 'ioc', price: '12345' })).toBe('IOC');
    expect(mapGateOrderToOrderType({ tif: 'fok', price: '12345' })).toBe('FOK');
  });
});
```

- [ ] **Step 4: 实现最小 helper**

```ts
export const mapOrderTypeToTif = (orderType?: string): string => {
  if (orderType === 'MARKET') return 'ioc';
  if (orderType === 'LIMIT' || orderType === 'MAKER') return 'gtc';
  if (orderType === 'IOC') return 'ioc';
  if (orderType === 'FOK') return 'fok';
  throw new Error(`Unsupported order_type: ${orderType}`);
};
```

```ts
export const mapGateOrderToOrderType = (order: { tif?: string; price?: string }) => {
  if (order.tif === 'fok') return 'FOK';
  if (order.tif === 'ioc') {
    return Number(order.price) === 0 ? 'MARKET' : 'IOC';
  }
  return undefined;
};
```

- [ ] **Step 5: 运行测试确认绿灯**

Run: `./node_modules/.bin/heft test --test-path-pattern order-type-mapping`
Expected: PASS，2 tests passed。

- [ ] **Step 6: 提交 helper 与测试**

```bash
git add apps/vendor-gate/src/services/orders/mapOrderTypeToTif.ts apps/vendor-gate/src/services/orders/mapGateOrderToOrderType.ts apps/vendor-gate/src/services/orders/order-type-mapping.test.ts
git commit -m "test(gate): cover ioc fok order type mappings"
```

### Task 2: 接入 submitOrder 的 IOC/FOK 下单映射

**Files:**

- Modify: `apps/vendor-gate/src/services/orders/submitOrder.ts`
- Reuse: `apps/vendor-gate/src/services/orders/mapOrderTypeToTif.ts`
- Modify: `apps/vendor-gate/src/services/orders/order-type-mapping.test.ts`

- [ ] **Step 1: 为 submitOrder 写失败测试**

```ts
test.each([
  ['IOC', 'ioc', '12345'],
  ['FOK', 'fok', '12345'],
])('submits %s orders with Gate tif %s and keeps price', async (orderType, tif, price) => {
  // arrange mocks
  // call submitOrder(...)
  // assert postFutureOrders payload includes tif and price
});
```

- [ ] **Step 2: 运行目标测试确认失败**

Run: `./node_modules/.bin/heft test --test-path-pattern order-type-mapping`
Expected: FAIL，提示 `Unsupported order_type: IOC` 或 `Unsupported order_type: FOK`。

- [ ] **Step 3: 让 submitOrder 使用共享 helper**

```ts
import { mapOrderTypeToTif } from './mapOrderTypeToTif';

const tif = mapOrderTypeToTif(order.order_type);
```

并删除 `submitOrder.ts` 内部重复的 `resolveTif` 实现。

- [ ] **Step 4: 确认价格逻辑保持原样**

```ts
const price = order.order_type === 'MARKET' ? '0' : order.price !== undefined ? `${order.price}` : undefined;
```

Expected: `MARKET` 仍走 `'0'`；`IOC/FOK` 仍要求 `price`。

- [ ] **Step 5: 运行测试确认通过**

Run: `./node_modules/.bin/heft test --test-path-pattern order-type-mapping`
Expected: PASS。

- [ ] **Step 6: 提交 submitOrder 接线**

```bash
git add apps/vendor-gate/src/services/orders/submitOrder.ts apps/vendor-gate/src/services/orders/mapOrderTypeToTif.ts apps/vendor-gate/src/services/orders/order-type-mapping.test.ts
git commit -m "feat(gate): support ioc fok submit order mapping"
```

### Task 3: 在 listOrders 中回填 order_type

**Files:**

- Modify: `apps/vendor-gate/src/services/orders/listOrders.ts`
- Reuse: `apps/vendor-gate/src/services/orders/mapGateOrderToOrderType.ts`
- Modify: `apps/vendor-gate/src/services/orders/order-type-mapping.test.ts`

- [ ] **Step 1: 写 listOrders 回填失败测试**

```ts
test('maps Gate open orders back to MARKET IOC and FOK', async () => {
  // mock getFuturesOrders to return:
  // { tif: 'ioc', price: '0' }
  // { tif: 'ioc', price: '12345' }
  // { tif: 'fok', price: '12345' }
  // expect returned order_type to be MARKET / IOC / FOK
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `./node_modules/.bin/heft test --test-path-pattern order-type-mapping`
Expected: FAIL，提示 `order_type` 缺失或返回值不匹配。

- [ ] **Step 3: 在 listOrders 回填 order_type**

```ts
import { mapGateOrderToOrderType } from './mapGateOrderToOrderType';

return {
  // ...existing fields
  order_type: mapGateOrderToOrderType(order),
};
```

- [ ] **Step 4: 保持现有字段行为不变**

Expected:

- `price`、`volume`、`order_status` 等现有字段不重写
- 仅增加 `order_type`

- [ ] **Step 5: 运行测试确认通过**

Run: `./node_modules/.bin/heft test --test-path-pattern order-type-mapping`
Expected: PASS。

- [ ] **Step 6: 提交 listOrders 回填**

```bash
git add apps/vendor-gate/src/services/orders/listOrders.ts apps/vendor-gate/src/services/orders/mapGateOrderToOrderType.ts apps/vendor-gate/src/services/orders/order-type-mapping.test.ts
git commit -m "feat(gate): align ioc fok order readback"
```

### Task 4: 文档同步、change file、验证与 PR 更新

**Files:**

- Modify: `apps/vendor-gate/SESSION_NOTES.md`
- Create: `common/changes/@yuants/vendor-gate/*.json`
- Verify: `docs/superpowers/specs/2026-04-21-gate-ioc-fok-design.md`
- Verify: `docs/superpowers/plans/2026-04-21-gate-ioc-fok.md`

- [ ] **Step 1: 更新 SESSION_NOTES**

需要记录：

- 本轮新增 Gate IOC/FOK submit/readback 支持
- `MARKET` 与 `IOC` 共用 `tif=ioc`，因此回读使用 `tif + price` 判定
- 运行的验证命令和结果

- [ ] **Step 2: 暂存相关改动**

Run: `git add apps/vendor-gate/src apps/vendor-gate/SESSION_NOTES.md docs/superpowers/specs docs/superpowers/plans`
Expected: 相关文件进入 staged。

- [ ] **Step 3: 运行 `rush change` 生成 change file**

Run: `rush change`
Expected: 生成 `@yuants/vendor-gate` 的 patch change file，描述 “add IOC/FOK order type support for Gate order submission and listOrders readback mapping”。

- [ ] **Step 4: 提交 change file**

```bash
git add common/changes apps/vendor-gate/SESSION_NOTES.md
git commit -m "chore: add vendor-gate change file for ioc fok"
```

- [ ] **Step 5: 运行最终验证**

Run: `rush build -t @yuants/vendor-gate`
Expected: 若再次被 `@yuants/http-services` 阻塞，明确记录为仓库基线问题；同时补跑与本次改动直接相关的包内测试命令并记录通过结果。

- [ ] **Step 6: 推送分支并更新 PR**

```bash
git push
```

在 PR 中补充：

```md
- `./node_modules/.bin/heft test --clean`（apps/vendor-gate） ✅
- `rush build -t @yuants/vendor-gate` ⚠️ blocked by pre-existing `@yuants/http-services` integration test failure
```
