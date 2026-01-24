# Spec: vendor-gate 理财账户实现（Test）

## 概述

本文档描述 vendor-gate 理财账户服务的测试策略、测试用例和验证步骤。

## 测试目标

确保以下功能正确：

1. Gate.io 理财 API 封装函数 `getEarnBalance` 能正确调用并解析响应。
2. `getEarningAccountInfo` 函数正确映射 API 数据到 `IPosition` 列表。
3. 账户服务注册正确，能根据 `account_id` 路由到理财账户服务。
4. 错误处理符合预期，包括 API 失败、零余额过滤、价格获取失败等场景。

## 测试范围

### 单元测试

- `getEarnBalance` 函数（需 mock HTTP 请求）
- `getEarningAccountInfo` 函数（需 mock `getEarnBalance` 和 `getSpotPrice`）
- `getSpotPrice` 辅助函数（需 mock `getSpotTickers`）

### 集成测试

- 服务注册验证：确保 `account-actions-with-credential.ts` 正确注册并响应请求。
- 端到端流程：使用测试凭证实际调用理财账户服务，验证返回数据格式。

### 手动测试

- 使用真实 Gate.io 账户（如有）验证 API 端点可用性和数据正确性。

## 测试用例

### TC1: getEarnBalance 成功响应

**前提**：Mock HTTP 请求返回模拟的理财余额数据。

**输入**：有效的 credential 对象。

**预期输出**：包含多个余额对象的数组，字段类型正确。

**验证点**：

- 函数调用不抛出异常。
- 返回数组长度与 mock 数据一致。
- 每个对象包含 `currency`、`amount` 等必需字段。

### TC2: getEarnBalance 错误响应

**前提**：Mock HTTP 请求返回错误状态码（如 401、500）。

**预期行为**：函数抛出 `Error`，包含错误信息。

**验证点**：异常类型为 `Error`，消息包含相关错误描述。

### TC3: getEarningAccountInfo 余额映射

**前提**：Mock `getEarnBalance` 返回以下数据：

```json
[
  { "currency": "USDT", "amount": "100.5", "frozen": "10" },
  { "currency": "BTC", "amount": "0.002", "frozen": "0" },
  { "currency": "ETH", "amount": "0", "frozen": "0" }
]
```

Mock `getSpotPrice` 返回：USDT=1, BTC=50000, ETH=3000。

**预期输出**：包含两个 `IPosition` 的数组（ETH 余额为 0 被过滤）。

**验证点**：

- 数组长度为 2。
- 第一个 position：`position_id` 为 `earning/USDT`，`volume=100.5`，`free_volume=90.5`，`closable_price=1`。
- 第二个 position：`position_id` 为 `earning/BTC`，`volume=0.002`，`free_volume=0.002`，`closable_price=50000`。
- `datasource_id` 为 `'GATE'`，`product_id` 符合 `encodePath('GATE', 'EARNING', currency)` 格式。

### TC4: getEarningAccountInfo 价格获取失败

**前提**：Mock `getEarnBalance` 返回 `[{ "currency": "XYZ", "amount": "10", "frozen": "0" }]`。
Mock `getSpotPrice` 抛出错误或返回 undefined。

**预期输出**：一个 `IPosition`，`closable_price` 为 1，并记录警告日志（如有）。

**验证点**：`closable_price` 等于 1，函数不抛出异常。

### TC5: 账户服务路由

**前提**：Mock `getAccountIds` 返回包含 `earning` 账户 ID 的对象。

**输入**：credential 和 `account_id` 为 `accountIds.earning`。

**预期行为**：调用 `getEarningAccountInfo` 并返回 positions。

**验证点**：返回结果与 TC3 一致。

### TC6: 不支持账户 ID

**输入**：credential 和未知的 `account_id`。

**预期行为**：抛出 `Error`，消息包含 `Unsupported account_id`。

**验证点**：异常消息包含账户 ID。

## 测试工具与框架

### 单元测试框架

- 使用 Jest（如果项目已配置）或 Mocha/Chai。
- Mock 使用 Jest 的 `jest.fn()` 或 Sinon。

### HTTP Mock

