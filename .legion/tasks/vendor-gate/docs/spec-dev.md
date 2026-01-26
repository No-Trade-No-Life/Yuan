# Spec: vendor-gate 理财账户实现（Dev）

## 概述

本文档描述 vendor-gate 理财账户服务的具体实现细节，包括文件结构、函数签名、类型定义和集成步骤。

## 文件变更清单

### 1. 新增文件

- `apps/vendor-gate/src/services/accounts/earning.ts`：理财账户信息服务实现。
- `apps/vendor-gate/src/services/accounts/earning.test.ts`：单元测试（可选）。

### 2. 修改文件

- `apps/vendor-gate/src/api/private-api.ts`：新增 `getEarnBalance` 函数。
- `apps/vendor-gate/src/services/account-actions-with-credential.ts`：注册理财账户服务。
- `apps/vendor-gate/src/index.ts`：导出新服务（如需）。

## 详细实现

### 2.1 Gate.io 理财 API 封装

#### 函数签名

```typescript
// apps/vendor-gate/src/api/private-api.ts
/**
 * 获取用户理财余额（Gate.io EarnUni 余币宝理财）
 *
 * 参考文档：https://www.gate.com/docs/developers/apiv4/zh_CN/#查询用户币种理财列表
 * 端点：GET /earn/uni/lends（需要鉴权）
 */
export const getEarnBalance = (
  credential: ICredential,
  params?: { currency?: string; page?: number; limit?: number },
): Promise<
  Array<{
    currency: string; // 币种
    amount: string; // 理财总数量
    lent_amount: string; // 已借出数量
    frozen_amount: string; // 已申请赎回未到账数量
    current_amount: string; // 本次理财数量
    min_rate?: string; // 最小利率
    interest_status?: string; // 利息状态：派息/复投
    reinvest_left_amount?: string; // 未复投金额
    create_time?: number; // 创建时间戳
    update_time?: number; // 最新修改时间戳
  }>
> => callPrivate(credential, 'GET', '/earn/uni/lends', params);
```

#### 实现要点

- 端点路径：`/earn/uni/lends`（根据 api-doc.md 确认）。
- 参数：`currency` 可选，用于过滤特定币种；`page`、`limit` 支持分页。
- 响应：数组格式，每个元素包含完整理财信息字段。
- 错误处理：调用 `callPrivate` 会自动处理签名和错误抛出。

### 2.2 理财账户信息服务实现

#### 函数签名

```typescript
// apps/vendor-gate/src/services/accounts/earning.ts
import { IActionHandlerOfGetAccountInfo, makeSpotPosition } from '@yuants/data-account';
import { encodePath } from '@yuants/utils';
import { getEarnBalance } from '../../api/private-api';
import { getSpotPrice } from '../../api/public-api'; // 假设存在获取现货价格的函数

export const getEarningAccountInfo: IActionHandlerOfGetAccountInfo<ICredential> = async (credential) => {
  const balances = await getEarnBalance(credential, {});

  const positions = await Promise.all(
    balances.map(async (balance) => {
      // 过滤零余额
      if (+balance.amount <= 0) return undefined;

      // 获取币种对 USDT 的现货价格
      const closable_price = await getSpotPrice(balance.currency); // 需要实现或复用现有逻辑

      return makeSpotPosition({
        position_id: `earning/${balance.currency}`,
        datasource_id: 'GATE',
        product_id: encodePath('GATE', 'EARNING', balance.currency),
        volume: +balance.amount,
        free_volume: +balance.amount - (+balance.frozen || 0),
        closable_price,
      });
    }),
  );

  return positions.filter((pos): pos is IPosition => !!pos);
};
```

#### 依赖说明

- `getSpotPrice`：需要实现或复用现有现货价格获取逻辑。可参考 `apps/vendor-gate/src/api/public-api.ts` 中的 `getSpotTickers` 函数。
- 如果价格获取失败，可降级为 `closable_price: 1` 并记录警告。

### 2.3 账户服务注册更新

#### 修改 account-actions-with-credential.ts

