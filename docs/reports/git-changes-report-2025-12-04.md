# Git 变更报告（935f0cc6f..a126bbb40）

## 1. 概览

- 时间范围：2025-12-03 至 2025-12-04
- 提交数量：30
- 主要贡献者：Siyuan Wang (11), humblelittlec1[bot] (8), Ryan (6), CZ (5)
- 热点目录：apps (90), common (24), libraries (22)

## 2. 改动聚焦领域

### 2.1 监控与观测

- **涉及目录**：apps/vendor-aster/src/api/
- **关键提交**：
  - a32bacdad (feat: add api call monitor (#2156))
  - 72d270f47 (feat: add api call monitor (#2157))
- **核心改动**：
  - `apps/vendor-aster/src/api/private-api.ts`：添加 Prometheus 监控指标，追踪 API 调用次数
  - `apps/vendor-aster/src/api/public-api.ts`：添加 API 调用监控计数器
- **设计意图**：为 ASTER 供应商的 API 调用添加监控指标，便于观测系统性能和 API 使用情况

### 2.2 功能开发与修复

- **涉及目录**：apps/vendor-aster/src/services/, apps/vendor-binance/src/, apps/vendor-huobi/src/
- **关键提交**：
  - 9b890949b (feat: fix open interest call (#2158))
  - 7eb5263f7 (fix: binance spot positon (#2164))
  - 8f17a0cbd (fix(vendor-hyperliquid): 更新账户信息处理，增加USDC头寸支持及API健壮性改进 (#2167))
- **核心改动**：
  - `apps/vendor-aster/src/services/markets/quote.ts:27-43`：修复 open interest 调用逻辑，简化代码结构
  - `apps/vendor-binance/src/public-data/product.ts`：修复 Binance 现货仓位处理
  - `apps/vendor-huobi/src/services/accounts/spot.ts`：改进账户信息处理逻辑
- **设计意图**：修复各供应商的 API 调用问题，提升系统稳定性和数据准确性

### 2.3 CI/CD 与自动化

- **涉及目录**：.claude/, .github/
- **关键提交**：
  - a14c2b84b (feat: add daily Git change report workflow and scripts (#2160))
  - 2790b6938 (fix(ci): git digest report (#2161))
  - 1cdb7d6f8 (fix(ci): git digest ci (#2171))
- **核心改动**：
  - `.claude/skills/git-changes-reporter/scripts/generate-json.js`：添加 Git 变更报告生成脚本
  - `.claude/skills/git-changes-reporter/scripts/generate-github-links.js`：添加 GitHub 链接生成功能
  - `.github/workflows/daily-git-report.yml`：配置每日 Git 报告工作流
- **设计意图**：建立自动化 Git 变更报告系统，提升团队协作效率和代码审查质量

### 2.4 版本管理与依赖更新

- **涉及目录**：apps/, common/changes/
- **关键提交**：
  - 786b42e45 (chore: bump version (#2159))
  - 7977a8dcf (chore: bump version (#2163))
  - 3c4499753 (chore: bump version (#2165))
- **核心改动**：
  - 多个包的 `package.json` 文件版本更新
  - `common/changes/` 目录下的变更记录文件
- **设计意图**：维护项目版本一致性，记录各包的变更历史

### 2.5 交易功能增强

- **涉及目录**：apps/virtual-exchange/, libraries/protocol/
- **关键提交**：
  - bc0ce17ed (feat: add experimental trading functions including order management and product listing (#2179))
  - fd5ee0334 (feat: enhance IMixMarketContract with additional trading parameters and update margin rate calculation in product listing (#2184))
  - e99ecdc80 (feat: add cache dependency and import in exchange library (#2186))
- **核心改动**：
  - `apps/virtual-exchange/src/product-collector.ts`：增强产品收集器功能
  - `libraries/protocol/src/terminal.ts`：改进交易终端接口
  - `apps/virtual-exchange/src/index.ts`：添加缓存依赖和导入优化
- **设计意图**：增强虚拟交易所的交易功能，支持更复杂的交易场景和参数配置

## 3. 贡献者分析

| 作者 | 提交数 | 主要领域 |
|------|--------|----------|
| Siyuan Wang | 11 | CI/CD 自动化、版本管理 |
| humblelittlec1[bot] | 8 | 版本更新、依赖管理 |
| Ryan | 6 | 监控观测、功能修复 |
| CZ | 5 | 交易功能、API 改进 |

## 4. 技术影响与风险

- **兼容性影响**：新增的监控功能需要 Prometheus 基础设施支持，但向后兼容
- **配置变更**：CI/CD 工作流新增 Git 报告生成，需要 GitHub Actions 权限配置
- **性能影响**：API 监控添加了额外的指标收集，对性能影响极小
- **测试覆盖**：大部分功能提交包含相应的变更记录，但需要补充单元测试

## 5. 单提交摘要（附录）

### a32bacdad Ryan | 2025-12-03 | feat

**主题**：add api call monitor (#2156)

**变更要点**：
- `apps/vendor-aster/src/api/private-api.ts`：添加 Prometheus 监控指标计数器，追踪 API 调用路径和终端 ID
- 引入 `GlobalPrometheusRegistry.counter` 监控 ASTER API 调用次数

**风险/影响**：
- 需要 Prometheus 监控基础设施支持
- 添加了轻量级的性能监控开销

**测试**：未见测试记录

### 9b890949b Ryan | 2025-12-03 | feat

**主题**：fix open interest call (#2158)

**变更要点**：
- `apps/vendor-aster/src/services/markets/quote.ts:27-43`：重构 open interest 查询逻辑，从异步合并映射改为直接映射
- 简化代码结构，移除复杂的 `mergeMap` 和缓存查询

**风险/影响**：
- 可能影响 ASTER 市场数据的 open interest 字段准确性
- 简化了代码逻辑，降低了复杂度

**测试**：未见测试记录

### a14c2b84b Siyuan Wang | 2025-12-03 | feat

**主题**：add daily Git change report workflow and scripts (#2160)

**变更要点**：
- `.claude/skills/git-changes-reporter/scripts/generate-json.js`：创建 Git 变更 JSON 生成脚本
- `.claude/skills/git-changes-reporter/scripts/generate-github-links.js`：添加 GitHub 链接生成功能
- 建立完整的 Git 变更报告生成工作流

**风险/影响**：
- 新增自动化报告系统，需要维护脚本更新
- 依赖 Git 历史记录完整性

**测试**：脚本功能需要验证

### bc0ce17ed Siyuan Wang | 2025-12-03 | feat

**主题**：add experimental trading functions including order management and product listing (#2179)

**变更要点**：
- `apps/virtual-exchange/src/product-collector.ts`：增强产品收集器功能
- 添加实验性交易功能，包括订单管理和产品列表

**风险/影响**：
- 实验性功能需要充分测试
- 可能影响虚拟交易所的稳定性

**测试**：未见测试记录

### fd5ee0334 Siyuan Wang | 2025-12-03 | feat

**主题**：enhance IMixMarketContract with additional trading parameters and update margin rate calculation in product listing (#2184)

**变更要点**：
- 增强 IMixMarketContract 接口，添加额外的交易参数
- 更新产品列表中的保证金率计算逻辑

**风险/影响**：
- 接口变更可能影响现有实现
- 保证金计算逻辑更新需要验证准确性

**测试**：未见测试记录