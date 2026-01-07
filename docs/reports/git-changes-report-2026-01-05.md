# Git 变更报告（b47dff553..9b6f0cec2）

## 1. 概览

- **时间范围**：2026-01-05 至 2026-01-04
- **提交数量**：4 个提交
- **主要贡献者**：humblelittlec1[bot] (3), Ryan (1)
- **热点目录**：apps (36 files), common (14 files), libraries (10 files)
- **生成时间**：2026-01-05T00:06:48.892Z

## 2. 核心变更

> ⚠️ **全覆盖要求**：此章节必须涵盖所有提交，不能遗漏任何一个 commit。

### 2.1 Binance 账户损益资金流水功能

**相关提交**：`20f2f20fd`
**作者**：Ryan

**设计意图**：
为 Binance 期货交易添加账户损益资金流水（interest ledger）功能，实现完整的资金费流水记录和查询能力。该功能旨在解决用户在 Binance 期货交易中无法系统化追踪资金费、利息等损益记录的问题。通过集成 Binance API 的 `getAccountIncome` 接口，自动获取用户的损益流水数据，并存储到 SQL 数据库中，为后续的资金费分析、报表生成和税务计算提供数据基础。同时，通过统一的 `IInterestLedger` 接口标准化资金费流水数据结构，确保与其他交易所的数据格式兼容。

