# Git 变更报告（a126bbb40..c36262cad）

## 1. 概览

- 时间范围：2025-12-04 至 2025-12-05
- 提交数量：12
- 主要贡献者：humblelittlec1[bot] (5)、CZ (4)、Siyuan Wang (3)
- 热点目录：apps (49)、common (7)

## 2. 改动聚焦领域

### 2.1 功能开发与 API 集成

- **涉及目录**：`apps/vendor-bitget/`、`apps/vendor-turboflow/`、`apps/virtual-exchange/`
- **关键提交**：
  - `52651345f` (feat: enhance order submission logic to round volume for close positions)
  - `65358bffa` (refactor(vendor-bitget) API integration for futures and spot markets)
  - `9b9495d1e` (feat: update credential handling to use secret_id and enhance error management)
- **核心改动**：
  - `apps/vendor-turboflow/src/services/orders/submitOrder.ts:50-51`：平仓时对剩余小于 1 USDC 的仓位自动平仓，使用 `Math.floor(order.volume)` 替代 `order.volume.toString()`
  - `apps/vendor-bitget/src/api/private-api.ts:11-442`：全面重构 Bitget API，从旧版 v2 接口迁移到 UTA v3 统一账户接口，新增 `IUtaAccountAsset`、`IUtaPosition` 等类型定义
  - `apps/vendor-bitget/src/services/accounts/account.ts:1-59`：新增统一账户服务，合并期货和现货账户查询，支持 `USDT-FUTURES`、`COIN-FUTURES`、`SPOT` 三种产品类型
  - `apps/virtual-exchange/src/credential.ts:117-140`：新增 `getCredentialBySecretId` 方法，基于 `secret_id` 获取凭证，增强错误处理
  - `apps/virtual-exchange/src/general.ts:13-117`：所有服务接口从 `credential_id` 参数改为 `secret_id`，统一凭证处理流程
- **设计意图**：
  - 统一 Bitget 期货和现货 API 接口，简化维护复杂度
  - 优化 Turboflow 平仓逻辑，避免小额仓位残留
  - 改进虚拟交易所凭证管理，支持基于 secret_id 的安全访问

### 2.2 重构与优化

- **涉及目录**：`apps/vendor-bitget/`、`apps/vendor-binance/`、`apps/vendor-aster/`
- **关键提交**：
  - `b285cde59` (feat: 添加请求间隔处理以优化 Binance 数据请求)
  - `76802e0c0` (feat: 添加请求间隔处理以优化 Aster 数据请求)
- **核心改动**：
  - `apps/vendor-binance/src/public-data/quote.ts:39-182`：添加请求间隔计算逻辑，根据 `exchangeInfo.rateLimits` 动态调整 open interest 和 margin 利率请求频率
  - `apps/vendor-aster/src/services/markets/quote.ts:33-182`：实现类似请求间隔优化，使用 `getFApiV1ExchangeInfo` 获取限频信息
  - `apps/vendor-bitget/src/services/markets/product.ts:17-95`：扩展产品列表服务，新增 SPOT 产品支持，设置 `no_interest_rate: true`
  - `apps/vendor-bitget/src/services/accounts/futures.ts:1-64`、`apps/vendor-bitget/src/services/accounts/spot.ts:1-57`：删除旧版期货和现货账户服务，统一到新的 `account.ts`
- **设计意图**：
  - 防止 API 请求过快导致 IP 被封，根据交易所限频规则动态调整请求间隔
  - 统一 Bitget 服务架构，减少代码重复
  - 完善产品配置，正确标记现货产品无利率特性

### 2.3 运维与部署

- **涉及目录**：`apps/`、`common/changes/`
- **关键提交**：
  - `773713684` (chore: bump version)
  - `759b18e5c` (chore: bump version)
  - `e6d5d8b12` (chore: bump version)
  - `61e0a8bf8` (chore: bump version)
  - `c36262cad` (chore: bump version)
- **核心改动**：
  - 多个 vendor 包的版本更新和 CHANGELOG 维护
  - `common/changes/` 目录下的变更记录文件创建和清理
  - 版本号递增：vendor-turboflow (1.2.8 → 1.2.9)、vendor-bitget (0.10.4 → 0.11.1)、virtual-exchange (0.5.2 → 0.5.3) 等
- **设计意图**：
  - 保持包版本与代码变更同步
  - 维护规范的变更记录流程

### 2.4 错误处理与配置修复

- **涉及目录**：`apps/vendor-bitget/`、`apps/vendor-okx/`
- **关键提交**：
  - `c1217ecbc` (fix: update interest rate handling and product configuration for spot markets)
  - `a723dba9d` (feat: 移除系列收集任务写入器)
- **核心改动**：
  - `apps/vendor-bitget/src/services/markets/product.ts:91`：将现货产品的 `no_interest_rate` 从 `false` 改为 `true`
  - `apps/vendor-okx/src/public-data/interest_rate.ts:15-117`：修复利率数据收集的 `series_id` 和 `datasource_id` 映射逻辑
  - `apps/vendor-hyperliquid/src/services/markets/interest-rate.ts:2-34`、`apps/vendor-okx/src/public-data/interest_rate.ts:2-24`：移除 `series_collecting_task` 写入器，简化架构
- **设计意图**：
  - 修正产品配置，避免对现货产品进行不必要的利率查询
  - 清理过时的任务收集机制，减少系统复杂度

