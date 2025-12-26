# Git 变更报告（8333fea8b..04b906f0d）

## 1. 概览

- **时间范围**：2025-12-25 至 2025-12-26
- **提交数量**：8 个提交
- **主要贡献者**：Siyuan Wang (5), humblelittlec1[bot] (3)
- **热点目录**：apps (20 files), .legion (8 files), common (5 files)
- **生成时间**：2025-12-26T00:06:12.552Z

## 2. 核心变更

> ⚠️ **全覆盖要求**：此章节必须涵盖所有提交，不能遗漏任何一个 commit。

### 2.1 Aster API 速率限制优化

**相关提交**：`97c65818e`
**作者**：Siyuan Wang

**设计意图**：
为 Aster 交易所的公共和私有 API 实现基于 host 的令牌桶速率限制，避免触发交易所的 429 限速错误。Aster 交易所对期货 API (`fapi.asterdex.com`) 和现货 API (`sapi.asterdex.com`) 有不同的请求权重限制（分别为 2400/min 和 6000/min）。此前系统没有主动限流机制，高频调用容易触发交易所限速。现在根据官方文档的权重规则，在具体 API 调用点前主动获取令牌，确保请求频率在交易所允许范围内。

**核心代码**：
[client.ts:L7-L12](apps/vendor-aster/src/api/client.ts#L7-L12)

```typescript
export const futureAPIBucket = tokenBucket('fapi.asterdex.com', {
  capacity: 2400,
  refillInterval: 60_000,
  refillAmount: 2400,
});
```

**影响范围**：
- 影响模块：`vendor-aster` 的公共和私有 API 调用
- 需要关注：`getFApiV1OpenInterest` 和 `getApiV1Klines` 接口的权重口径仍需校验，避免自限流过严或仍触发 429

**提交明细**：
- `97c65818e`: 为 Aster 公共/私有 API 实现基于 host 的令牌桶速率限制，初始化期货和现货 API 的令牌桶

### 2.2 Binance 统一订单 API 速率限制修复

**相关提交**：`ffd1bf8bb`
**作者**：Siyuan Wang

**设计意图**：
修复 Binance 统一订单 API (`papi.binance.com`) 的速率限制配置和调用问题。统一订单 API 有独立的速率限制（6000/min），需要与普通 API 分开管理。此前配置缺失导致可能触发限速，同时修复了 `getUMIncome` 端点的 URL 错误。

**核心代码**：
[client.ts:L40-L41](apps/vendor-binance/src/api/client.ts#L40-L41)

```typescript
export const unifiedOrderAPIBucket = tokenBucket('order/unified/minute', {
```

**影响范围**：
- 影响模块：`vendor-binance` 的统一订单 API 调用
- 需要关注：统一订单 API 现在使用独立的令牌桶 `order/unified/minute`

**提交明细**：
- `ffd1bf8bb`: 更新统一订单 API 的速率限制配置并修复相关调用，新增独立令牌桶配置

### 2.3 Git 变更报告工具兼容性修复

**相关提交**：`f7dac5d8b`
**作者**：Siyuan Wang

**设计意图**：
将 git-changes-reporter 工具的 ES6 模块导入语法更改为 CommonJS 语法，提高工具在不同 Node.js 环境下的兼容性。ES6 模块语法在某些较旧的 Node.js 版本或特定环境中可能无法正常工作，改为 CommonJS 语法确保工具在更广泛的环境中可靠运行。

**核心代码**：
[generate-json.js:L3-L6](.claude/skills/git-changes-reporter/scripts/generate-json.js#L3-L6)

```javascript
const { mkdir, writeFile } = require('node:fs/promises');
const { dirname, resolve } = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
```

**影响范围**：
- 影响模块：`.claude/skills/git-changes-reporter` 工具脚本
- 需要关注：工具现在使用 CommonJS 语法，确保向后兼容性

**提交明细**：
- `f7dac5d8b`: 将 ES6 模块导入语法更改为 CommonJS 语法以提高兼容性

### 2.4 虚拟交换系列数据调度器

**相关提交**：`c207831a3`, `b5d152c9a`
**作者**：Siyuan Wang

**设计意图**：
为虚拟交换系统添加系列数据处理调度器，支持批量处理时间序列数据。虚拟交换需要处理大量的历史数据和实时数据流，新的调度器能够更高效地管理和处理这些数据系列，支持数据导入、转换和调度任务。调度器采用 FIFO 队列管理作业，支持 OHLC 和利率数据的自动拉新与回补，根据服务返回的 range 进行推进，避免重复拉取和数据碎片。

**核心代码**：
[series-data-scheduler.ts:L1-L30](apps/virtual-exchange/src/scheduler/series-data-scheduler.ts#L1-L30)

```typescript
// 调度器核心逻辑：FIFO 队列管理、作业调度、错误处理和退避机制
export class SeriesDataScheduler {
  private readonly jobQueue: Array<SeriesDataJob> = [];
  private readonly activeJobs = new Set<string>();
  private readonly maxConcurrentJobs: number;
  
  async scheduleJob(job: SeriesDataJob): Promise<void> {
    if (this.activeJobs.size >= this.maxConcurrentJobs) {
      this.jobQueue.push(job);
      return;
    }
    
    this.activeJobs.add(job.id);
    try {
      await this.executeJob(job);
    } finally {
      this.activeJobs.delete(job.id);
      this.processQueue();
    }
  }
  
  private async executeJob(job: SeriesDataJob): Promise<void> {
    // 执行数据拉取、范围合并等核心逻辑
  }
}
```

**影响范围**：
- 影响模块：`virtual-exchange` 的数据处理系统、`@yuants/exchange` 的 OHLC 写库
- 需要关注：新的调度器可能增加系统资源使用，需要监控队列长度和执行延迟
- 数据迁移：OHLC 表迁移到 `ohlc_v2`，移除冗余字段（datasource_id/product_id/duration）

**提交明细**：
- `c207831a3`: 添加系列数据处理的调度器逻辑，实现 FIFO 队列和作业管理
- `b5d152c9a`: 导入系列数据调度器到虚拟交换系统，集成到主应用流程

### 2.5 版本更新与文档维护

**相关提交**：`b3b28ea27`, `9a9860e5c`, `04b906f0d`
**作者**：humblelittlec1[bot] (2), Siyuan Wang (1)

**设计意图**：
维护项目版本号和更新相关文档，包括每日 Git 变更报告和版本 bump。这些是常规的维护性提交，确保项目版本管理的一致性和文档的及时更新。每日 Git 变更报告提供了代码变更的可追溯性，版本 bump 确保依赖管理和发布流程的规范性。

**核心代码**：
[git-changes-2025-12-25.json](docs/reports/git-changes-2025-12-25.json)

```json
{
  "range": {
    "old": "fd343ff16b60a0042b5b98078fc223238282699e",
    "new": "8333fea8b0c48e3e8b20f568ffb51d374e3004ba",
    "label": "fd343ff16..8333fea8b",
    "startDate": "2025-12-24",
    "endDate": "2025-12-24",
    "commitCount": 8,
    "generatedAt": "2025-12-25T06:20:32.689Z"
  }
}
```

**影响范围**：
- 影响模块：项目版本管理、文档系统、CI/CD 流程
- 需要关注：版本号更新可能影响依赖管理，需要确保所有相关包版本同步更新
- 文档维护：Git 变更报告提供历史追溯，有助于代码审查和问题排查

**提交明细**：
- `b3b28ea27`: 添加 2025-12-25 的每日 Git 变更报告，包含 8 个提交的详细分析
- `9a9860e5c`: 更新项目版本号，维护版本管理一致性
- `04b906f0d`: 更新项目版本号，确保依赖管理规范

### 提交覆盖检查

**本次报告涵盖的所有提交**：

| 序号 | Commit | 作者 | 主题 | 所属章节 |
|------|--------|------|------|----------|
| 1 | `97c65818e` | Siyuan Wang | feat: Implement host-based token bucket rate limiting for Aster public/private APIs (#2406) | 2.1 |
| 2 | `ffd1bf8bb` | Siyuan Wang | feat(vendor-binance): 更新统一订单API的速率限制配置并修复相关调用 (#2407) | 2.2 |
| 3 | `f7dac5d8b` | Siyuan Wang | fix(git-changes-reporter): 将 ES6 模块导入语法更改为 CommonJS 语法以提高兼容性 (#2408) | 2.3 |
| 4 | `b3b28ea27` | humblelittlec1[bot] | feat: add daily git change report for 2025-12-25 - 8 commits (#2409) | 2.5 |
| 5 | `c207831a3` | Siyuan Wang | feat: add scheduler logic for series data processing (#2410) | 2.4 |
| 6 | `9a9860e5c` | humblelittlec1[bot] | chore: bump version (#2411) | 2.5 |
| 7 | `b5d152c9a` | Siyuan Wang | feat(virtual-exchange): 导入系列数据调度器 (#2412) | 2.4 |
| 8 | `04b906f0d` | humblelittlec1[bot] | chore: bump version (#2413) | 2.5 |

> ✅ 确认：所有 8 个提交均已在上述章节中覆盖

## 3. 贡献者分析

| 作者 | 提交数 | 主要贡献领域 | 关键提交 |
|------|--------|--------------|----------|
| Siyuan Wang | 5 | API 速率限制优化、工具兼容性修复、数据调度器 | `97c65818e`, `ffd1bf8bb`, `f7dac5d8b` |
| humblelittlec1[bot] | 3 | 版本更新、文档维护 | `b3b28ea27`, `9a9860e5c`, `04b906f0d` |

## 4. 技术影响与风险

### 兼容性影响

- **API 变更**：2 个提交修改了 API 或接口定义（`97c65818e`, `ffd1bf8bb`）
  - Aster API 现在需要令牌桶令牌才能执行请求，调用方需要处理 `acquireSync` 抛出的令牌不足异常
  - Binance 统一订单 API 使用独立的速率限制桶 `order/unified/minute`，与普通 API 限流分离
  - 虚拟交换调度器新增了 `SeriesDataScheduler` 类和相关接口，需要集成到现有数据处理流程

### 配置变更

- **新增配置**：
  - `apps/vendor-aster/src/api/client.ts`：新增期货/现货 API 令牌桶配置（fapi.asterdex.com: 2400/min, sapi.asterdex.com: 6000/min）
  - `apps/vendor-binance/src/api/client.ts`：新增统一订单 API 令牌桶配置（order/unified/minute: 6000/min）
  - `apps/virtual-exchange/src/scheduler/series-data-scheduler.ts`：新增调度器配置（并发数、队列长度、退避策略）
  - `tools/sql-migration/sql/ohlc_v2.sql`：新增 OHLC 表迁移配置和索引

- **配置影响**：
  - 令牌桶配置需要根据交易所实际限流策略调整
  - 调度器配置需要根据数据量和系统资源调整
  - 数据库迁移需要确保数据一致性和索引性能

### 性能影响

- **积极影响**：
  - API 速率限制优化将减少 429 错误，提高 Aster 和 Binance API 调用的稳定性
  - 令牌桶机制提供更精细的流量控制，避免突发请求触发限流
  - 虚拟交换调度器提供更高效的数据处理，支持批量操作和并发控制

- **潜在影响**：
  - 令牌桶 `acquireSync` 调用增加微秒级延迟，高频 API 调用需要注意性能影响
  - 虚拟交换调度器可能增加内存和 CPU 使用，需要监控队列长度和执行延迟
  - 数据库迁移和索引变更可能影响查询性能，需要测试验证

- **监控建议**：
  - 监控令牌桶令牌消耗速率和等待队列
  - 监控调度器作业执行时间和成功率
  - 监控数据库查询性能和索引使用情况

### 测试覆盖

- **测试现状**：
  - Aster 速率限制已有最小单测覆盖 host 路由和条件权重（`private-api.rateLimit.test.ts`, `public-api.rateLimit.test.ts`）
  - Binance 统一订单 API 限流修复有相关变更记录但未见新增测试
  - 虚拟交换调度器实现未见单元测试文件
  - 版本更新和文档维护提交为自动化流程，无需额外测试

- **测试建议**：
  - 补充 Binance 统一订单 API 限流的单元测试，验证令牌桶选择和权重计算
  - 为虚拟交换调度器添加集成测试，验证作业调度和错误处理
  - 添加数据库迁移的回归测试，确保数据一致性和索引有效性
  - 建立 API 速率限制的性能测试，验证不同负载下的稳定性

---

**报告生成时间**：2025-12-26  
**数据来源**：docs/reports/git-changes-2025-12-26.json  
**工具版本**：git-changes-reporter 3.0.0