# Git 变更报告（1f0962395..b7747130f）

## 1. 概览

- **时间范围**：2025-12-20 至 2025-12-20
- **提交数量**：5 个提交
- **主要贡献者**：Siyuan Wang (3), humblelittlec1[bot] (2)
- **热点目录**：apps (51 files), common (22 files), libraries (11 files)
- **生成时间**：2025-12-21T00:06:23.388Z

## 2. 核心变更

> ⚠️ **全覆盖要求**：此章节必须涵盖所有提交，不能遗漏任何一个 commit。

### 2.1 Exchange 历史数据服务增强

**相关提交**：`e04ea0280`, `b7747130f`
**作者**：Siyuan Wang

**设计意图**：
为 @yuants/exchange 库增加 OHLC 和 Interest Rate 历史数据写入服务，统一历史数据获取的标准化接口。现有各 vendor 内部存在多套历史数据实现，缺少统一的"能力声明 + schema 元信息解析 + 只写库不回传数据"的 SDK 入口。新增的 provideOHLCService / provideInterestRateService 可以让 VEX/调度侧按 exchange.md 规范统一发现能力、驱动分页拉取，并把数据稳定落到 `ohlc`/`interest_rate` 表，同时记录数据拉取范围到新增的 `series_data_range` 表。

**核心代码**：
[libraries/exchange/src/ohlc.ts:L84-L114](libraries/exchange/src/ohlc.ts#L84-L114)

```typescript
export interface IHistoryTimePaging {
  direction: 'backward' | 'forward';
  time: string; // RFC3339 date-time
}

export interface IHistoryIngestResult {
  wrote_count: number;
  range?: { start_time: string; end_time: string }; // RFC3339 date-time
}

export interface IOHLCServiceMetadata {
  product_id_prefix: string;
  duration_list: string[]; // RFC3339 duration list
  direction: 'backward' | 'forward';
  max_items_per_page?: number;
}

export interface IIngestOHLCRequest {
  product_id: string;
  duration: string; // enum = metadata.duration_list
  direction: 'backward' | 'forward'; // const = metadata.direction
  time: string; // RFC3339 date-time
  limit?: number;
}
```

**影响范围**：

- 影响模块：`@yuants/exchange`, `@yuants/tool-sql-migration`, 所有 vendor 实现
- 需要关注：新增 `series_data_range` 表用于记录数据拉取范围，series_id 编码约定更新为 `encodePath(product_id, duration)`（OHLC）和 `encodePath(product_id)`（InterestRate）

**提交明细**：

- `e04ea0280`: feat(exchange): add OHLC and Interest Rate historical data ingestion services
- `b7747130f`: feat: Add OHLC and Interest Rate services for multiple vendors

### 2.2 Legion 任务管理与清理

**相关提交**：`b7d4392df`, `91eb1f6c5`
**作者**：humblelittlec1[bot], Siyuan Wang

**设计意图**：
优化 Legion 任务管理系统的文件结构和任务清理流程。新增 Telegram 遗留代码清理任务，并完善 OHLC/InterestRate 历史数据写入服务的任务上下文和计划文档。通过系统化的任务管理，确保代码清理和历史数据服务开发的规范性和可追溯性。

**核心代码**：
[.legion/tasks/telegram/plan.md:L1-L29](.legion/tasks/telegram/plan.md#L1-L29)

```markdown
# 移除 Telegram 遗留代码（前后端）并清理重构命名

## 目标

彻底移除前后端 Telegram 相关遗留代码，清理/重构命名，并确保构建与核心功能保持正常。

## 要点

- 优先删除不可达/无用代码，避免留下空壳引用
- 对外兼容策略先写入 `context.md` 再动代码（避免误删关键接口）
- 重构改名以"语义真实、边界清晰"为准（不要为了改名而改名）
- 每次删除/重构后运行对应的 build/typecheck，减少回归面

## 范围

- frontend/src/components/telegram-weidget/**
- backend/src/**（含 type、路由/服务/配置 等）
- 项目配置与文档（README/示例 env/PROJECT_DESIGN 等，如涉及）
```

**影响范围**：

- 影响模块：`.legion` 任务管理系统，前后端代码清理
- 需要关注：Telegram 相关代码的彻底清理需要确保不影响现有功能

**提交明细**：

- `b7d4392df`: feat: add daily git change report for 2025-12-20 - 3 commits
- `91eb1f6c5`: chore(legion): prune files

### 2.3 版本更新与维护

**相关提交**：`612c1b4ba`
**作者**：humblelittlec1[bot]

**设计意图**：
例行版本更新和维护工作，确保项目依赖和版本号的及时同步。这是持续集成流程的一部分，保持项目版本管理的规范性和一致性。

**影响范围**：

- 影响模块：项目整体版本管理
- 需要关注：版本号变更可能影响依赖解析

**提交明细**：

- `612c1b4ba`: chore: bump version

### 提交覆盖检查

**本次报告涵盖的所有提交**：

| 序号 | Commit | 作者 | 主题 | 所属章节 |
|------|--------|------|------|----------|
| 1 | `e04ea0280` | Siyuan Wang | feat(exchange): add OHLC and Interest Rate historical data ingestion … (#2374) | 2.1 |
| 2 | `b7d4392df` | humblelittlec1[bot] | feat: add daily git change report for 2025-12-20 - 3 commits (#2376) | 2.2 |
| 3 | `91eb1f6c5` | Siyuan Wang | chore(legion): prune files (#2377) | 2.2 |
| 4 | `612c1b4ba` | humblelittlec1[bot] | chore: bump version (#2378) | 2.3 |
| 5 | `b7747130f` | Siyuan Wang | feat: Add OHLC and Interest Rate services for multiple vendors (#2379) | 2.1 |

> ✅ 确认：所有 5 个提交均已在上述章节中覆盖

## 3. 贡献者分析

| 作者 | 提交数 | 主要贡献领域 | 关键提交 |
|------|--------|--------------|----------|
| Siyuan Wang | 3 | Exchange 历史数据服务、Legion 任务管理 | `e04ea0280`, `b7747130f`, `91eb1f6c5` |
| humblelittlec1[bot] | 2 | 版本管理、Git 变更报告 | `b7d4392df`, `612c1b4ba` |

## 4. 技术影响与风险

### 兼容性影响

- **API 变更**：新增 `provideOHLCService` 和 `provideInterestRateService` 接口，不影响现有 API
- **数据模型变更**：新增 `series_data_range` 表用于记录数据拉取范围
- **series_id 编码约定**：更新为 `encodePath(product_id, duration)`（OHLC）和 `encodePath(product_id)`（InterestRate），需要确认下游读取逻辑兼容性

### 配置变更

- **新增 SQL migration**：`tools/sql-migration/sql/series_data_range.sql`
- **依赖更新**：`@yuants/exchange` 新增对 `@yuants/data-ohlc` 和 `@yuants/data-interest-rate` 的依赖

### 性能影响

- **历史数据写入**：新增的分页拉取和写库服务可能增加数据库写入负载
- **范围记录表**：`series_data_range` 表的写入操作增加额外开销，但使用 `ON CONFLICT DO NOTHING` 保证幂等性

### 测试覆盖

- **新增单元测试**：`libraries/exchange/src/quote.test.ts`, `libraries/exchange/src/ohlc.test.ts`, `libraries/exchange/src/interest_rate.test.ts`
- **测试策略**：覆盖 schema 解析函数的正常/异常路径

---
**报告生成时间**：2025-12-21  
**数据源**：docs/reports/git-changes-2025-12-21.json  
**技能版本**：git-changes-reporter 3.0.0