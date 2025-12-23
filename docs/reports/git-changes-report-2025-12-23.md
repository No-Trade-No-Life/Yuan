# Git 变更报告（10c4ab97a..2728fa254）

## 1. 概览

- **时间范围**：2025-12-22 至 2025-12-22
- **提交数量**：4 个提交
- **主要贡献者**：Siyuan Wang (3), humblelittlec1[bot] (1)
- **热点目录**：apps (17 files), common (12 files), libraries (6 files)
- **生成时间**：2025-12-23T00:06:18.022Z

## 2. 核心变更

> ⚠️ **全覆盖要求**：此章节必须涵盖所有提交，不能遗漏任何一个 commit。

### 2.1 系列 ID 编码/解码接口重构

**相关提交**：`4cefb69a6`
**作者**：Siyuan Wang

**设计意图**：
重构 OHLC 和 Interest Rate 数据服务的系列 ID 编码方式，从原有的 `encodePath(datasource_id, product_id, duration)` 简化为更直观的 `${product_id}/${duration}` 格式。这一变更旨在简化数据模型，去除冗余的 `datasource_id` 字段，使系列 ID 更易于理解和解析。同时为 OHLC 数据创建新的 `ohlc_v2` 表结构，将原有的三列合并为单一的 `series_id` 列，提高数据存储效率和查询性能。

