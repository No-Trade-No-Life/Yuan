# BINANCE IOC/FOK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `@yuants/vendor-binance` 增加 `IOrder.order_type = 'IOC' | 'FOK'` 的 `SPOT + USDT-FUTURE` 下单支持，并让订单回读根据 Binance `type + timeInForce` 一致映射回 `IOC | FOK | MAKER | LIMIT | MARKET`。

**Architecture:** 保持改动集中在 `apps/vendor-binance/src/services/orders/`。用一个共享的 `timeInForce` 映射函数驱动下单参数构造，再用一个共享的回读映射函数处理 `listOrders`，避免在 `submitOrder.ts` 和 `listOrders.ts` 里各自散落条件分支。`modifyOrder.ts` 保持不动。

**Tech Stack:** TypeScript, Heft/Jest, Rush, `@yuants/data-order`, `@yuants/utils`

---

## File Structure

- Modify: `apps/vendor-binance/src/services/orders/order-utils.ts`
  - 扩展 `mapOrderTypeToOrdType`
  - 新增 `mapOrderTypeToTimeInForce`
  - 扩展 `mapBinanceOrderTypeToYuants(binanceType, timeInForce)`
- Modify: `apps/vendor-binance/src/services/orders/submitOrder.ts`
  - `SPOT + USDT-FUTURE` 下单统一使用共享 `timeInForce` 映射
- Modify: `apps/vendor-binance/src/services/orders/listOrders.ts`
  - 回读时传入 `order.timeInForce`
- Create: `apps/vendor-binance/src/services/orders/order-type-mapping.test.ts`
  - 覆盖纯映射、submitOrder 参数构造、listOrders 回读
- Modify: `apps/vendor-binance/SESSION_NOTES.md`
  - 记录本轮决策、验证结果、后续事项
- Modify: `docs/zh-Hans/vendor-supporting.md`
  - 更新 Binance 下单能力说明
- Create: `common/changes/@yuants/vendor-binance/<generated>.json`
  - `rush change` 生成 patch change file

### Task 1: 补失败测试与共享映射函数

**Files:**

- Create: `apps/vendor-binance/src/services/orders/order-type-mapping.test.ts`
- Modify: `apps/vendor-binance/src/services/orders/order-utils.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { mapBinanceOrderTypeToYuants, mapOrderTypeToOrdType, mapOrderTypeToTimeInForce } from './order-utils';

describe('Binance order type mappings', () => {
  test('maps IOC and FOK order types to Binance LIMIT orders', () => {
    expect(mapOrderTypeToOrdType('IOC')).toBe('LIMIT');
    expect(mapOrderTypeToOrdType('FOK')).toBe('LIMIT');
  });

  test('maps Yuan order types to Binance timeInForce values', () => {
    expect(mapOrderTypeToTimeInForce('LIMIT')).toBe('GTC');
    expect(mapOrderTypeToTimeInForce('MAKER')).toBe('GTX');
    expect(mapOrderTypeToTimeInForce('IOC')).toBe('IOC');
    expect(mapOrderTypeToTimeInForce('FOK')).toBe('FOK');
    expect(mapOrderTypeToTimeInForce('MARKET')).toBeUndefined();
  });

  test('maps Binance type and timeInForce back to Yuan order types', () => {
    expect(mapBinanceOrderTypeToYuants('MARKET')).toBe('MARKET');
    expect(mapBinanceOrderTypeToYuants('LIMIT', 'GTC')).toBe('LIMIT');
    expect(mapBinanceOrderTypeToYuants('LIMIT', 'GTX')).toBe('MAKER');
    expect(mapBinanceOrderTypeToYuants('LIMIT', 'IOC')).toBe('IOC');
    expect(mapBinanceOrderTypeToYuants('LIMIT', 'FOK')).toBe('FOK');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --config apps/vendor-binance/config/jest.config.json --runInBand apps/vendor-binance/src/services/orders/order-type-mapping.test.ts`
Expected: FAIL because `mapOrderTypeToOrdType('IOC'|'FOK')` throws and `mapOrderTypeToTimeInForce` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export const mapOrderTypeToOrdType = (order_type?: IOrder['order_type']) => {
  switch (order_type) {
    case 'LIMIT':
    case 'MAKER':
    case 'IOC':
    case 'FOK':
      return 'LIMIT';
    case 'MARKET':
      return 'MARKET';
    default:
      throw new Error(`Unsupported order_type: ${order_type}`);
  }
};

export const mapOrderTypeToTimeInForce = (order_type?: IOrder['order_type']) => {
  switch (order_type) {
    case 'LIMIT':
      return 'GTC';
    case 'MAKER':
      return 'GTX';
    case 'IOC':
      return 'IOC';
    case 'FOK':
      return 'FOK';
    case 'MARKET':
      return undefined;
    default:
      throw new Error(`Unsupported order_type: ${order_type}`);
  }
};

