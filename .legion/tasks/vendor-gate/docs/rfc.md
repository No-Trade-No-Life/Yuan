# RFC: vendor-gate 理财账户实现

## 概述

### 背景

用户需要在 vendor-gate 中访问和管理理财账户余额，与 vendor-okx 保持一致的架构设计，便于跨交易所统一账户管理。目前 vendor-gate 已支持统一账户、现货账户、期货账户等服务，但缺少理财账户。Gate.io 提供了理财 API（用户币种理财列表），需要集成到 Yuan 系统中。

### 目标

1. 为 vendor-gate 实现理财账户信息服务，从 Gate.io 理财 API 获取用户币种理财列表。
2. 参考 vendor-okx 的 earning 账户实现模式，保持接口一致性。
3. 集成到现有的凭证化账户服务系统中，支持多账户切换。

### 非目标

1. 不实现理财产品的申购、赎回等交易操作。
2. 不涉及理财产品的收益计算或历史记录查询。
3. 不改变现有的账户 ID 格式或凭证认证流程。

## 方案设计

### 总体架构

理财账户服务将作为 vendor-gate 账户信息服务的一部分，通过 `provideAccountActionsWithCredential` 注册，根据 `account_id` 路由到对应的 `getEarningAccountInfo` 函数。该函数调用 Gate.io 理财 API，将响应映射为标准化的 `IPosition` 列表。

> [REVIEW] 不对，这个设计有问题，不要 provideAccountActionsWithCredential，直接在 exchange.ts 里注册就行，删掉 account-actions-with-credential.ts
>
> [RESPONSE] 已根据 review 调整实现：删除了 account-actions-with-credential.ts 文件，在 exchange.ts 中添加了 getAllPositions 函数，合并统一账户和理财账户持仓。getPositions 和 getPositionsByProductId 现在都调用 getAllPositions 返回所有账户类型的持仓。
> [STATUS:resolved]

### 核心流程

1. **服务注册**：在 `account-actions-with-credential.ts` 中增加 `earning` 账户类型的处理逻辑。
2. **账户信息获取**：实现 `getEarningAccountInfo` 函数，调用 `getEarnBalance`（待实现）API。
3. **数据映射**：将 API 返回的理财余额列表转换为 `IPosition` 数组，遵循 `@yuants/data-account` 规范。
4. **错误处理**：API 调用失败时抛出标准错误，确保上层能够正确处理。

### 接口定义

#### Gate.io 理财 API

根据 `api-doc.md` 文档，相关接口为“查询用户币种理财列表”（GET `/earn/uni/lends`）：

- **端点**：`GET /api/v4/earn/uni/lends`（需要鉴权）
- **参数**：`currency`（可选，币种过滤）、`page`（可选，页码）、`limit`（可选，每页数量，默认 100）
- **响应**：返回数组，每项包含字段：
  - `currency` (币种)
  - `amount` (理财总数量)
  - `lent_amount` (已借出数量)
  - `frozen_amount` (已申请赎回未到账数量)
  - `current_amount` (本次理财数量)
  - 其他字段：`min_rate`, `interest_status`, `reinvest_left_amount`, `create_time`, `update_time`

> [REVIEW] 这部分内容之前没有具体的 API 文档，现在请参考 ./api-doc.md 补充完整
> [RESPONSE] 已根据 api-doc.md 更新 API 定义，确认端点为 GET `/earn/uni/lends`，并列出关键字段。
> [STATUS:resolved]

#### 新增 private-api 函数

```typescript
export const getEarnBalance = (
  credential: ICredential,
  params?: { currency?: string; page?: number; limit?: number },
): Promise<
  Array<{
    currency: string;
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

> [REVIEW] 对齐一下术语，理财余额都应该统一使用 Earn 而不是 Finance
> [RESPONSE] 同意，将函数名从 `getFinanceBalance` 改为 `getEarnBalance`，以与 API 端点 `/earn/uni/lends` 保持一致，并更新相关注释和引用。
> [STATUS:resolved]

#### 理财账户信息服务

```typescript
import { IActionHandlerOfGetAccountInfo, makeSpotPosition } from '@yuants/data-account';
import { getEarnBalance } from '../api/private-api';

