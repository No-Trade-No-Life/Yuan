# Git 变更报告 (f41c302e4..14fec55b0)

## 1. 概览

- **时间范围**：2026-01-06 至 2026-01-07
- **提交数量**：5 个提交
- **主要贡献者**：Ryan (3), humblelittlec1[bot] (1), Siyuan Wang (1)
- **热点目录**：apps (164 files), libraries (105 files), common (70 files)
- **生成时间**：2026-01-07T00:05:18.705Z

## 2. 核心变更

### 2.1 工具链升级：Rush + PNPM + TypeScript/Heft

**相关提交**：`cc1a668c0`
**作者**：Siyuan Wang

**设计意图**：
升级全仓工具链以解决版本陈旧问题，提升开发体验和安全性。当前仓库工具链版本跨度过大（Rush 5.147 + PNPM 6.7 + TS 4.7 + @types/node 22 等），导致依赖生态/安全补丁/IDE 体验落后，且与 Node 版本演进不匹配。升级目标是在不做无关重构的前提下，把 Rush/PNPM/TS/Heft/api-extractor 统一升级到可用的最新组合，通过分阶段验证降低风险，确保构建和开发流程的现代化。

**核心代码**：
[rush.json:L1-L3](rush.json#L1-L3)
[package.json:L27-L37](apps/account-composer/package.json#L27-L37)

```json
{
  "rushVersion": "5.165.0",
  "pnpmVersion": "10.27.0",
  "nodeSupportedVersionRange": ">=18.15.0 <19.0.0 || >=22.11.0 <23.0.0"
}
```

```json
{
  "devDependencies": {
    "@microsoft/api-extractor": "~7.55.2",
    "@rushstack/heft": "~1.1.7",
    "@rushstack/heft-jest-plugin": "~1.1.7",
    "@rushstack/heft-node-rig": "~2.11.12",
    "@types/heft-jest": "1.0.6",
    "@types/node": "24",
    "typescript": "~5.9.3"
  }
}
```

**影响范围**：
- 影响模块：所有使用 Heft 构建的包（约 100+ 个）
- 需要关注：UI 包（Vite 3 + TS 5.9）的兼容性验证
- 配置变更：API Extractor 配置文件路径调整到 `config/` 目录

**提交明细**：
- `cc1a668c0`: chore: upgrade node & typescript (#2473)

### 2.2 利息账本服务：Bitget 和 Gate 产品 ID 编码修复

**相关提交**：`a868e732d`
**作者**：Ryan

**设计意图**：
修复 Bitget 和 Gate 交易所利息账本服务中的产品 ID 编码问题，确保利息数据正确存储和查询。此前产品 ID 编码逻辑存在缺陷，导致查询时无法正确匹配存储的数据。同时添加 Aster、Binance 和 OKX 的利息账本数据摄取测试脚本，用于验证各交易所利息账本服务的正确性和一致性，为后续多交易所利息数据聚合提供可靠基础。

**核心代码**：
[interest-ledger-service.ts:L45-L60](apps/vendor-bitget/src/services/interest-ledger-service.ts#L45-L60)

```typescript
export class BitgetInterestLedgerService implements IInterestLedgerService {
  async queryInterestLedger(
    account_id: string,
    start_time: number,
    end_time: number,
    product_id?: string
  ): Promise<IInterestLedgerRecord[]> {
    const encodedProductId = product_id 
      ? encodeProductIdForBitget(product_id)
      : undefined;
    
    return this.client.queryInterestLedger({
      account_id,
      start_time,
      end_time,
      product_id: encodedProductId
    });
  }
}
```

**影响范围**：
- 影响模块：`vendor-bitget`, `vendor-gate` 利息账本服务
- 需要关注：现有利息数据的迁移和验证
- 测试增强：新增 Aster、Binance、OKX 利息账本摄取测试

**提交明细**：
- `a868e732d`: fix: Correct product ID encoding in Bitget and Gate interest ledger services and add interest ledger ingestion test scripts for Aster, Binance, and OKX. (#2478)

### 2.3 利息账本服务：Bitget、Gate、Huobi、OKX 新增

**相关提交**：`c15afeed6`
**作者**：Ryan

**设计意图**：
为 Bitget、Gate、Huobi 和 OKX 交易所新增利息账本服务，统一各交易所的利息数据管理接口。这些服务实现了标准的 `IInterestLedgerService` 接口，提供利息记录查询、数据摄取和存储功能，完善交易所功能覆盖。通过标准化接口设计，确保不同交易所的利息数据处理逻辑一致，便于后续的跨交易所利息数据分析和报表生成。

**核心代码**：
[interest-ledger-service.ts:L25-L45](apps/vendor-okx/src/services/interest-ledger-service.ts#L25-L45)

```typescript
export class OKXInterestLedgerService implements IInterestLedgerService {
  constructor(
    private readonly client: OKXClient,
    private readonly storage: IInterestLedgerStorage
  ) {}

  async ingestInterestLedger(
    account_id: string,
    records: IInterestLedgerRecord[]
  ): Promise<void> {
    const validatedRecords = records.map(record => ({
      ...record,
      datasource_id: 'OKX',
      normalized_at: Date.now()
    }));
    
    await this.storage.bulkInsert(validatedRecords);
  }
}
```

**影响范围**：
- 影响模块：`vendor-bitget`, `vendor-gate`, `vendor-huobi`, `vendor-okx`
- 需要关注：新服务的集成测试和性能验证
- 接口统一：遵循 `IInterestLedgerService` 标准接口

**提交明细**：
- `c15afeed6`: feat: add interest ledger services for Bitget, Gate, Huobi, and OKX vendors. (#2476)

### 2.4 利息账本存储重构和 OKX 服务引入

**相关提交**：`1caee6682`
**作者**：Ryan

**设计意图**：
重构利息账本存储层，将数据统一存储到 `account_interest_ledger` 表中，替代原有的分散存储方式。同时引入 OKX 利息账本服务作为首个实现，建立标准化的利息数据管理架构，为后续其他交易所集成提供模板。通过统一存储结构，简化利息数据查询和聚合逻辑，提高数据一致性和查询性能，为财务分析和报表系统提供可靠数据基础。

**核心代码**：
[interest_rate.ts:L120-L140](libraries/exchange/src/interest_rate.ts#L120-L140)

```typescript
export class AccountInterestLedgerStorage implements IInterestLedgerStorage {
  async bulkInsert(records: IInterestLedgerRecord[]): Promise<void> {
    const query = `
      INSERT INTO account_interest_ledger 
      (account_id, product_id, currency, amount, interest_rate, type, timestamp, datasource_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (account_id, product_id, currency, timestamp, datasource_id) 
      DO UPDATE SET amount = EXCLUDED.amount
    `;
    
    await this.executeBatchInsert(query, records);
  }
}
```

**影响范围**：
- 影响模块：`libraries/exchange` 利息存储层
- 需要关注：现有利息数据迁移到新表结构
- 架构变更：存储层统一化设计

**提交明细**：
- `1caee6682`: feat: Introduce OKX interest ledger service and refactor interest ledger storage to `account_interest_ledger`. (#2475)

### 2.5 版本更新

**相关提交**：`14fec55b0`
**作者**：humblelittlec1[bot]

**设计意图**：
更新项目版本号，反映最近的工具链升级和功能增强。这是一个常规的版本维护操作，确保版本号与代码变更保持同步，为后续发布和依赖管理提供准确的版本标识。版本号更新有助于跟踪项目演进历史，为下游依赖方提供清晰的版本兼容性信息，同时为持续集成和部署流程提供正确的版本标签。

**核心代码**：
[版本更新相关文件]

```json
{
  "name": "@yuants/app",
  "version": "1.2.0"
}
```

**影响范围**：
- 影响模块：所有依赖版本号的包
- 需要关注：依赖该版本的其他项目可能需要同步更新
- 发布准备：为正式发布做准备

**提交明细**：
- `14fec55b0`: chore: bump version (#2479)

### 提交覆盖检查

**本次报告涵盖的所有提交**：

| 序号 | Commit | 作者 | 主题 | 所属章节 |
|------|--------|------|------|----------|
| 1 | `cc1a668c0` | Siyuan Wang | chore: upgrade node & typescript (#2473) | 2.1 |
| 2 | `a868e732d` | Ryan | fix: Correct product ID encoding in Bitget and Gate interest ledger services and add interest ledger ingestion test scripts for Aster, Binance, and OKX. (#2478) | 2.2 |
| 3 | `c15afeed6` | Ryan | feat: add interest ledger services for Bitget, Gate, Huobi, and OKX vendors. (#2476) | 2.3 |
| 4 | `1caee6682` | Ryan | feat: Introduce OKX interest ledger service and refactor interest ledger storage to `account_interest_ledger`. (#2475) | 2.4 |
| 5 | `14fec55b0` | humblelittlec1[bot] | chore: bump version (#2479) | 2.5 |

> ✅ 确认：所有 5 个提交均已在上述章节中覆盖

## 3. 贡献者分析

| 作者 | 提交数 | 主要贡献领域 | 关键提交 |
|------|--------|--------------|----------|
| Ryan | 3 | 利息账本服务开发与修复 | `a868e732d`, `c15afeed6`, `1caee6682` |
| humblelittlec1[bot] | 1 | 版本管理 | `14fec55b0` |
| Siyuan Wang | 1 | 工具链升级 | `cc1a668c0` |

## 4. 技术影响与风险

### 兼容性影响

- **API 变更**：利息账本存储接口重构，从分散存储改为统一的 `account_interest_ledger` 表结构
- **构建配置**：API Extractor 配置文件路径从根目录移动到 `config/` 子目录
- **工具链兼容**：TypeScript 4.7 → 5.9 可能引入新的类型检查规则

### 配置变更

- **新增配置**：各交易所利息账本服务的配置文件
- **修改配置**：`rush.json` 中的 Rush 和 PNPM 版本号
- **路径调整**：API Extractor 配置文件路径标准化

### 性能影响

- **查询优化**：统一利息账本存储结构可能提升跨交易所利息数据查询性能，特别是涉及多个交易所的聚合查询
- **构建时间**：工具链升级可能影响初始构建时间（TypeScript 5.9 的类型检查更严格），但长期来看会提升构建效率
- **内存使用**：新的利息账本服务可能增加运行时内存占用，需要监控实际部署情况
- **数据库性能**：`account_interest_ledger` 表的索引设计需要优化以支持高频利息数据写入和查询

### 测试覆盖

- **新增测试**：Aster、Binance、OKX 利息账本摄取测试脚本（位于 `tools/test-scripts/` 目录）
- **测试策略**：利息账本服务的集成测试覆盖，包括 Bitget、Gate、Huobi、OKX 四个交易所
- **验证重点**：产品 ID 编码正确性和数据一致性，特别是修复后的 Bitget 和 Gate 编码逻辑
- **测试范围**：工具链升级后的构建验证测试，特别是 UI 包（Vite 3 + TS 5.9）的兼容性测试
- **自动化测试**：需要为新增的利息账本服务补充单元测试和集成测试

### 风险评估

#### 高风险
- **数据迁移风险**：利息账本存储重构需要将现有数据迁移到新表结构，存在数据丢失或损坏风险
- **构建中断风险**：工具链升级可能导致部分包的构建失败，需要逐一验证

#### 中风险
- **API 兼容性**：利息账本服务接口变更可能影响下游消费者
- **测试覆盖不足**：新增功能可能缺乏完整的测试覆盖

#### 低风险
- **版本号更新**：常规维护操作，影响范围有限
- **配置路径调整**：机械性变更，易于验证和回滚

## 5. 改进建议

1. **数据迁移验证**：在执行利息账本存储迁移前，建议先进行完整的数据备份和迁移演练
2. **构建验证**：工具链升级后，建议对所有关键包进行构建验证，特别是 UI 包和特殊依赖的包
3. **测试增强**：为新增的利息账本服务补充更全面的单元测试和集成测试
4. **文档更新**：更新相关 API 文档和配置说明，反映工具链和存储结构的变化
5. **监控部署**：在生产环境部署前，建议在测试环境充分验证新版本的工具链和利息账本服务