export const mapBinanceOrderTypeToYuants = (
  binanceType?: string,
  timeInForce?: string,
): IOrder['order_type'] => {
  switch (binanceType) {
    case 'MARKET':
      return 'MARKET';
    case 'LIMIT':
      switch (timeInForce) {
        case 'GTX':
          return 'MAKER';
        case 'IOC':
          return 'IOC';
        case 'FOK':
          return 'FOK';
        default:
          return 'LIMIT';
      }
    default:
      return 'LIMIT';
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --config apps/vendor-binance/config/jest.config.json --runInBand apps/vendor-binance/src/services/orders/order-type-mapping.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/vendor-binance/src/services/orders/order-utils.ts apps/vendor-binance/src/services/orders/order-type-mapping.test.ts
git commit -m "feat(vendor-binance): add IOC FOK order type mappings"
```

### Task 2: 接入 submitOrder 的 IOC/FOK 下单参数构造

**Files:**

- Modify: `apps/vendor-binance/src/services/orders/submitOrder.ts`
- Test: `apps/vendor-binance/src/services/orders/order-type-mapping.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
jest.mock('../../api/private-api', () => ({
  postSpotOrder: jest.fn(),
  postUmOrder: jest.fn(),
}));

test.each([
  ['SPOT', 'IOC', 'IOC'],
  ['SPOT', 'FOK', 'FOK'],
  ['USDT-FUTURE', 'IOC', 'IOC'],
  ['USDT-FUTURE', 'FOK', 'FOK'],
])('submitOrder sends %s %s orders with timeInForce=%s', async (marketType, orderType, tif) => {
  // mock success response and assert request payload contains { type: 'LIMIT', timeInForce: tif }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --config apps/vendor-binance/config/jest.config.json --runInBand apps/vendor-binance/src/services/orders/order-type-mapping.test.ts`
Expected: FAIL because `submitOrder.ts` still hardcodes `LIMIT -> GTC` and `MAKER -> GTX` only.

- [ ] **Step 3: Write minimal implementation**

```ts
import { mapOrderTypeToTimeInForce } from './order-utils';

const timeInForce = mapOrderTypeToTimeInForce(order.order_type);
```

Apply this in both `submitUnifiedOrder` and `submitSpotOrder`, keeping existing `type === 'LIMIT'` price checks unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --config apps/vendor-binance/config/jest.config.json --runInBand apps/vendor-binance/src/services/orders/order-type-mapping.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/vendor-binance/src/services/orders/submitOrder.ts apps/vendor-binance/src/services/orders/order-type-mapping.test.ts
git commit -m "feat(vendor-binance): support IOC FOK order submission"
```

### Task 3: 接入 listOrders 回读映射并补文档

**Files:**

- Modify: `apps/vendor-binance/src/services/orders/listOrders.ts`
- Modify: `apps/vendor-binance/SESSION_NOTES.md`
- Modify: `docs/zh-Hans/vendor-supporting.md`
- Create: `common/changes/@yuants/vendor-binance/<generated>.json`
- Test: `apps/vendor-binance/src/services/orders/order-type-mapping.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
jest.mock('../../api/private-api', () => ({
  getSpotOpenOrders: jest.fn(),
  getUnifiedUmOpenOrders: jest.fn(),
}));

test('listOrders maps LIMIT+IOC/FOK/GTX readback values correctly', async () => {
  // mock open orders containing { type: 'LIMIT', timeInForce: 'IOC' | 'FOK' | 'GTX' }
  // assert returned order_type is IOC | FOK | MAKER
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --config apps/vendor-binance/config/jest.config.json --runInBand apps/vendor-binance/src/services/orders/order-type-mapping.test.ts`
Expected: FAIL because `listOrders.ts` only passes `order.type` into `mapBinanceOrderTypeToYuants`.

- [ ] **Step 3: Write minimal implementation**

```ts
order_type: mapBinanceOrderTypeToYuants(order.type, order.timeInForce),
```

Then update docs:

```md
- Binance 现货与统一账户下单现支持 `LIMIT / MARKET / MAKER / IOC / FOK`
```

And add a Session Notes entry summarizing files changed plus test/build results.

- [ ] **Step 4: Run full verification**

Run: `npx jest --config apps/vendor-binance/config/jest.config.json --runInBand apps/vendor-binance/src/services/orders/order-type-mapping.test.ts`
Expected: PASS

Run: `npx tsc --noEmit --project apps/vendor-binance/tsconfig.json`
Expected: PASS. If the environment still lacks a resolvable `tsc`, record that exact tooling failure in `apps/vendor-binance/SESSION_NOTES.md` and additionally run `rush build --to @yuants/vendor-binance`.

Run: `rush build --to @yuants/vendor-binance`
Expected: PASS

- [ ] **Step 5: Generate change file and commit**

```bash
git add apps/vendor-binance/src/services/orders/order-type-mapping.test.ts apps/vendor-binance/src/services/orders/listOrders.ts apps/vendor-binance/SESSION_NOTES.md docs/zh-Hans/vendor-supporting.md
rush change
git add common/changes
git commit -m "feat(vendor-binance): add IOC FOK order readback support"
```
