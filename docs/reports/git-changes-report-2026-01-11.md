# Git 变更报告（771914437..6d44b32d2）

## 1. 概览

- **时间范围**：2026-01-11 至 2026-01-11
- **提交数量**：1 个提交
- **主要贡献者**：Ryan (1)
- **热点目录**：common (7 files), apps (6 files), libraries (2 files)
- **生成时间**：2026-01-11T00:06:31.518Z

## 2. 核心变更

> ⚠️ **全覆盖要求**：此章节必须涵盖所有提交，不能遗漏任何一个 commit。

### 2.1 交易所利息分类账服务支持 FUNDING_FEE 类型

**相关提交**：`6d44b32d2`
**作者**：Ryan

**设计意图**：
为多个交易所的利息分类账服务添加对 FUNDING_FEE（资金费率）类型的支持。此前各交易所的利息分类账服务可能支持多种类型的分类账记录，但缺乏明确的类型过滤机制。本次修改通过添加 `ledger_type` 参数验证和类型检查，确保服务只处理 FUNDING_FEE 类型的记录，提高代码的健壮性和可维护性。同时统一了各交易所的实现模式，为后续支持更多分类账类型奠定基础。

**核心代码**：
[libraries/exchange/src/interest_rate.ts:L228-L241](libraries/exchange/src/interest_rate.ts#L228-L241)

```typescript
export const provideInterestLedgerService = (
  terminal: Terminal,
  metadata: { direction: string; type: string; ledger_type: string[] },
) => {
  return terminal.provideService(
    {
      method: 'QueryInterestRateLedger',
      req: {
        account_id: { type: 'string' },
        time: { type: 'number' },
        ledger_type: { type: 'string', enum: metadata.ledger_type },
      },
    },
```

**影响范围**：

- 影响模块：`@yuants/exchange` 库及其所有交易所实现
- 需要关注：所有使用 `provideInterestLedgerService` 的交易所服务都需要更新 `metadata` 配置
- 兼容性影响：API 接口新增 `ledger_type` 参数验证，现有调用需要确保传递正确的类型值

**提交明细**：

- `6d44b32d2`: 为多个交易所的利息分类账服务添加 FUNDING_FEE 类型支持，包括 ASTER、Binance、Bitget、Gate、HTX、OKX

### 2.2 交易所实现细节优化

**相关提交**：`6d44b32d2`
**作者**：Ryan

**设计意图**：
统一各交易所的利息分类账服务实现细节，包括时间窗口调整、类型参数硬编码、产品ID编码标准化等。通过将通用的 `ledger_type` 参数替换为具体的类型值（如 `'FUNDING_FEE'`、`'8'`、`'30,31'` 等），确保各交易所API调用的正确性。同时优化时间窗口设置，减少不必要的查询范围，提高查询效率。

**核心代码**：
[apps/vendor-binance/src/services/interest-ledger.ts:L22-L31](apps/vendor-binance/src/services/interest-ledger.ts#L22-L31)

```typescript
  if (req.ledger_type === 'FUNDING_FEE') {
    const startTime = req.time;
    const res = await getAccountIncome(req.credential.payload, {
      startTime,
      endTime: startTime + WINDOW_MS,
      limit: 1,
      incomeType: 'FUNDING_FEE',
    });
    return (res ?? [])
      .map((v): IInterestLedger => {
```

**影响范围**：

- 影响模块：所有交易所的利息分类账服务实现
- 时间窗口调整：Binance 从 365 天改为 10 天，Gate 从 10 天改为 2 天，Bitget 从 20 天改为 10 天
- 产品ID编码：统一使用 `encodePath` 函数生成标准化的产品ID格式

**提交明细**：

- `6d44b32d2`: 统一各交易所利息分类账服务的实现细节，包括时间窗口优化和类型参数标准化

### 2.3 变更记录和文档更新

**相关提交**：`6d44b32d2`
**作者**：Ryan

**设计意图**：
为本次功能更新添加完整的变更记录和API文档更新。通过创建各包的变更记录文件（CHANGELOG），确保版本管理的一致性。同时更新 `exchange.api.md` 文档，反映接口参数的变化，为开发者提供准确的API参考。

**核心代码**：
[common/changes/@yuants/exchange/2026-01-10-23-01.json:L1-L10](common/changes/@yuants/exchange/2026-01-10-23-01.json#L1-L10)

```json
{
  "changes": [
    {
      "packageName": "@yuants/exchange",
      "comment": "add ledger type",
      "type": "patch"
    }
  ],
  "packageName": "@yuants/exchange"
}
```

**影响范围**：

- 影响模块：所有相关包的变更记录管理
- 文档更新：`exchange.api.md` 添加 `ledger_type` 参数说明
- 包版本管理：为 `@yuants/exchange`、`@yuants/vendor-aster`、`@yuants/vendor-binance`、`@yuants/vendor-bitget`、`@yuants/vendor-gate`、`@yuants/vendor-huobi`、`@yuants/vendor-okx` 添加变更记录

**提交明细**：

- `6d44b32d2`: 添加各包的变更记录文件和API文档更新

### 提交覆盖检查

**本次报告涵盖的所有提交**：

| 序号 | Commit | 作者 | 主题 | 所属章节 |
|------|--------|------|------|----------|
| 1 | `6d44b32d2` | Ryan | add ledger type (#2488) | 2.1, 2.2, 2.3 |

> ✅ 确认：所有 1 个提交均已在上述章节中覆盖

## 3. 贡献者分析

| 作者 | 提交数 | 主要贡献领域 | 关键提交 |
|------|--------|--------------|----------|
| Ryan | 1 | 交易所利息分类账服务优化 | `6d44b32d2` |

## 4. 技术影响与风险

### 兼容性影响

- **API 参数验证增强**：`provideInterestLedgerService` 现在要求 `metadata.ledger_type` 参数，并会对传入的 `ledger_type` 进行枚举验证
- **向后兼容性**：现有调用如果传递不在 `metadata.ledger_type` 列表中的值，将会被拒绝
- **建议**：更新所有使用该服务的代码，确保传递正确的 `ledger_type` 值

### 配置变更

- **新增配置项**：各交易所服务的 `metadata` 配置中需要添加 `ledger_type: ['FUNDING_FEE']`
- **时间窗口调整**：
  - Binance: `WINDOW_MS` 从 365 天改为 10 天
  - Gate: `WINDOW_MS` 从 10 天改为 2 天  
  - Bitget: `WINDOW_MS` 从 20 天改为 10 天
- **类型参数硬编码**：各交易所API调用中的类型参数现在被硬编码为对应的FUNDING_FEE类型值

### 性能影响

- **查询范围优化**：减少的时间窗口应该会提高查询性能，减少不必要的数据传输
- **条件检查**：添加的 `if (req.ledger_type === 'FUNDING_FEE')` 检查增加了少量运行时开销
- **并行查询**：Bitget 实现中使用了 `Promise.all` 进行并行查询，可能提高性能

### 测试覆盖

- **变更记录**：为所有相关包添加了变更记录文件
- **API文档**：更新了 `exchange.api.md` 反映接口变化
- **建议**：考虑添加单元测试验证 `ledger_type` 参数验证逻辑

---
**报告生成时间**: 2026-01-11  
**数据源**: docs/reports/git-changes-2026-01-11.json  
**工具版本**: git-changes-reporter 3.0.0