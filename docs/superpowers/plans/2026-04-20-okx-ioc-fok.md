# OKX IOC/FOK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `@yuants/vendor-okx` 增加 `IOrder.order_type = 'IOC' | 'FOK'` 的下单支持，并让订单回读链路把 OKX `ordType=ioc|fok` 一致映射回 `IOC|FOK`。

**Architecture:** 先把 OKX `ordType` 双向映射抽成小函数并用测试锁定语义，再把 `submitOrder`、`listOrders`、`order.ts`、`experimental/getOrders.ts` 接到该映射上。这样改动小、复用清晰，也能避免三个文件继续复制脆弱的三元表达式。

**Tech Stack:** TypeScript, Heft/Jest, Rush, API Extractor

---

### Task 1: 建立订单类型映射测试与纯函数

**Files:**

- Create: `apps/vendor-okx/src/orders/mapOrderTypeToOrdType.ts`
- Create: `apps/vendor-okx/src/orders/mapOkxOrdTypeToOrderType.ts`
- Create: `apps/vendor-okx/src/orders/order-type-mapping.test.ts`

- [ ] **Step 1: 写下单映射的失败测试**

```ts
import { mapOrderTypeToOrdType } from './mapOrderTypeToOrdType';

describe('mapOrderTypeToOrdType', () => {
  test('maps IOC and FOK to OKX ordType values', () => {
    expect(mapOrderTypeToOrdType('IOC')).toBe('ioc');
    expect(mapOrderTypeToOrdType('FOK')).toBe('fok');
  });
});
```

- [ ] **Step 2: 运行测试确认按预期失败**

Run: `npx heft test --clean --test-path-pattern order-type-mapping.test.ts`
Expected: FAIL，提示 `Cannot find module './mapOrderTypeToOrdType'` 或导出不存在。

- [ ] **Step 3: 写回读映射和未知值的失败测试**

```ts
import { mapOkxOrdTypeToOrderType } from './mapOkxOrdTypeToOrderType';

describe('mapOkxOrdTypeToOrderType', () => {
  test('maps OKX ordType values back to Yuan order types', () => {
    expect(mapOkxOrdTypeToOrderType('market')).toBe('MARKET');
    expect(mapOkxOrdTypeToOrderType('limit')).toBe('LIMIT');
    expect(mapOkxOrdTypeToOrderType('post_only')).toBe('MAKER');
    expect(mapOkxOrdTypeToOrderType('ioc')).toBe('IOC');
    expect(mapOkxOrdTypeToOrderType('fok')).toBe('FOK');
  });

  test('returns UNKNOWN for unsupported ordType', () => {
    expect(mapOkxOrdTypeToOrderType('optimal_limit_ioc')).toBe('UNKNOWN');
  });
});
```

- [ ] **Step 4: 实现最小映射函数**

```ts
export const mapOrderTypeToOrdType = (orderType?: string) => {
  switch (orderType) {
    case 'LIMIT':
      return 'limit';
    case 'MARKET':
      return 'market';
    case 'MAKER':
      return 'post_only';
    case 'IOC':
      return 'ioc';
    case 'FOK':
      return 'fok';
  }
  throw new Error(`Unknown order type: ${orderType}`);
};
```

```ts
export const mapOkxOrdTypeToOrderType = (ordType?: string) => {
  switch (ordType) {
    case 'market':
      return 'MARKET';
    case 'limit':
      return 'LIMIT';
    case 'post_only':
      return 'MAKER';
    case 'ioc':
      return 'IOC';
    case 'fok':
      return 'FOK';
    default:
      return 'UNKNOWN';
  }
};
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx heft test --clean --test-path-pattern order-type-mapping.test.ts`
Expected: PASS，2 tests passed。

- [ ] **Step 6: 提交纯映射与测试**

```bash
git add apps/vendor-okx/src/orders/mapOrderTypeToOrdType.ts apps/vendor-okx/src/orders/mapOkxOrdTypeToOrderType.ts apps/vendor-okx/src/orders/order-type-mapping.test.ts
git commit -m "test(okx): cover ioc fok order type mappings"
```

### Task 2: 接入 submitOrder 的 IOC/FOK 下单映射

**Files:**

- Modify: `apps/vendor-okx/src/orders/submitOrder.ts`
- Reuse: `apps/vendor-okx/src/orders/mapOrderTypeToOrdType.ts`
- Test: `apps/vendor-okx/src/orders/order-type-mapping.test.ts`

- [ ] **Step 1: 写一个失败测试，锁定 submitOrder 依赖共享映射函数**

```ts
import { mapOrderTypeToOrdType } from './mapOrderTypeToOrdType';

test('submit-order mapping helper accepts IOC and FOK', () => {
  expect(() => mapOrderTypeToOrdType('IOC')).not.toThrow();
  expect(() => mapOrderTypeToOrdType('FOK')).not.toThrow();
});
```

- [ ] **Step 2: 如果测试未失败，调整为先在 `submitOrder.ts` 保留旧私有函数再运行一次，确认会因未使用共享函数而失败**

Run: `npx heft test --clean --test-path-pattern order-type-mapping.test.ts`
Expected: 若上一步未产生红灯，则先补一个针对 `submitOrder.ts` 导入的新测试或快照断言，让重构有保护再继续。