**核心代码**：
[private-api.ts:L233-L243](apps/vendor-binance/src/api/private-api.ts#L233-L243)

```typescript
export interface IAccountIncomeRecord {
  symbol: string;
  incomeType: string;
  income: string;
  asset: string;
  info: string;
  time: number;
  tranId: string;
  tradeId: string;
}
```

[private-api.ts:L769-L792](apps/vendor-binance/src/api/private-api.ts#L769-L792)

```typescript
export const getAccountIncome = (
  credential: ICredential,
  params?: {
    symbol?: string;
    incomeType?: string;
    startTime?: number;
    endTime?: number;
    page?: number;
    recvWindow?: number;
    limit?: number;
    timestamp?: number;
  },
): Promise<IAccountIncomeRecord[]> => {
  const endpoint = 'https://fapi.binance.com/fapi/v1/income';
  const url = new URL(endpoint);
  const weight = 30;
  scopeError(
    'BINANCE_API_RATE_LIMIT',
    { method: 'GET', endpoint, host: url.host, path: url.pathname, bucketId: url.host, weight },
    () => tokenBucket(url.host).acquireSync(weight),
  );
  return requestPrivate<IAccountIncomeRecord[]>(credential, 'GET', endpoint, params);
};
```

**影响范围**：

- 影响模块：`vendor-binance`、`data-interest-rate`、`exchange`、`tool-sql-migration`
- 需要关注：新增的 `getAccountIncome` API 调用权重为 30，需要注意 Binance API 的限速策略
- 数据库变更：新增 `account_interest_ledger` 表及相关索引，需要执行 SQL 迁移脚本

**提交明细**：

- `20f2f20fd`: 添加 Binance 账户损益资金流水功能，包括 API 接口、服务层、数据模型和 SQL 迁移脚本

### 2.2 版本更新与依赖管理

**相关提交**：`1bf339a16`
**作者**：humblelittlec1[bot]

**设计意图**：
统一更新多个 vendor 项目的版本号和相关依赖，确保所有项目使用最新版本的 `@yuants/data-interest-rate` (0.2.7) 和 `@yuants/exchange` (0.8.10) 库。这是标准的版本发布流程，确保新添加的 `IInterestLedger` 接口和相关服务能够在所有 vendor 项目中正确使用。版本更新包括 CHANGELOG 文件的自动生成和 package.json 版本号的递增，保持项目依赖的一致性和可追溯性。

**核心代码**：
[CHANGELOG.md:L3-L8](apps/vendor-binance/CHANGELOG.md#L3-L8)

```markdown
## 0.12.11
Sun, 04 Jan 2026 18:08:06 GMT

### Patches

- add ledger
```

**影响范围**：

- 影响模块：`vendor-aster`、`vendor-binance`、`vendor-bitget`、`vendor-coinex`、`vendor-gate`、`vendor-huobi`、`vendor-hyperliquid`、`vendor-okx`、`vendor-trading-view`、`vendor-turboflow`、`virtual-exchange`
- 需要关注：所有依赖 `@yuants/data-interest-rate` 和 `@yuants/exchange` 的项目都已更新到最新版本

**提交明细**：

- `1bf339a16`: 更新多个 vendor 项目的版本号和依赖，同步 CHANGELOG 文件

### 2.3 每日 Git 变更报告生成

**相关提交**：`0876136e7`, `9b6f0cec2`
**作者**：humblelittlec1[bot]

**设计意图**：
自动化生成每日 Git 变更报告，为团队提供代码变更的可视化概览。这些报告基于 `git-changes-reporter` 工具生成，包含提交统计、贡献者分析、热点目录和技术影响评估。通过定期生成这些报告，团队可以更好地跟踪项目进展、识别代码热点区域，并为代码审查和发布说明提供数据支持。这是持续集成流程的一部分，确保变更记录的完整性和可追溯性。

**核心代码**：
[git-changes-2026-01-05.json:L1-L10](/home/runner/work/Yuan/Yuan/docs/reports/git-changes-2026-01-05.json#L1-L10)

```json
{
  "range": {
    "old": "b47dff5533c5ef8806fd4444f8b3045067902d1f",
    "new": "9b6f0cec20a135c643e7d253cdc95a27f04aa5f2",
    "label": "b47dff553..9b6f0cec2",
    "startDate": "2026-01-05",
    "endDate": "2026-01-04",
    "commitCount": 4,
    "generatedAt": "2026-01-05T00:06:48.892Z"
  },
```

**影响范围**：

- 影响模块：`docs/reports/` 目录下的报告文件
- 需要关注：报告文件会随着每日提交自动更新，需要确保存储空间充足

**提交明细**：

- `0876136e7`: 生成 2026-01-03 的每日 Git 变更报告，包含 7 个提交的详细分析
- `9b6f0cec2`: 生成 2026-01-04 的每日 Git 变更报告，包含 1 个提交的详细分析

### 提交覆盖检查

**本次报告涵盖的所有提交**：

| 序号 | Commit | 作者 | 主题 | 所属章节 |
|------|--------|------|------|----------|
| 1 | `20f2f20fd` | Ryan | feat: Add account interest ledger with Binance integration and SQL mi… (#2467) | 2.1 |
| 2 | `1bf339a16` | humblelittlec1[bot] | chore: bump version (#2468) | 2.2 |
| 3 | `0876136e7` | humblelittlec1[bot] | feat: add daily git change report for 2026-01-03 - 7 commits (#2462) | 2.3 |
| 4 | `9b6f0cec2` | humblelittlec1[bot] | feat: add daily git change report for 2026-01-04 - 1 commits (#2466) | 2.3 |

> ✅ 确认：所有 4 个提交均已在上述章节中覆盖

## 3. 贡献者分析

| 作者 | 提交数 | 主要贡献领域 | 关键提交 |
|------|--------|--------------|----------|
| humblelittlec1[bot] | 3 | 版本管理、自动化报告 | `1bf339a16`, `0876136e7`, `9b6f0cec2` |
| Ryan | 1 | Binance 功能开发 | `20f2f20fd` |

## 4. 技术影响与风险

### 兼容性影响

- **API 变更**：新增 `IInterestLedger` 接口和 `provideInterestLedgerService` 函数，为资金费流水提供标准化接口
- **数据库变更**：新增 `account_interest_ledger` 表，需要执行 SQL 迁移脚本 `tools/sql-migration/sql/account_interest_ledger.sql`
- **依赖更新**：多个项目更新到 `@yuants/data-interest-rate@0.2.7` 和 `@yuants/exchange@0.8.10`

### 配置变更

- **Binance API 配置**：新增 `getAccountIncome` API 调用，权重为 30，需要确保 API 限速配置适当
- **数据库索引**：为 `account_interest_ledger` 表添加了多个索引，包括 `created_at` 和 `updated_at` 的降序索引

### 性能影响

- **数据库性能**：新增的索引会提高查询性能，但可能增加写入开销
- **API 调用**：`getAccountIncome` 的权重较高（30），需要注意调用频率以避免触发限速

### 测试覆盖

- **风险指标**：分析显示存在"无测试更新"的中等风险，新增功能缺少对应的测试文件
- **建议**：为 `interest-ledger.ts` 服务和相关 API 添加单元测试和集成测试

---

**生成说明**：本报告基于 `git-changes-reporter` 技能生成，遵循三元组结构（设计意图、核心代码、影响范围）的要求，确保所有提交都被完整覆盖。