# Git 变更报告（38bf668bd..57eb64f3f）

## 1. 概览

- **时间范围**：2025-12-29 至 2025-12-30
- **提交数量**：5 个提交
- **主要贡献者**：CZ (3), humblelittlec1[bot] (2)
- **热点目录**：apps (46 files), libraries (40 files), common (24 files)
- **生成时间**：2025-12-30T00:06:14.740Z

## 2. 核心变更

> ⚠️ **全覆盖要求**：此章节必须涵盖所有提交，不能遗漏任何一个 commit。

### 2.1 SQL v2 流式结果与 Forwards OHLC 数据收集器

**相关提交**：`cc55da276`, `e025bb65c`
**作者**：CZ, humblelittlec1[bot]

**设计意图**：
实现 SQL v2 服务以支持流式结果返回，解决大数据量查询时的内存压力问题。新增 Forwards OHLC 数据收集器，用于定期扫描所有 Terminal 的 ServiceInfo，提取支持 Forwards 拉取的序列，并向对应的 IngestOHLC Service 发送拉取请求以补齐历史数据。使用 Token Bucket 控制每个数据源的请求速率，避免过载。

**核心代码**：
[apps/postgres-storage/src/index.ts:L102-L140](apps/postgres-storage/src/index.ts#L102-L140)

```typescript
async function* (msg, { isAborted$ }) {
  console.info(formatTime(Date.now()), 'SQL REQUEST', msg.trace_id);
  const startTime = Date.now();
  const source_terminal_id = msg.source_terminal_id || 'unknown';
  const query = sql.unsafe(msg.req.query);

  from(isAborted$)
    .pipe(
      first((x) => x),
      tap(() => {
        console.info(formatTime(Date.now()), 'SQL ABORTED', msg.trace_id);
        query.cancel();
      }),
    )
    .subscribe();

  try {
    const cursor = query.cursor(1000);
    for await (const rows of cursor) {
      yield { frame: { data: rows } };
    }
    totalSuccess.inc();
    return { res: { code: 0, message: 'OK' } };
  } catch (e) {
    const duration = Date.now() - startTime;
    console.error(formatTime(Date.now()), 'SQL ERROR', msg.trace_id, e);
    totalError.inc();
    durationWhenError.observe(duration);
    throw e;
  }
}
```

**影响范围**：

- 影响模块：`apps/postgres-storage`, `apps/virtual-exchange`, `libraries/data-ohlc`
- 需要关注：SQL v2 服务使用游标方式返回结果，客户端需要使用 `for await` 进行迭代
- 新增的 Forwards OHLC 收集器会定期扫描所有 Terminal，可能增加系统负载

**提交明细**：

- `cc55da276`: 实现 SQL v2 服务支持流式结果返回，并添加 Forwards OHLC 数据收集器
- `e025bb65c`: 更新相关包的版本号，反映 SQL v2 和 Forwards OHLC 功能变更

### 2.2 Forwards 利率数据收集器集成

**相关提交**：`fbb62b881`, `f757624f2`
**作者**：CZ, humblelittlec1[bot]

**设计意图**：
扩展系列收集器功能，新增 Forwards 利率数据收集器。该模块定期扫描所有 Terminal 的 ServiceInfo，提取支持 Forwards 拉取的利率序列，并向对应的 IngestInterestRate Service 发送拉取请求以补齐历史数据。同样使用 Token Bucket 控制每个数据源的请求速率，确保系统稳定性。

**核心代码**：
[apps/virtual-exchange/src/series-collector/forwards-interest-rate.ts:L88-L119](apps/virtual-exchange/src/series-collector/forwards-interest-rate.ts#L88-L119)

```typescript
const res = await terminal.client.requestForResponseData<
  IIngestInterestRateRequest,
  ISeriesIngestResult
>('IngestInterestRate', req);

terminal.metrics
  .counter('series_collector_forwards_ingest_count', '')
  .labels({ terminal_id: terminal.terminal_id, type: 'interest_rate' })
  .inc(res.wrote_count || 0);

console.info(
  formatTime(Date.now()),
  'DispatchIngestInterestRateResultForwards',
  `series_id=${product_id}, ingested_count=${res.wrote_count}, start_time=${formatTime(
    res.range?.start_time ?? NaN,
  )}, end_time=${formatTime(res.range?.end_time ?? NaN)}`,
);
```

**影响范围**：

- 影响模块：`apps/virtual-exchange`
- 需要关注：新增的利率数据收集器会定期运行，可能增加对 IngestInterestRate 服务的调用频率
- 监控指标新增 `series_collector_forwards_ingest_count` 用于跟踪利率数据收集情况

**提交明细**：

- `fbb62b881`: 添加 Forwards 利率数据收集器并集成到系列收集器中
- `f757624f2`: 更新虚拟交换应用版本号，反映利率数据收集器功能变更

### 2.3 ProductDataUnit 重构与代码清理

**相关提交**：`57eb64f3f`
**作者**：CZ

**设计意图**：
移除 ProductDataUnit 及相关代码，简化系统架构。ProductDataUnit 原本用于管理品种信息，但其功能可以通过直接查询数据库实现。重构后，AccountInfoUnit、AccountSimulatorUnit、OrderMatchingUnit 等单元不再依赖 ProductDataUnit，简化了依赖关系。同时更新利润和保证金计算逻辑以处理 null product 情况，并重构 SQL 查询以针对新的 `series_data_range` 表获取 OHLC 数据。

**核心代码**：
[libraries/kernel/src/units/AccountInfoUnit.ts:L200-L212](libraries/kernel/src/units/AccountInfoUnit.ts#L200-L212)

```typescript
const used =
  getMargin(
    null,
    position.position_price,
    position.volume,
    position.direction!,
    theAccountInfo.money.currency,
    (product_id) => this.quoteDataUnit.getQuote(accountId, product_id),
  ) / (theAccountInfo.money.leverage ?? 1) || 0;
theAccountInfo.money.used +=
  used - (this.mapAccountIdToPositionIdToUsed[accountId][position.position_id] || 0);
this.mapAccountIdToPositionIdToUsed[accountId][position.position_id] = used;
```

**影响范围**：

- 影响模块：`libraries/agent`, `libraries/kernel`, `distributions/origin`, `ui/web`
- 需要关注：`getMargin` 和 `getProfit` 函数现在接受 `null` 作为 product 参数
- 移除的 Hook：`useProduct` 不再可用，相关代码需要调整
- SQL 查询变更：OHLC 数据查询从 `ohlc` 表改为 `ohlc_v2` 表，并通过 `series_data_range` 表获取数据范围

**提交明细**：

- `57eb64f3f`: 移除 ProductDataUnit 及相关代码，简化依赖关系并更新 OHLC 数据查询逻辑

### 提交覆盖检查

**本次报告涵盖的所有提交**：

| 序号 | Commit | 作者 | 主题 | 所属章节 |
|------|--------|------|------|----------|
| 1 | `cc55da276` | CZ | feat: implement SQL v2 service with streaming results and add forwards OHLC data collector (#2425) | 2.1 |
| 2 | `e025bb65c` | humblelittlec1[bot] | chore: bump version (#2426) | 2.1 |
| 3 | `fbb62b881` | CZ | feat: add forwards interest rate data collector and integrate into series collector (#2427) | 2.2 |
| 4 | `f757624f2` | humblelittlec1[bot] | chore: bump version (#2428) | 2.2 |
| 5 | `57eb64f3f` | CZ | refactor: remove ProductDataUnit and related code (#2430) | 2.3 |

> ✅ 确认：所有 5 个提交均已在上述章节中覆盖

## 3. 贡献者分析

| 作者 | 提交数 | 主要贡献领域 | 关键提交 |
|------|--------|--------------|----------|
| CZ | 3 | 功能开发、架构重构 | `cc55da276`, `fbb62b881`, `57eb64f3f` |
| humblelittlec1[bot] | 2 | 版本管理、依赖更新 | `e025bb65c`, `f757624f2` |

## 4. 技术影响与风险

### 兼容性影响

- **API 变更**：SQL v2 服务引入新的流式结果返回方式，客户端需要适配 `for await` 迭代模式
- **Hook 移除**：`useProduct` Hook 被移除，相关代码需要调整
- **数据表变更**：OHLC 数据查询从 `ohlc` 表迁移到 `ohlc_v2` 表，相关查询需要更新

### 配置变更

- **新增依赖**：`@yuants/data-ohlc` 库新增对 `@yuants/utils` 的依赖
- **版本更新**：多个应用和库的版本号更新，反映功能变更

### 性能影响

- **内存优化**：SQL v2 的流式结果返回减少了大查询的内存压力
- **负载增加**：新增的 Forwards OHLC 和利率数据收集器会定期运行，可能增加系统负载
- **查询优化**：使用 `series_data_range` 表优化 OHLC 数据范围查询

### 测试覆盖

- **风险提示**：JSON 分析显示存在"无测试"风险，功能变更未见测试文件更新
- **建议**：新增的 SQL v2 服务和数据收集器功能需要补充测试用例

### 架构影响

- **简化依赖**：移除 ProductDataUnit 简化了多个核心单元的依赖关系
- **代码清理**：清理了未使用的导入和注释代码，提高代码可读性
- **统一数据访问**：OHLC 数据访问统一到 `ohlc_v2` 表和 `series_data_range` 表