**核心代码**：
[libraries/data-ohlc/src/index.ts:L83-L104](libraries/data-ohlc/src/index.ts#L83-L104)

```typescript
export const encodeOHLCSeriesId = (product_id: string, duration: string): string => {
  return `${product_id}/${duration}`;
};

export const decodeOHLCSeriesId = (series_id: string): { product_id: string; duration: string } => {
  const parts = series_id.split('/');
  const duration = parts.pop() ?? '';
  const rawProductId = parts.join('/');
  const product_id = (() => {
    try {
      return decodeURIComponent(rawProductId);
    } catch {
      return rawProductId;
    }
  })();
  return { product_id, duration };
};
```

**影响范围**：

- 影响模块：`data-ohlc`, `data-interest-rate`, `exchange`, `sql-migration`
- 需要关注：OHLC 数据服务现在写入 `ohlc_v2` 表而非 `ohlc` 表，需要确保数据迁移和查询兼容性
- 数据库变更：新增 `ohlc_v2` 表结构，移除了 `datasource_id`, `product_id`, `duration` 三列

**提交明细**：

- `4cefb69a6`: 添加对系列 ID 的编码/解码功能，并更新相关文档和数据库结构

### 2.2 Alert-Receiver 告警加急与去重逻辑修复

**相关提交**：`38cebdd5e`
**作者**：Siyuan Wang

**设计意图**：
修复 alert-receiver 在 resolve/repeat 场景下的加急与重复消息发送逻辑错误。当前系统在告警已解决（Resolved）时也会触发"加急"通知，且 resolve/repeat 场景会重复发送新消息，造成频道噪音与错误提醒。本次修复确保 resolve 状态不触发加急，且重复通知只更新原有消息而非发送新消息，同时确保 urgent 处理失败不会导致消息发送失败，从根本上解决重复发送问题。

**核心代码**：
[apps/alert-receiver/src/pipelines/urgent.ts:L17-L24](apps/alert-receiver/src/pipelines/urgent.ts#L17-L24)

```typescript
export const computeWantedUrgentPayload = (
  route: IAlertReceiveRoute,
  group: IAlertGroup,
): { urgent: string; userIds: string[] } | undefined => {
  if (group.status === 'Resolved') return undefined;
  return makeUrgentPayload(route, group.severity);
};
```

**影响范围**：

- 影响模块：`alert-receiver`, `feishu-notifier`
- 需要关注：Resolved 状态告警不再触发加急通知，重复通知只更新原消息
- 测试覆盖：新增单元测试验证 Resolved 不加急和 urgent 失败不影响消息发送

**提交明细**：

- `38cebdd5e`: 修复 alert-receiver 的 resolve/repeat 加急与去重逻辑，更新任务管理和文档

### 2.3 Vendor 服务并发请求优化

**相关提交**：`2728fa254`
**作者**：Siyuan Wang

**设计意图**：
为所有 vendor 服务（Aster、Binance、Bitget、Gate、Huobi、Hyperliquid、OKX）添加服务选项配置，优化并发请求处理能力。通过设置 `concurrent: 1`, `max_pending_requests: 20` 等参数，控制数据摄取服务的并发度，避免因过多并发请求导致的服务过载或交易所 API 限速。这一优化确保数据摄取服务在高负载场景下仍能稳定运行，同时保护后端服务资源。

**核心代码**：
[apps/vendor-aster/src/services/ohlc-service.ts:L9-L18](apps/vendor-aster/src/services/ohlc-service.ts#L9-L18)

```typescript
const INGEST_SERVICE_OPTIONS: IServiceOptions = {
  concurrent: 1,
  max_pending_requests: 20,
  ingress_token_capacity: 2,
  ingress_token_refill_interval: 1000,
  egress_token_capacity: 1,
  egress_token_refill_interval: 1000,
};
```

**影响范围**：

- 影响模块：所有 vendor 服务的 OHLC 和 Interest Rate 服务
- 需要关注：服务选项统一配置，确保各 vendor 服务行为一致
- 性能影响：限制并发请求数，避免服务过载，提高稳定性

**提交明细**：

- `2728fa254`: 添加服务选项以优化并发请求处理，更新所有 vendor 包版本

### 2.4 Git 变更报告自动化

**相关提交**：`009c30e9a`
**作者**：humblelittlec1[bot]

**设计意图**：
自动化生成每日 Git 变更报告，为团队提供系统化的代码变更跟踪和审查工具。通过生成结构化的 JSON 数据和可读的 Markdown 报告，帮助团队成员快速了解每日代码变更情况，支持代码审查、发布说明和团队同步等场景。该功能基于 git-changes-reporter skill 实现，能够自动分析指定 commit 区间的代码变更，提取关键信息并按语义聚类呈现。

**核心代码**：
[docs/reports/git-changes-report-2025-12-22.md:L1-L10](docs/reports/git-changes-report-2025-12-22.md#L1-L10)

```markdown
# Git 变更报告（b7747130f..10c4ab97a）

## 1. 概览

- **时间范围**：2025-12-21 至 2025-12-21
- **提交数量**：2 个提交
- **主要贡献者**：humblelittlec1[bot] (2)
- **热点目录**：apps (27 files), common (18 files), libraries (3 files)
- **生成时间**：2025-12-22T00:06:19.228Z
```

**影响范围**：

- 影响模块：`docs/reports` 目录下的报告生成系统
- 需要关注：新增了 git-changes-reporter skill 的自动化输出文件，为后续的代码变更跟踪提供了基础设施

**提交明细**：

- `009c30e9a`: 添加 2025-12-22 的每日 Git 变更报告，包含 2 个提交的详细分析

### 提交覆盖检查

**本次报告涵盖的所有提交**：

| 序号 | Commit | 作者 | 主题 | 所属章节 |
|------|--------|------|------|----------|
| 1 | `009c30e9a` | humblelittlec1[bot] | feat: add daily git change report for 2025-12-22 - 2 commits (#2383) | 2.4 |
| 2 | `38cebdd5e` | Siyuan Wang | feat: 修复 alert-receiver 的 resolve/repeat 加急与去重逻辑 (#2382) | 2.2 |
| 3 | `4cefb69a6` | Siyuan Wang | feat: 添加对系列 ID 的编码/解码功能，并更新相关文档和数据库结构 (#2385) | 2.1 |
| 4 | `2728fa254` | Siyuan Wang | feat: 添加服务选项以优化并发请求处理 (#2386) | 2.3 |

> ✅ 确认：所有 4 个提交均已在上述章节中覆盖

## 3. 贡献者分析

| 作者 | 提交数 | 主要贡献领域 | 关键提交 |
|------|--------|--------------|----------|
| Siyuan Wang | 3 | 接口重构、告警系统优化、服务配置 | `38cebdd5e`, `4cefb69a6`, `2728fa254` |
| humblelittlec1[bot] | 1 | 文档与自动化 | `009c30e9a` |

## 4. 技术影响与风险

### 兼容性影响

- **数据库结构变更**：OHLC 数据从 `ohlc` 表迁移到 `ohlc_v2` 表，需要数据迁移脚本
- **API 兼容性**：系列 ID 编码格式变更，但通过新的 `encodeOHLCSeriesId`/`decodeOHLCSeriesId` 函数保持向后兼容
- **服务选项新增**：所有 vendor 服务新增服务选项参数，不影响现有调用方式

### 配置变更

- 新增 `ohlc_v2` 数据库表结构
- 所有 vendor 服务添加 `INGEST_SERVICE_OPTIONS` 配置
- 更新多个包的版本号和变更记录

### 性能影响

- **正向影响**：系列 ID 简化减少存储空间和查询复杂度
- **正向影响**：服务选项限制并发请求，避免服务过载
- **正向影响**：alert-receiver 去重逻辑减少不必要的消息发送

### 测试覆盖

- 新增 `apps/alert-receiver/src/pipelines/urgent.test.ts` 单元测试
- 验证 Resolved 状态不加急和 urgent 失败处理逻辑
- 需要补充 `ohlc_v2` 表的数据迁移和兼容性测试

---

**报告生成时间**：2025-12-23  
**工具版本**：git-changes-reporter 3.0.0  
**数据源**：docs/reports/git-changes-2025-12-23.json