```typescript
// apps/vendor-gate/src/services/account-actions-with-credential.ts
import { provideAccountActionsWithCredential } from '@yuants/data-account';
import { Terminal } from '@yuants/protocol';
import { getEarningAccountInfo } from './accounts/earning';
import { getAccountIds } from './accounts/profile'; // 假设存在 getAccountIds 函数

provideAccountActionsWithCredential<ICredential>(
  Terminal.fromNodeEnv(),
  'GATE',
  {
    type: 'object',
    required: ['access_key', 'secret_key'],
    properties: {
      access_key: { type: 'string' },
      secret_key: { type: 'string' },
    },
  },
  {
    listAccounts: async (credential) => {
      const accountIds = await getAccountIds(credential);
      return Object.values(accountIds).map((account_id) => ({ account_id }));
    },
    getAccountInfo: async (credential, account_id) => {
      const accountIds = await getAccountIds(credential);
      if (!accountIds) throw new Error('Failed to get account IDs');

      switch (account_id) {
        case accountIds.trading:
          return getTradingAccountInfo(credential, account_id);
        case accountIds.funding:
          return getFundingAccountInfo(credential, account_id);
        case accountIds.earning:
          return getEarningAccountInfo(credential, account_id);
        // 其他账户类型...
      }
      throw new Error(`Unsupported account_id: ${account_id}`);
    },
  },
);
```

#### 关键点

- `getAccountIds` 需要返回 `earning` 账户 ID，格式可能与 `gate/<uid>/earning` 一致。
- 如果 `account-actions-with-credential.ts` 文件不存在，需要先创建（参考 vendor-okx 的实现）。

### 2.4 现货价格获取辅助函数

需要在 `public-api.ts` 或新的工具函数中实现 `getSpotPrice`：

```typescript
// apps/vendor-gate/src/api/public-api.ts 或新文件
import { getSpotTickers } from './public-api';

export const getSpotPrice = async (currency: string): Promise<number> => {
  const tickers = await getSpotTickers({});
  const ticker = tickers.find((t) => t.currency_pair === `${currency}_USDT`);
  if (!ticker) {
    console.warn(`No spot ticker found for ${currency}_USDT, using 1 as default`);
    return 1;
  }
  return Number(ticker.last);
};
```

## 类型定义扩展

### ICredential

已存在，无需修改。

### 理财余额类型

在 `private-api.ts` 中定义：

```typescript
export type EarnBalance = {
  currency: string;
  amount: string;
  frozen?: string;
  // 其他字段根据 API 响应补充
};
```

## 集成验证步骤

1. **编译检查**：运行 `npx tsc --noEmit --project apps/vendor-gate/tsconfig.json` 确保无类型错误。
2. **服务注册验证**：启动 vendor-gate 服务，检查 Terminal 是否注册了 `AccountActions` 服务。
3. **API 调用验证**：使用测试凭证调用 `getEarnBalance`，确保返回数据格式正确。
4. **数据映射验证**：调用 `getEarningAccountInfo`，验证返回的 `IPosition` 列表符合预期。

## 注意事项

1. **API 限速**：理财 API 可能受频率限制，需确保不超过限制。
2. **错误处理**：API 调用失败时应抛出清晰错误，避免吞掉异常。
3. **日志记录**：在关键步骤添加日志，便于调试。
4. **缓存考虑**：理财余额变化较慢，可考虑添加缓存（如 5 分钟），但本次实现暂不包含。

## 后续优化点

1. **价格缓存**：现货价格可缓存，避免每次调用都请求 ticker。
2. **零余额过滤**：在 API 层或映射层过滤零余额，减少数据传输。
3. **分页支持**：如果理财 API 支持分页，需实现分页逻辑。

## 相关文档

- [RFC](./rfc.md)：方案设计与决策记录。
- [Spec-Test](./spec-test.md)：测试策略与用例。
- [Spec-Bench](./spec-bench.md)：性能基准要求。
- [Spec-Obs](./spec-obs.md)：可观测性需求。
