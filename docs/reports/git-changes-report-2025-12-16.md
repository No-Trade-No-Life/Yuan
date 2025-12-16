# Git 变更报告（13ca7c0fa..9ac0f22c2）

## 1. 概览

- **时间范围**：2025-12-15 至 2025-12-15
- **提交数量**：5 个提交
- **主要贡献者**：Siyuan Wang (1 commits), humblelittlec1[bot] (2 commits), CZ (2 commits)
- **热点项目**：`apps/vendor-huobi` (5 文件), `apps/vendor-okx` (4 文件), `common` (4 文件)
- **生成时间**：2025-12-16T00:06:49.164Z
- **分析深度**：Level 2

## 2. 核心变更

### 2.1 交易所订单参数增强

**相关提交**：`86f6f8169`
**作者**：CZ

**设计意图**：
为火币（Huobi）交易所的订单提交接口添加经纪商 ID 参数支持，使系统能够通过环境变量 `BROKER_ID` 配置经纪商标识。这允许在多经纪商环境下区分订单来源，满足合规性和业务追踪需求。

**核心代码**：
[submitOrder.ts:L39](apps/vendor-huobi/src/services/orders/submitOrder.ts#L39)
[submitOrder.ts:L102](apps/vendor-huobi/src/services/orders/submitOrder.ts#L102)

```typescript
// 永续合约订单添加 channel_code 参数
channel_code: process.env.BROKER_ID,

// 超级杠杆订单添加 client-order-id 参数  
'client-order-id': process.env.BROKER_ID,
```

**影响范围**：
- 影响模块：`apps/vendor-huobi` 订单提交服务
- 需要关注：需要配置 `BROKER_ID` 环境变量以确保功能正常

### 2.2 行情数据监控集成

**相关提交**：`63dc18dc4`
**作者**：CZ

**设计意图**：
在 OKX 交易所的行情数据写入 SQL 流程中集成指标监控状态，通过 `setMetricsQuoteState` 函数将终端 ID 与行情状态关联，实现更细粒度的性能监控和数据质量追踪。

**核心代码**：
[new-quote.ts:L385](apps/vendor-okx/src/public-data/new-quote.ts#L385)

```typescript
// 在 SQL 写入流程中设置行情状态监控
setMetricsQuoteState(terminal.terminal_id),
```

**影响范围**：
- 影响模块：`apps/vendor-okx` 行情数据服务
- 需要关注：需要 `@yuants/data-quote` 包支持 `setMetricsQuoteState` 函数

### 2.3 工具函数重构与测试

**相关提交**：`9ac0f22c2`
**作者**：Siyuan Wang

**设计意图**：
将 `fnv1a64Hex` 哈希函数从应用层移动到 `@yuants/utils` 共享工具库，并添加完整的单元测试。这提高了代码复用性，确保哈希函数在不同模块间的一致性，并通过测试保证其正确性。

**核心代码**：
[fnv1a64Hex.ts:L3-L19](libraries/utils/src/fnv1a64Hex.ts#L3-L19)

```typescript
export const fnv1a64Hex = (bytes: Uint8Array): string => {
  if (!(bytes instanceof Uint8Array)) throw new TypeError('fnv1a64Hex(bytes), bytes must be a Uint8Array');

  const FNV_OFFSET_64 = BigInt('14695981039346656037');
  const FNV_PRIME_64 = BigInt('1099511628211');
  const MASK_64 = (BigInt(1) << BigInt(64)) - BigInt(1);

  let x = FNV_OFFSET_64;
  for (const byte of bytes) {
    x ^= BigInt(byte);
    x = (x * FNV_PRIME_64) & MASK_64;
  }
  return x.toString(16).padStart(16, '0');
};
```

**影响范围**：
- 影响模块：`apps/alert-receiver`（移除原实现），`libraries/utils`（新增实现）
- 需要关注：依赖 `@yuants/utils` 的模块现在可以使用标准化的哈希函数

### 2.4 版本更新与文档维护

**相关提交**：`0f7bab91d`, `b9d779ba6`
**作者**：humblelittlec1[bot]

**设计意图**：
自动化维护项目版本和变更文档，包括：
1. 生成前一天的 Git 变更报告（`0f7bab91d`）
2. 更新火币和 OKX 供应商包的版本号（`b9d779ba6`）
确保项目文档的时效性和版本管理的规范性。

**核心改动**：
- `docs/reports/git-changes-2025-12-15.json`：新增前日变更数据
- `docs/reports/git-changes-report-2025-12-15.md`：新增前日变更报告
- `apps/vendor-huobi/package.json`：版本号更新
- `apps/vendor-okx/package.json`：版本号更新
- 相关 CHANGELOG 文件更新

**影响范围**：
- 影响模块：文档系统和包版本管理
- 需要关注：自动化流程确保报告和版本更新的及时性

## 3. 贡献者分析

| 作者 | 提交数 | 主要工作 | 关键提交 |
| ---- | ------ | -------- | -------- |
| CZ | 2 | 交易所功能增强和监控集成 | `86f6f8169`, `63dc18dc4` |
| humblelittlec1[bot] | 2 | 自动化文档和版本维护 | `0f7bab91d`, `b9d779ba6` |
| Siyuan Wang | 1 | 工具函数重构和测试 | `9ac0f22c2` |

## 4. 风险评估

### 兼容性影响

**低风险**：
- `fnv1a64Hex` 函数移动到 `@yuants/utils` 可能影响直接引用原路径的代码
- 需要更新 `apps/alert-receiver` 的导入语句

**无风险**：
- 经纪商 ID 参数为可选参数，不破坏现有接口
- 行情监控集成不影响核心数据流

### 配置变更

**新增配置**：
- `BROKER_ID` 环境变量：用于火币订单的经纪商标识

**建议操作**：
- 在生产环境部署前配置 `BROKER_ID` 环境变量
- 验证 `@yuants/utils` 包版本兼容性

### 性能影响

**可忽略**：
- 哈希函数重构不影响运行时性能
- 行情监控添加轻微开销，但为可观测性必要成本

### 测试覆盖

**改进**：
- `fnv1a64Hex` 函数新增完整单元测试
- 现有功能测试应验证经纪商 ID 参数传递

**建议**：
- 添加经纪商 ID 配置的集成测试
- 验证行情监控在 SQL 写入流程中的正确性

## 5. 单提交摘要（附录）

### 0f7bab91d humblelittlec1[bot] | 2025-12-15 13:28:53 +0800 | 文档

**主题**：`feat: add daily git change report for 2025-12-15 - 11 commits (#2340)`

**变更要点**：
- **文件/目录**：`docs/reports/git-changes-2025-12-15.json` - 新增前日 Git 变更 JSON 数据
- **文件/目录**：`docs/reports/git-changes-report-2025-12-15.md` - 新增前日 Git 变更 Markdown 报告

**风险/影响**：无功能影响，纯文档更新

**测试**：未见测试记录

### 86f6f8169 CZ | 2025-12-15 20:35:16 +0800 | 功能

**主题**：`feat: add broker ID to order submission parameters (#2342)`

**变更要点**：
- **文件/目录**：`apps/vendor-huobi/src/api/private-api.ts` - 更新 API 接口类型定义
- **文件/目录**：`apps/vendor-huobi/src/services/orders/submitOrder.ts` - 添加经纪商 ID 到订单参数
- **行为/数据流**：火币订单提交时携带经纪商标识

**风险/影响**：
- 需要配置 `BROKER_ID` 环境变量
- 不影响现有订单流程

**测试**：未见测试记录

### 63dc18dc4 CZ | 2025-12-15 20:37:54 +0800 | 监控

**主题**：`feat: integrate metrics quote state into SQL writing process (#2343)`

**变更要点**：
- **文件/目录**：`apps/vendor-okx/src/public-data/new-quote.ts` - 导入并调用 `setMetricsQuoteState`
- **行为/数据流**：SQL 写入流程中设置行情状态监控

**风险/影响**：
- 依赖 `@yuants/data-quote` 包的 `setMetricsQuoteState` 函数
- 添加轻微监控开销

**测试**：未见测试记录

### b9d779ba6 humblelittlec1[bot] | 2025-12-15 20:38:17 +0800 | 版本

**主题**：`chore: bump version (#2344)`

**变更要点**：
- **文件/目录**：`apps/vendor-huobi/package.json` - 更新版本号
- **文件/目录**：`apps/vendor-okx/package.json` - 更新版本号
- **文档**：更新相关 CHANGELOG 文件

**风险/影响**：无功能影响，版本管理更新

**测试**：未见测试记录

### 9ac0f22c2 Siyuan Wang | 2025-12-15 23:11:16 +0800 | 重构

**主题**：`feat: 移动 fnv1a64Hex 哈希函数到 @yuants/utils 并添加测试 (#2345)`

**变更要点**：
- **文件/目录**：`libraries/utils/src/fnv1a64Hex.ts` - 新增哈希函数实现
- **文件/目录**：`libraries/utils/src/fnv1a64Hex.test.ts` - 新增单元测试
- **文件/目录**：`apps/alert-receiver/src/alertmanager-compatible-utils/fingerprint.ts` - 移除原实现
- **接口/协议**：标准化哈希函数接口，提高复用性

**风险/影响**：
- 需要更新依赖原路径的代码
- 确保 `@yuants/utils` 包版本兼容性

**测试**：`libraries/utils/src/fnv1a64Hex.test.ts` - 新增完整单元测试

---

**报告生成时间**：2025-12-16  
**分析工具**：git-changes-reporter skill  
**数据来源**：`docs/reports/git-changes-2025-12-16.json`