## 3. 贡献者分析

| 作者 | 提交数 | 主要领域 |
|------|--------|----------|
| humblelittlec1[bot] | 5 | 版本发布、变更日志维护 |
| CZ | 4 | 功能开发、错误修复、架构优化 |
| Siyuan Wang | 3 | API 重构、性能优化、请求间隔处理 |

## 4. 技术影响与风险

- **兼容性影响**：
  - Bitget API 从 v2 迁移到 UTA v3 可能影响现有集成，但新接口提供了更好的统一账户支持
  - virtual-exchange 从 `credential_id` 改为 `secret_id` 需要客户端更新
  
- **配置变更**：
  - 多个 vendor 包版本更新，部署时需同步更新依赖
  - 现货产品配置变更，避免不必要的利率查询
  
- **性能影响**：
  - Binance 和 Aster 的请求间隔优化可降低 API 调用频率，减少被封风险
  - 移除系列收集任务写入器可减少数据库写入负载
  
- **测试覆盖**：
  - 未见测试文件变更记录，建议对 API 重构和请求间隔逻辑进行充分测试

## 5. 单提交摘要（附录）

### 52651345f CZ | 2025-12-04 | feat

**主题**：enhance order submission logic to round volume for close positions (#2189)

**变更要点**：
- `apps/vendor-turboflow/src/services/orders/submitOrder.ts:50-51`：平仓时对剩余小于 1 USDC 的仓位自动平仓
- 使用 `Math.floor(order.volume)` 替代 `order.volume.toString()` 进行取整处理

**风险/影响**：
- 可能影响小额仓位平仓行为，确保取整逻辑符合业务预期

**测试**：未见测试记录

### 65358bffa Siyuan Wang | 2025-12-04 | refactor

**主题**：refactor(vendor-bitget) API integration for futures and spot markets (#2183)

**变更要点**：
- `apps/vendor-bitget/src/api/private-api.ts:11-442`：全面重构 Bitget API 到 UTA v3
- `apps/vendor-bitget/src/services/accounts/account.ts:1-59`：新增统一账户服务
- 删除旧版 `futures.ts` 和 `spot.ts` 账户服务
- 更新订单、行情、产品服务依赖新的 UTA 接口

**风险/影响**：
- 重大 API 变更，需要全面测试期货和现货功能
- 统一接口简化维护，但迁移期间需确保兼容性

**测试**：未见测试记录

### 9b9495d1e CZ | 2025-12-04 | feat

**主题**：update credential handling to use secret_id and enhance error management (#2192)

**变更要点**：
- `apps/virtual-exchange/src/credential.ts:117-140`：新增 `getCredentialBySecretId` 方法
- `apps/virtual-exchange/src/general.ts:13-117`：所有服务接口参数从 `credential_id` 改为 `secret_id`
- 增强错误处理，添加 `CREDENTIAL_NOT_FOUND` 等错误类型

**风险/影响**：
- 客户端需要更新调用方式，使用 `secret_id` 替代 `credential_id`
- 提高凭证查找的安全性和准确性

**测试**：未见测试记录

### b285cde59 Siyuan Wang | 2025-12-04 | feat

**主题**：添加请求间隔处理以优化 Binance 数据请求 (#2195)

**变更要点**：
- `apps/vendor-binance/src/public-data/quote.ts:39-182`：根据 `exchangeInfo.rateLimits` 计算请求间隔
- 默认间隔：Futures 500ms、Spot/Margin 200ms
- 使用 RxJS `timer` + `concatMap` 实现串行请求节流

**风险/影响**：
- 降低 API 调用频率，减少被封风险
- 可能略微增加数据更新延迟

**测试**：未见测试记录

### 76802e0c0 Siyuan Wang | 2025-12-04 | feat

**主题**：添加请求间隔处理以优化 Aster 数据请求 (#2197)

**变更要点**：
- `apps/vendor-aster/src/services/markets/quote.ts:33-182`：实现类似 Binance 的请求间隔优化
- 扩展 `IAsterExchangeInfo` 接口，添加 `rateLimits` 支持
- 使用 `groupBy + scan` 合并 ticker 与 open interest 数据

**风险/影响**：
- 防止 Aster API 请求过快被封
- 优化数据流处理，减少重复输出

**测试**：未见测试记录

### c1217ecbc CZ | 2025-12-04 | fix

**主题**：update interest rate handling and product configuration for spot markets (#2194)

**变更要点**：
- `apps/vendor-bitget/src/services/markets/product.ts:91`：修正现货产品 `no_interest_rate: true`
- `apps/vendor-okx/src/public-data/interest_rate.ts:15-117`：修复利率数据收集的 ID 映射

**风险/影响**：
- 避免对现货产品进行不必要的利率查询
- 确保 OKX 利率数据正确关联产品

**测试**：未见测试记录

### a723dba9d CZ | 2025-12-05 | feat

**主题**：移除系列收集任务写入器 (#2198)

**变更要点**：
- `apps/vendor-hyperliquid/src/services/markets/interest-rate.ts:2-34`：移除 `series_collecting_task` 写入器
- `apps/vendor-okx/src/public-data/interest_rate.ts:2-24`：移除相同功能
- 简化架构，减少不必要的数据库写入

**风险/影响**：
- 减少系统复杂度
- 可能影响任务调度机制，需确认替代方案

**测试**：未见测试记录