- [ ] **Step 3: 让 `submitOrder.ts` 使用共享映射函数**

```ts
import { mapOrderTypeToOrdType } from './mapOrderTypeToOrdType';

// 删除 submitOrder.ts 内部重复的 mapOrderTypeToOrdType 实现
```

- [ ] **Step 4: 运行映射测试确认通过**

Run: `npx heft test --clean --test-path-pattern order-type-mapping.test.ts`
Expected: PASS。

- [ ] **Step 5: 运行包级 TypeScript/测试验证**

Run: `npx tsc --noEmit --project tsconfig.json && npx heft test --clean`
Expected: vendor-okx 本包类型检查通过，测试通过。

- [ ] **Step 6: 提交 submitOrder 接线**

```bash
git add apps/vendor-okx/src/orders/submitOrder.ts apps/vendor-okx/src/orders/mapOrderTypeToOrdType.ts apps/vendor-okx/src/orders/order-type-mapping.test.ts
git commit -m "feat(okx): support ioc fok submit order mapping"
```

### Task 3: 接入订单回读映射

**Files:**

- Modify: `apps/vendor-okx/src/orders/listOrders.ts`
- Modify: `apps/vendor-okx/src/order.ts`
- Modify: `apps/vendor-okx/src/experimental/getOrders.ts`
- Reuse: `apps/vendor-okx/src/orders/mapOkxOrdTypeToOrderType.ts`
- Test: `apps/vendor-okx/src/orders/order-type-mapping.test.ts`

- [ ] **Step 1: 写回读使用共享映射函数的失败测试**

```ts
import { mapOkxOrdTypeToOrderType } from './mapOkxOrdTypeToOrderType';

test('readback mapping recognizes post_only ioc and fok', () => {
  expect(mapOkxOrdTypeToOrderType('post_only')).toBe('MAKER');
  expect(mapOkxOrdTypeToOrderType('ioc')).toBe('IOC');
  expect(mapOkxOrdTypeToOrderType('fok')).toBe('FOK');
});
```

- [ ] **Step 2: 运行测试确认失败或至少证明旧代码仍未接线**

Run: `npx heft test --clean --test-path-pattern order-type-mapping.test.ts`
Expected: 若纯函数已通过，则再增加一个最小集成测试片段，验证实际回读文件仍需接线；不要直接跳过红灯。

- [ ] **Step 3: 在三个回读入口接入共享映射函数**

```ts
import { mapOkxOrdTypeToOrderType } from './mapOkxOrdTypeToOrderType';

const order_type = mapOkxOrdTypeToOrderType(x.ordType);
```

对 `experimental/getOrders.ts` 使用正确相对路径：

```ts
import { mapOkxOrdTypeToOrderType } from '../orders/mapOkxOrdTypeToOrderType';
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx heft test --clean --test-path-pattern order-type-mapping.test.ts`
Expected: PASS。

- [ ] **Step 5: 运行包级验证**

Run: `npx tsc --noEmit --project tsconfig.json && npx heft test --clean`
Expected: PASS。

- [ ] **Step 6: 提交回读一致性改动**

```bash
git add apps/vendor-okx/src/orders/listOrders.ts apps/vendor-okx/src/order.ts apps/vendor-okx/src/experimental/getOrders.ts apps/vendor-okx/src/orders/mapOkxOrdTypeToOrderType.ts apps/vendor-okx/src/orders/order-type-mapping.test.ts
git commit -m "feat(okx): align ioc fok order readback"
```

### Task 4: 生成 change file、验证并更新 PR

**Files:**

- Create: `common/changes/@yuants/vendor-okx/*.json`
- Verify: `docs/superpowers/specs/2026-04-20-okx-ioc-fok-design.md`
- Verify: `docs/superpowers/plans/2026-04-20-okx-ioc-fok.md`

- [ ] **Step 1: 暂存当前代码改动**

Run: `git add apps/vendor-okx/src apps/vendor-okx/config common/changes docs/superpowers/specs docs/superpowers/plans`
Expected: `git status --short` 中相关文件进入 staged。

- [ ] **Step 2: 运行 `rush change` 生成变更文件**

Run: `rush change`
Expected: 在 `common/changes/@yuants/vendor-okx/` 下生成一个 patch 级 JSON 文件，描述 “add IOC/FOK order type support for OKX order submission and readback mapping”。

- [ ] **Step 3: 提交 change file**

```bash
git add common/changes
git commit -m "chore: add vendor-okx change file for ioc fok"
```

- [ ] **Step 4: 运行最终验证**

Run: `npx tsc --noEmit --project tsconfig.json && npx heft test --clean && rush build -t @yuants/vendor-okx`
Expected: 前两项通过；若 `rush build -t @yuants/vendor-okx` 再次被 `@yuants/http-services` 的已知集成测试阻塞，则记录为仓库基线问题，不把它误判为本次回归。

- [ ] **Step 5: 推送分支并更新 PR**

```bash
git push
```

- [ ] **Step 6: 在 PR 中补充验证结果说明**

```md
- `npx tsc --noEmit --project tsconfig.json` ✅
- `npx heft test --clean` ✅
- `rush build -t @yuants/vendor-okx` ⚠️ blocked by pre-existing `@yuants/http-services` integration test failure
```
