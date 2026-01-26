# RFC: vendor-gate 理财账户实现

## 概述

### 背景

用户需要在 vendor-gate 中访问和管理理财账户余额，与 vendor-okx 保持一致的架构设计，便于跨交易所统一账户管理。目前 vendor-gate 已支持统一账户、现货账户、期货账户等服务，但缺少理财账户。Gate.io 提供了理财 API（用户币种理财列表），需要集成到 Yuan 系统中。

### 目标

1. 为 vendor-gate 实现理财账户信息服务，从 Gate.io 理财 API 获取用户币种理财列表。
2. 参考 vendor-okx 的 earning 账户实现模式，保持接口一致性。
3. 集成到现有的账户持仓服务中，支持统一账户与理财账户的持仓合并。

### 非目标

1. 不实现理财产品的申购、赎回等交易操作。
2. 不涉及理财产品的收益计算或历史记录查询。
3. 不改变现有的账户 ID 格式或凭证认证流程。

## 方案设计

### 总体架构

理财账户服务将作为 vendor-gate 账户信息服务的一部分，集成到现有的 `exchange.ts` 文件中。通过新增的 `getAllPositions` 函数，合并统一账户和理财账户的持仓信息。`getPositions` 和 `getPositionsByProductId` 函数将调用 `getAllPositions` 返回所有账户类型的持仓，确保接口一致性和数据完整性。

### 核心流程

1. **数据获取**：实现 `getEarningAccountInfo` 函数，调用 `getEarnBalance` API 获取理财余额。
2. **数据映射**：将 API 返回的理财余额列表转换为 `IPosition` 数组，遵循 `@yuants/data-account` 规范。
3. **持仓合并**：在 `exchange.ts` 中实现 `getAllPositions` 函数，并行获取统一账户和理财账户持仓，合并返回。
4. **错误处理**：API 调用失败时抛出标准错误，确保上层能够正确处理。添加安全控制，包括日志脱敏、请求超时和并发限制。

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

#### 理财账户信息服务

```typescript
import { IActionHandlerOfGetAccountInfo, makeSpotPosition, type IPosition } from '@yuants/data-account';
import { encodePath } from '@yuants/utils';
import { getEarnBalance, ICredential } from '../api/private-api';
import { getSpotPrice } from '../api/public-api';

/**
 * 获取理财账户信息
 */
export const getEarningAccountInfo: IActionHandlerOfGetAccountInfo<ICredential> = async (credential) => {
  const balances = await getEarnBalance(credential, {});

  const positions = await Promise.all(
    balances.map(async (balance) => {
      // 过滤零余额条目
      if (+balance.amount <= 0) return undefined;

      // 计算可用余额：理财总数量减去已申请赎回未到账的冻结部分
      const frozen = +balance.frozen_amount || 0;
      const freeVolume = Math.max(0, +balance.amount - frozen);

      // 获取币种对 USDT 的现货价格（通过并发限制的 getSpotPrice 函数）
      const closablePrice = await getSpotPrice(balance.currency);

      return makeSpotPosition({
        position_id: `earning/${balance.currency}`,
        datasource_id: 'GATE',
        product_id: encodePath('GATE', 'EARNING', balance.currency),
        volume: +balance.amount,
        free_volume: freeVolume,
        closable_price: closablePrice,
      });
    }),
  );

  // 过滤 undefined 条目
  return positions.filter((pos): pos is IPosition => !!pos);
};
```

#### 持仓合并实现

在 `exchange.ts` 中新增 `getAllPositions` 函数，统一获取并合并所有账户类型的持仓：

```typescript
import { getEarningAccountInfo } from './accounts/earning';
import { getUnifiedAccountInfo } from './accounts/unified';

const getAllPositions = async (credential: ICredential): Promise<IPosition[]> => {
  const [unifiedPositions, earningPositions] = await Promise.all([
    getUnifiedAccountInfo(credential),
    getEarningAccountInfo(credential),
  ]);
  return [...unifiedPositions, ...earningPositions];
};
```

### 数据映射规则

- `position_id`: `earning/${currency}`
- `datasource_id`: `'GATE'`
- `product_id`: `encodePath('GATE', 'EARNING', currency)`（使用标准路径编码）
- `volume`: 理财总数量（amount 字段）
- `free_volume`: 可用余额（总额减去已申请赎回未到账的冻结部分，即 `Math.max(0, amount - frozen_amount)`）
- `closable_price`: 该币种对 USDT 的现货价格，通过并发限制的 `getSpotPrice` 函数获取

### 错误处理

- API 调用失败：抛出 `Error`，包含原始错误信息（脱敏后）。
- 余额为 0：过滤掉该条目，不返回 position。
- 价格获取失败：可考虑使用 `1` 作为默认价格，并记录警告日志。

### 安全控制

- **日志脱敏**：所有 API 请求日志中，`KEY` 和 `SIGN` 头部均被过滤为 `***`，防止敏感信息泄露。
- **请求超时**：使用 `AbortController` 设置 30 秒超时，避免长时间挂起的请求。
- **并发限制**：对 `getSpotPrice` 等高频接口实施并发限制（最大 5 个并发请求），防止 API 滥用。
- **输入验证**：在 `getEarnBalance` 函数中对参数进行类型和范围校验。
- **错误日志脱敏**：非 DEBUG 模式下，错误日志只打印响应摘要（前 100 字符），避免泄露完整响应内容。

## 调研项目

### 已确认事项

1. **认证方式**：与现有 private API 使用相同的签名机制，通过 `callPrivate` 函数处理鉴权。
2. **账户 ID 生成规则**：采用 `GATE/{user_id}/EARNING` 格式，与现有账户 ID 模式保持一致。
3. **现货价格获取**：复用现有的 spot price 获取逻辑，通过 `getSpotPrice` 函数获取币种对 USDT 价格。

### 验证结果

1. ✅ 通过 curl 调用验证 Gate.io 理财 API 端点可访问，响应格式符合预期。
2. ✅ 在 vendor-gate 项目中实现完整功能，数据映射正确，持仓合并逻辑正常。
3. ✅ TypeScript 类型检查通过，无编译错误，构建验证成功。

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
- 修改文件：`apps/vendor-gate/src/api/private-api.ts`、`apps/vendor-gate/src/services/exchange.ts`
- 删除文件：`apps/vendor-gate/src/services/account-actions-with-credential.ts`
- 无破坏性变更，不影响现有功能。

## 时间估算

- 调研与 API 确认：0.5 天
- 实现与集成：1 天
- 验证与测试：0.5 天
- 总计：2 天

## 决策记录

- 选择方案 B（独立理财服务），因为理财余额可能独立于统一账户，且需要单独的价格映射逻辑。
- 采用与 vendor-okx 一致的接口设计，保持跨交易所一致性。

## 实施总结

1. ✅ 已实现 private-api 函数 `getEarnBalance`。
2. ✅ 已实现 `getEarningAccountInfo` 服务函数。
3. ✅ 已在 `exchange.ts` 中集成理财账户持仓，新增 `getAllPositions` 函数。
4. ✅ 已完成安全加固：日志脱敏、请求超时、并发限制、输入验证。
5. ✅ 已通过 TypeScript 类型检查和构建验证。
