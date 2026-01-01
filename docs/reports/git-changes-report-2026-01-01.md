# Git 变更报告（50233b88d..63860d8e5）

## 1. 概览

- **时间范围**：2025-12-31 至 2025-12-31
- **提交数量**：2 个提交
- **主要贡献者**：CZ (1), humblelittlec1[bot] (1)
- **热点目录**：apps (120 files), libraries (65 files), common (61 files)
- **生成时间**：2026-01-01T00:06:34.549Z

## 2. 核心变更

> ⚠️ **全覆盖要求**：此章节必须涵盖所有提交，不能遗漏任何一个 commit。

### 2.1 利率数据处理重构与信号量队列优化

**相关提交**：`8addd1f68`
**作者**：CZ

**设计意图**：
重构虚拟交易所的利率数据处理架构，将原本分散的利率数据收集逻辑（interest-rate.ts 和 ohlc.ts）统一整合到 setup.ts 中，简化代码结构并提高可维护性。同时优化信号量队列的内存管理，通过引入头部指针（head）和队列压缩机制，避免已取消请求的即时移除操作，减少内存碎片并提高性能。此重构旨在解决高并发场景下的内存泄漏问题，同时保持向后兼容性。

**核心代码**：
[setup.ts:L10-L25](apps/virtual-exchange/src/series-collector/setup.ts#L10-L25)

```typescript
const api = {
  OHLC: {
    list: listOHLCSeriesIds,
    forward: handleIngestOHLCForward,
    backward: handleIngestOHLCBackward,
    patch: handleIngestOHLCPatch,
  },
  InterestRate: {
    list: listInterestRateSeriesIds,
    forward: handleIngestInterestRateForward,
    backward: handleIngestInterestRateBackward,
    patch: handleInterestRatePatch,
  },
};
```

**影响范围**：

- 影响模块：`apps/virtual-exchange` 的 series-collector 模块
- 需要关注：重构后删除了 interest-rate.ts 和 ohlc.ts 文件，新增 setup.ts 统一管理数据收集任务
- 兼容性：函数签名从 `(product_id, meta, signal)` 改为 `(product_id, direction, signal)`，简化参数传递

**提交明细**：

- `8addd1f68`: 重构利率数据处理逻辑，整合 setup.ts 并优化信号量队列内存管理

### 2.2 版本号更新与依赖升级

**相关提交**：`63860d8e5`
**作者**：humblelittlec1[bot]

**设计意图**：
自动化版本更新流程，更新多个应用的版本号至最新版本，并同步升级相关依赖包。这是持续集成流程的一部分，确保所有应用使用一致的依赖版本，保持系统稳定性和安全性。版本更新包括 account-composer、agent、alert-receiver 等多个应用，涉及 @yuants 生态系统的多个核心包。

**核心代码**：
[package.json:L3](apps/account-composer/package.json#L3)

```json
{
  "version": "0.7.19"
}
```

**影响范围**：

- 影响模块：account-composer、agent、alert-receiver、app-openai、email-notifier、feishu-notifier、fund、gateway、kernel、log-server、market-data-collector、notifier、order-executor、order-manager、portfolio、product、risk、series-collector、trade、virtual-exchange、web、worker
- 依赖更新：@yuants 生态系统多个包的版本升级，包括 protocol、utils、sql、extension 等核心依赖

**提交明细**：

- `63860d8e5`: 更新多个应用的版本号并升级相关依赖包

### 提交覆盖检查

**本次报告涵盖的所有提交**：

| 序号 | Commit | 作者 | 主题 | 所属章节 |
|------|--------|------|------|----------|
| 1 | `8addd1f68` | CZ | feat: refactor interest rate handling and consolidate setup logic (#2442) | 2.1 |
| 2 | `63860d8e5` | humblelittlec1[bot] | chore: bump version (#2443) | 2.2 |

> ✅ 确认：所有 2 个提交均已在上述章节中覆盖

## 3. 贡献者分析

| 作者 | 提交数 | 主要贡献领域 | 关键提交 |
|------|--------|--------------|----------|
| CZ | 1 | 虚拟交易所架构重构 | `8addd1f68` |
| humblelittlec1[bot] | 1 | 版本管理与依赖更新 | `63860d8e5` |

## 4. 技术影响与风险

### 兼容性影响

- **API 变更**：利率数据处理函数签名从 `(product_id, meta, signal)` 简化为 `(product_id, direction, signal)`，移除了冗余的 metadata 参数
- **文件结构变更**：删除了 interest-rate.ts 和 ohlc.ts，新增 setup.ts 统一管理数据收集任务

### 配置变更

- **新增配置文件**：在 common/changes 目录下新增了三个包的变更记录文件：
  - `@yuants/app-virtual-exchange/2025-12-31-13-43.json`：记录性能问题修复
  - `@yuants/exchange/2025-12-31-13-43.json`：记录导入优化
  - `@yuants/utils/2025-12-31-13-43.json`：记录信号量队列优化
- **版本配置更新**：多个应用的 package.json 版本号更新，包括 account-composer (0.7.18 → 0.7.19)、agent (0.8.36 → 0.8.37)、alert-receiver (0.6.4 → 0.6.5) 等

### 性能影响

- **信号量队列内存优化**：在 `libraries/utils/src/semaphore.ts` 中引入头部指针（head）和队列压缩机制，当队列头部指针超过 1024 且队列长度小于头部指针两倍时自动压缩，显著减少高并发场景下的内存碎片
- **虚拟交易所数据收集优化**：统一利率和 OHLC 数据收集逻辑到 setup.ts，减少重复代码，提高数据收集任务的调度效率
- **依赖包性能提升**：升级 @yuants/utils 到 0.19.1 版本，包含信号量队列优化，提升整个系统的并发处理能力

### 测试覆盖

- **虚拟交易所模块测试**：需要验证重构后的 `apps/virtual-exchange/src/series-collector/setup.ts` 是否正常工作，确保利率和 OHLC 数据收集任务正确调度
- **信号量队列压力测试**：建议对 `libraries/utils/src/semaphore.ts` 的队列压缩机制进行高并发压力测试，验证内存使用改善效果
- **依赖兼容性测试**：需要验证升级后的 @yuants 生态系统包（protocol 0.53.8、utils 0.19.1、sql 0.9.36、extension 0.2.37 等）与现有应用的兼容性

---

**报告生成时间**：2026-01-01