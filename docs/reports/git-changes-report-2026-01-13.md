# Git 变更报告（685763533..5ca622abc）

## 1. 概览

- **时间范围**：2026-01-12 至 2026-01-12
- **提交数量**：5 个提交
- **主要贡献者**：Ryan (3), humblelittlec1[bot] (2)
- **热点目录**：apps (45 files), common (17 files), libraries (17 files)
- **生成时间**：2026-01-13T00:05:18.754Z

## 2. 核心变更

> ⚠️ **全覆盖要求**：此章节必须涵盖所有提交，不能遗漏任何一个 commit。

### 2.1 交易历史功能实现

**相关提交**：`60ee64a8f`
**作者**：Ryan

**设计意图**：
为多个交易所（BITGET、GATE、HTX、OKX）添加交易历史查询功能，实现统一的交易历史数据模型和存储机制。此前系统缺乏标准化的交易历史记录功能，各交易所的交易数据格式不统一，难以进行统一分析和查询。本次变更引入了 `ITradeHistory` 接口定义，创建了 `trade_history` 数据库表，并在 `@yuants/exchange` 库中提供了标准化的交易历史服务接口，使不同交易所的交易历史数据能够以统一格式存储和查询，支持交易分析、对账和报表生成等业务场景。

**核心代码**：
[interface.ts:L72-L121](libraries/data-trade/src/interface.ts#L72-L121)

```typescript
export interface ITradeHistory {
  id: string;
  account_id: string;
  product_id: string;
  direction: string;
  size: string;
  price: string;
  fee: string;
  fee_currency: string;
  pnl?: string;
  created_at: string;
  updated_at: string;
}
```

**影响范围**：

- 影响模块：`@yuants/data-trade`, `@yuants/exchange`, `@yuants/vendor-bitget`, `@yuants/vendor-gate`, `@yuants/vendor-huobi`, `@yuants/vendor-okx`
- 需要关注：新增了 `trade_history` 数据库表，需要运行 SQL 迁移脚本；各交易所的交易历史服务实现需要验证数据转换逻辑的正确性

**提交明细**：

- `60ee64a8f`: 为 BITGET、GATE、HTX、OKX 交易所添加交易历史查询功能，包括 API 接口、数据模型和服务实现

### 2.2 系列 ID 编码器与解析器

**相关提交**：`8f06f20c9`, `dedc618ca`
**作者**：Ryan

**设计意图**：
改进利息账本服务的系列 ID 生成和解析机制，从简单的字符串拼接改为使用标准化的路径编码格式。此前在 `provideInterestLedgerService` 中直接使用 `account_id + ledger_type` 的方式生成系列 ID，这种方式缺乏结构化和可解析性。新的实现使用 `@yuants/utils` 库中的 `encodePath` 和 `decodePath` 函数，创建了 `encodeInterestLedgerSeriesId` 和 `decodeInterestLedgerSeriesId` 函数，使系列 ID 具有标准化的格式，便于后续的解析、验证和路由处理，提高了系统的可维护性和扩展性。

**核心代码**：
[index.ts:L100-L112](libraries/data-interest-rate/src/index.ts#L100-L112)

```typescript
export const encodeInterestLedgerSeriesId = (account_id: string, ledger_type: string) =>
  encodePath(...decodePath(account_id), ledger_type);

export const decodeInterestLedgerSeriesId = (series_id: string) => {
  const parts = decodePath(series_id);
  const account_id = encodePath(...parts.slice(0, -1));
  const ledger_type = parts[parts.length - 1];
  return { account_id, ledger_type };
};
```

**影响范围**：

- 影响模块：`@yuants/data-interest-rate`, `@yuants/exchange`
- 需要关注：系列 ID 格式变更，可能影响现有的数据查询和路由逻辑；需要确保所有使用利息账本服务的客户端能够正确处理新的系列 ID 格式

**提交明细**：

- `8f06f20c9`: 修改利息账本服务的系列 ID 生成方式，从 `account_id + ledger_type` 改为 `account_id + ledger_type`
- `dedc618ca`: 添加系列 ID 编码器和解析器函数，提供标准化的系列 ID 处理机制

### 2.3 版本更新与依赖管理

**相关提交**：`39bf13b35`, `5ca622abc`
**作者**：humblelittlec1[bot]

**设计意图**：
更新多个包的版本号以反映代码变更，并同步依赖关系。这是标准的版本发布流程，确保各包的版本号与其实质变更保持一致，便于依赖管理和发布追踪。版本更新包括交易历史功能相关的包（如 `@yuants/data-trade`、`@yuants/exchange`）以及使用了这些包的其他项目，确保整个依赖树的一致性。

**核心代码**：
[package.json](apps/vendor-bitget/package.json)

```json
{
  "version": "0.14.3",
  "dependencies": {
    "@yuants/data-trade": "workspace:*",
    "@yuants/exchange": "workspace:*"
  }
}
```

**影响范围**：

- 影响模块：所有更新版本的包，包括 `@yuants/vendor-aster`、`@yuants/vendor-binance`、`@yuants/vendor-bitget`、`@yuants/vendor-gate`、`@yuants/vendor-huobi`、`@yuants/vendor-hyperliquid`、`@yuants/vendor-okx`、`@yuants/vendor-trading-view`、`@yuants/vendor-turboflow`、`@yuants/app-virtual-exchange`、`@yuants/data-interest-rate`、`@yuants/data-trade`、`@yuants/exchange`、`@yuants/tool-sql-migration`
- 需要关注：版本号变更，需要确保构建和部署流程使用正确的版本

**提交明细**：

- `39bf13b35`: 更新多个包的版本号，反映交易历史功能变更
- `5ca622abc`: 继续更新包版本号，反映系列 ID 编码器变更

### 提交覆盖检查

**本次报告涵盖的所有提交**：

| 序号 | Commit | 作者 | 主题 | 所属章节 |
|------|--------|------|------|----------|
| 1 | `60ee64a8f` | Ryan | add trade history (#2492) | 2.1 |
| 2 | `39bf13b35` | humblelittlec1[bot] | chore: bump version (#2493) | 2.3 |
| 3 | `8f06f20c9` | Ryan | 1 (#2494) | 2.2 |
| 4 | `dedc618ca` | Ryan | add series id coder and parser (#2495) | 2.2 |
| 5 | `5ca622abc` | humblelittlec1[bot] | chore: bump version (#2496) | 2.3 |

> ✅ 确认：所有 5 个提交均已在上述章节中覆盖

## 3. 贡献者分析

| 作者 | 提交数 | 主要贡献领域 | 关键提交 |
|------|--------|--------------|----------|
| Ryan | 3 | 交易历史功能、系列 ID 编码器 | `60ee64a8f`, `dedc618ca` |
| humblelittlec1[bot] | 2 | 版本更新与依赖管理 | `39bf13b35`, `5ca622abc` |

## 4. 技术影响与风险

### 兼容性影响

- **数据库变更**：新增 `trade_history` 表，需要运行 SQL 迁移脚本 `tools/sql-migration/sql/trade_history.sql`
- **API 变更**：新增 `provideTradeHistoryService` 函数，为交易所提供标准化的交易历史服务接口
- **数据模型变更**：新增 `ITradeHistory` 接口，统一交易历史数据格式
- **系列 ID 格式变更**：利息账本服务的系列 ID 生成方式从简单拼接改为路径编码格式

### 配置变更

- **依赖更新**：多个包更新了 `@yuants/data-trade` 和 `@yuants/exchange` 的依赖版本
- **包版本**：所有相关包的版本号已更新，反映功能变更

### 性能影响

- **交易历史查询**：新增的交易历史服务可能增加数据库查询负载，建议对 `trade_history` 表建立适当的索引
- **系列 ID 解析**：新的编码/解码函数增加了轻微的计算开销，但提高了代码的可维护性

### 测试覆盖

- **交易历史功能**：需要为各交易所的交易历史服务添加集成测试，验证数据转换和存储的正确性
- **系列 ID 编码器**：需要为 `encodeInterestLedgerSeriesId` 和 `decodeInterestLedgerSeriesId` 函数添加单元测试
- **数据库迁移**：需要验证 `trade_history.sql` 迁移脚本的正确执行

---

**报告生成工具**：git-changes-reporter v3.0.0
**仓库路径**：/home/runner/work/Yuan/Yuan