export const getEarningAccountInfo: IActionHandlerOfGetAccountInfo<ICredential> = async (credential) => {
  const balances = await getEarnBalance(credential, {});
  return balances
    .map((balance) => {
      // 过滤零余额条目
      if (+balance.amount <= 0) return null;

      // 计算可用余额：理财总数量减去已申请赎回未到账的冻结部分
      const frozen = +balance.frozen_amount || 0;
      const freeVolume = +balance.amount - frozen;

      return makeSpotPosition({
        position_id: `earning/${balance.currency}`,
        datasource_id: 'GATE',
        product_id: `earning/${balance.currency}`, // 或使用 encodePath('GATE', 'EARNING', balance.currency)
        volume: +balance.amount,
        free_volume: freeVolume,
        closable_price: 1, // 需要获取对应币种对 USDT 的现货价格，可复用现有 spot price 获取逻辑
      });
    })
    .filter(Boolean);
};
```

#### 账户服务注册更新

在 `account-actions-with-credential.ts` 中增加 `earning` 账户类型的路由：

```typescript
import { getEarningAccountInfo } from './accounts/earning';

// 在 getAccountInfo 函数中增加 case
switch (account_id) {
  case accountIds.earning:
    return getEarningAccountInfo(credential, account_id);
}
```

### 数据映射规则

- `position_id`: `earning/${currency}`
- `datasource_id`: `'GATE'`
- `product_id`: `earning/${currency}`（或使用 `encodePath('GATE', 'EARNING', currency)`）
- `volume`: 理财总数量（amount 字段）
- `free_volume`: 可用余额（总额减去已申请赎回未到账的冻结部分，即 amount - frozen_amount）
- `closable_price`: 该币种对 USDT 的现货价格，可从现有 spot ticker 获取

### 错误处理

- API 调用失败：抛出 `Error`，包含原始错误信息。
- 余额为 0：过滤掉该条目，不返回 position。
- 价格获取失败：可考虑使用 `1` 作为默认价格，并记录警告日志。

## 调研项目

### 待确认事项

1. **认证方式**：是否与现有 private API 使用相同的签名机制（根据文档需要鉴权，应与其他私有接口一致）。
2. **账户 ID 生成规则**：`accountIds.earning` 的生成方式，需要与现有账户 ID 格式保持一致。
3. **现货价格获取**：确定获取币种对 USDT 现货价格的函数，可复用现有 spot price 逻辑。

### 验证步骤

1. 使用 curl 调用 Gate.io 理财 API，验证端点可访问性和响应格式。
2. 在现有 vendor-gate 项目中添加临时测试代码，确保数据映射正确。
3. 运行 TypeScript 类型检查，确保无编译错误。

## 备选方案

### 方案 A：复用统一账户接口

如果 Gate.io 的理财余额已包含在统一账户接口的响应中，则无需单独调用理财 API，可直接从现有数据中提取。需要验证 `getUnifiedAccounts` 返回的余额是否包含理财部分。

### 方案 B：独立理财服务

若理财 API 返回的信息更详细（如预期收益、产品类型等），则独立实现理财账户服务更合适。本 RFC 采用此方案。

## 依赖与影响

### 依赖

- `@yuants/data-account`：提供 `IActionHandlerOfGetAccountInfo` 和 `makeSpotPosition`。
- `@yuants/utils`：可能使用 `encodePath` 进行 product_id 编码。
- 现有的 spot price 获取逻辑，用于计算 `closable_price`。

### 影响

- 新增文件：`apps/vendor-gate/src/services/accounts/earning.ts`
- 修改文件：`apps/vendor-gate/src/api/private-api.ts`、`apps/vendor-gate/src/services/account-actions-with-credential.ts`
- 无破坏性变更，不影响现有功能。

## 时间估算

- 调研与 API 确认：0.5 天
- 实现与集成：1 天
- 验证与测试：0.5 天
- 总计：2 天

## 决策记录

- 选择方案 B（独立理财服务），因为理财余额可能独立于统一账户，且需要单独的价格映射逻辑。
- 采用与 vendor-okx 一致的接口设计，保持跨交易所一致性。

## 下一步

1. 等待设计审批通过后开始实现。
2. 实现 private-api 函数 `getEarnBalance`。
3. 实现 `getEarningAccountInfo` 服务函数。
4. 在 account-actions-with-credential.ts 中注册理财账户服务。