- 使用 `nock` 或 `jest.mock` 模拟 `callPrivate` 函数。

### 测试文件位置

- `apps/vendor-gate/src/services/accounts/earning.test.ts`（单元测试）
- `apps/vendor-gate/src/api/private-api.test.ts`（可选，API 测试）

## 测试数据

### Mock 响应示例

```typescript
const mockEarnBalance = [
  { currency: 'USDT', amount: '100.5', frozen: '10' },
  { currency: 'BTC', amount: '0.002', frozen: '0' },
];

const mockSpotTickers = [
  { currency_pair: 'BTC_USDT', last: '50000' },
  { currency_pair: 'ETH_USDT', last: '3000' },
];
```

### 测试凭证

```typescript
const testCredential: ICredential = {
  access_key: 'test_key',
  secret_key: 'test_secret',
};
```

## 测试执行步骤

### 1. 单元测试执行

```bash
cd apps/vendor-gate
npm test -- src/services/accounts/earning.test.ts
```

或使用项目配置的测试命令（如 `pnpm test`）。

### 2. 集成测试执行

编写一个简单的脚本，启动 Terminal 并调用 `AccountActions` 服务：

```typescript
// test-integration.ts
import { Terminal } from '@yuants/protocol';
import { getEarningAccountInfo } from './src/services/accounts/earning';

const terminal = Terminal.fromNodeEnv();
// 调用服务并验证结果
```

### 3. 手动验证

使用 curl 或 Postman 调用 Gate.io 理财 API，确认端点、参数和响应格式：

```bash
curl -H "KEY: ..." -H "SECRET: ..." "https://api.gateio.ws/api/v4/account/finance/balance"
```

## 测试覆盖率目标

- 函数覆盖率：100%（`getEarnBalance`、`getEarningAccountInfo`、`getSpotPrice`）
- 分支覆盖率：80% 以上（覆盖错误路径、零余额过滤、价格获取失败等）
- 行覆盖率：90% 以上

## 通过标准

1. 所有单元测试通过（无失败用例）。
2. 集成测试能成功调用服务并返回有效数据。
3. 类型检查通过：`tsc --noEmit` 无错误。
4. 手动验证确认 API 端点可用且数据格式与预期一致。

## 测试风险与缓解

| 风险                  | 缓解措施                                                       |
| --------------------- | -------------------------------------------------------------- |
| 真实 API 不可用或变更 | 使用 mock 数据进行单元测试；定期更新 mock 数据以匹配实际 API。 |
| 测试凭证泄露          | 使用环境变量存储测试凭证，不在代码库中硬编码。                 |
| 测试环境网络问题      | 集成测试增加超时和重试逻辑；允许跳过需要真实网络调用的测试。   |
| 价格获取依赖现货行情  | Mock 价格获取函数，确保测试不依赖外部行情服务。                |

## 附录

### 测试文件模板

```typescript
// apps/vendor-gate/src/services/accounts/earning.test.ts
import { getEarningAccountInfo } from './earning';
import { getEarnBalance } from '../../api/private-api';
import { getSpotPrice } from '../../api/public-api';

jest.mock('../../api/private-api');
jest.mock('../../api/public-api');

const mockGetEarnBalance = getEarnBalance as jest.MockedFunction<typeof getEarnBalance>;
const mockGetSpotPrice = getSpotPrice as jest.MockedFunction<typeof getSpotPrice>;

describe('getEarningAccountInfo', () => {
  const credential = { access_key: 'test', secret_key: 'test' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('TC3: 余额映射', async () => {
    mockGetEarnBalance.mockResolvedValue([
      { currency: 'USDT', amount: '100.5', frozen: '10' },
      { currency: 'BTC', amount: '0.002', frozen: '0' },
      { currency: 'ETH', amount: '0', frozen: '0' },
    ]);
    mockGetSpotPrice.mockImplementation(async (currency) => {
      if (currency === 'USDT') return 1;
      if (currency === 'BTC') return 50000;
      return 1;
    });

    const positions = await getEarningAccountInfo(credential);
    expect(positions).toHaveLength(2);
    // 进一步验证 position 字段...
  });
});
```
