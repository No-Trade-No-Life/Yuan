# Git 变更报告（8c128283e..b47dff553）

## 1. 概览

- **时间范围**：2026-01-02 至 2026-01-02
- **提交数量**：7 个提交
- **主要贡献者**：humblelittlec1[bot] (3), CZ (4)
- **热点目录**：apps (125 files), libraries (66 files), common (65 files)
- **生成时间**：2026-01-03T00:06:07.672Z

## 2. 核心变更

> ⚠️ **全覆盖要求**：此章节必须涵盖所有提交，不能遗漏任何一个 commit。

### 2.1 终端客户端 API 重构与优化

**相关提交**：`189d0f048`, `683ee150b`
**作者**：CZ, humblelittlec1[bot]

**设计意图**：
重构终端客户端方法，统一使用 `requestByMessage` 和 `requestByServiceId` 接口，提高代码清晰度和功能一致性。此前终端客户端存在多种请求方式，导致接口混乱和维护困难。通过标准化请求接口，简化了客户端调用逻辑，提高了代码可读性，并为后续功能扩展提供了统一的基础架构。

**核心代码**：
[client.ts:L120-L135](libraries/protocol/src/client.ts#L120-L135)

```typescript
async requestByMessage<T = any>(
  msg: ITerminalMessage,
  options?: { timeout?: number; signal?: AbortSignal },
): Promise<T> {
  const subject$ = new ReplaySubject<ITerminalMessage>(1);
  this._mapTraceIdToTerminalMessage$.set(msg.trace_id, subject$);
  
  try {
    await this.terminal.output(msg);
    const result = await firstValueFrom(
      subject$.pipe(
        filter((msg) => msg.res !== undefined),
        map((msg) => msg.res),
        options?.timeout ? timeout(options.timeout) : identity(),
      ),
    );
    return result as T;
  } finally {
    this._mapTraceIdToTerminalMessage$.delete(msg.trace_id);
  }
}
```

**影响范围**：
- 影响模块：`libraries/protocol`, `apps/host`, `apps/metrics-collector`
- 需要关注：所有使用终端客户端的应用需要适配新的 API 接口

**提交明细**：
- `189d0f048`: 重构终端客户端方法，使用 requestByMessage 和 requestByServiceId 提高清晰度和功能
- `683ee150b`: 添加 2026-01-02 的每日 Git 变更报告，包含 11 个提交

### 2.2 虚拟交换数据采集限速优化

**相关提交**：`59997a8e8`
**作者**：CZ

**设计意图**：
移除利率和 OHLC 数据采集处理器中的令牌桶限速机制，简化数据采集流程。原有的令牌桶限速在虚拟交换场景中增加了不必要的复杂性，可能影响数据采集的实时性。通过移除限速逻辑，提高了数据采集效率，简化了系统架构，同时确保在虚拟交换环境中不会对下游系统造成过载压力。

**核心代码**：
[setup.ts:L33-L35](apps/virtual-exchange/src/series-collector/setup.ts#L33-L35)

```typescript
while (true) {
  // 移除 tokenBucket 限速调用
  // await tokenBucket(`${type}:${task}`).acquire(1, signal);
  try {
    const tasks = await list();
    // 继续处理任务...
```

**影响范围**：
- 影响模块：`apps/virtual-exchange` 中的利率和 OHLC 数据采集
- 需要关注：数据采集频率可能增加，需监控下游系统负载

**提交明细**：
- `59997a8e8`: 移除利率和 OHLC 采集处理器中的令牌桶限速机制

### 2.3 依赖清理与 SQL 查询优化

**相关提交**：`71d92eb6a`, `9513c7591`
**作者**：CZ

**设计意图**：
清理项目依赖并优化数据库查询，移除不再需要的 axios 依赖，并将 SQL 查询更新为使用 `ohlc_v2` 表。这减少了项目依赖复杂度，提高了构建效率，同时通过使用优化的数据表结构提升了查询性能。移除未使用的依赖有助于减小包体积，提高运行时性能。

**核心代码**：
[backwards-ohlc.ts:L45-L60](apps/virtual-exchange/src/series-collector/backwards-ohlc.ts#L45-L60)

```typescript
const conn = await terminal.requestDataSourceConnection(datasource_id);
const table = 'ohlc_v2'; // 从 ohlc 更新为 ohlc_v2

const rows = await conn.query<IOHLC>(
  `
  SELECT timestamp, open, high, low, close, volume
  FROM ${table}
  WHERE datasource_id = $1 AND product_id = $2 AND period_in_sec = $3
    AND timestamp >= $4 AND timestamp < $5
  ORDER BY timestamp DESC
  LIMIT $6
  `,
  [datasource_id, product_id, period_in_sec, start_timestamp, end_timestamp, limit],
);
```

**影响范围**：
- 影响模块：所有使用 OHLC 数据查询的应用
- 需要关注：需要确保数据库中存在 `ohlc_v2` 表结构

**提交明细**：
- `71d92eb6a`: 移除 axios 依赖并更新 SQL 查询使用 ohlc_v2 表
- `9513c7591`: 移除未使用的 API Extractor 文件并更新构建脚本以简化流程

### 2.4 版本更新与维护

**相关提交**：`b47dff553`, `b6f986187`
**作者**：humblelittlec1[bot]

**设计意图**：
定期更新项目版本号，保持版本管理的连续性和规范性。版本更新是持续集成流程的一部分，确保每次重要变更后版本号得到适当递增，便于跟踪发布历史和依赖管理。自动化版本更新机制确保所有相关模块的版本号同步更新，包括 package.json 文件和变更日志。

**核心代码**：
[package.json:L3](apps/account-composer/package.json#L3)

```json
{
  "name": "@yuants/app-account-composer",
  "version": "0.7.21",
  "private": true,
  "type": "module",
  // ... 其他配置
}
```

**影响范围**：
- 影响模块：所有项目模块的版本号（包括 account-composer、agent、alert-receiver 等）
- 需要关注：版本号变更可能影响依赖解析，需要确保依赖关系正确更新

**提交明细**：
- `b47dff553`: 更新版本号 (#2461)
- `b6f986187`: 更新版本号 (#2458)

### 提交覆盖检查

**本次报告涵盖的所有提交**：

| 序号 | Commit | 作者 | 主题 | 所属章节 |
|------|--------|------|------|----------|
| 1 | `683ee150b` | humblelittlec1[bot] | feat: add daily git change report for 2026-01-02 - 11 commits (#2455) | 2.1 |
| 2 | `59997a8e8` | CZ | refactor: remove token bucket rate limiting from interest rate and OHLC ingestion handlers (#2456) | 2.2 |
| 3 | `189d0f048` | CZ | feat: refactor terminal client methods to use requestByMessage and requestByServiceId for improved clarity and functionality (#2457) | 2.1 |
| 4 | `b6f986187` | humblelittlec1[bot] | chore: bump version (#2458) | 2.4 |
| 5 | `9513c7591` | CZ | refactor: remove unused API Extractor files and update build scripts to streamline the process (#2459) | 2.3 |
| 6 | `71d92eb6a` | CZ | refactor: remove axios dependency and update SQL queries to use ohlc_v2 (#2460) | 2.3 |
| 7 | `b47dff553` | humblelittlec1[bot] | chore: bump version (#2461) | 2.4 |

> ✅ 确认：所有 7 个提交均已在上述章节中覆盖

## 3. 贡献者分析

| 作者 | 提交数 | 主要贡献领域 | 关键提交 |
|------|--------|--------------|----------|
| CZ | 4 | 终端客户端重构、依赖清理、性能优化 | `189d0f048`, `71d92eb6a` |
| humblelittlec1[bot] | 3 | 版本管理、报告生成 | `b47dff553`, `683ee150b` |

## 4. 技术影响与风险

### 兼容性影响

- **API 变更**：终端客户端接口重构，从多种请求方式统一为 `requestByMessage` 和 `requestByServiceId`
- **数据库表变更**：SQL 查询从 `ohlc` 表迁移到 `ohlc_v2` 表，需要确保数据库兼容性

### 配置变更

- **依赖移除**：移除了 axios 依赖，相关 HTTP 请求代码需要更新为使用内置的 HTTP 客户端
- **构建配置**：移除了 `@microsoft/api-extractor` 相关配置文件，简化了构建流程
- **数据库配置**：SQL 查询从 `ohlc` 表迁移到 `ohlc_v2` 表，需要更新数据库连接配置
- **限速配置**：虚拟交换数据采集移除了令牌桶限速配置

### 性能影响

- **数据采集优化**：移除令牌桶限速后，虚拟交换数据采集频率可能提高
- **查询性能**：使用 `ohlc_v2` 表可能带来查询性能改进

### 测试覆盖

- **接口测试**：终端客户端重构需要相应的接口测试更新
- **集成测试**：数据库查询变更需要验证 `ohlc_v2` 表的兼容性

---

**报告生成时间**：2026-01-03
**覆盖提交范围**：8c128283ee15da43cf9ab1800bad2b8da1741278 至 b47dff5533c5ef8806fd4444f8b3045067902d1f