# Git 变更报告（5ca622abc..4f7fdb73f）

## 1. 概览

- **时间范围**：2026-01-13 至 2026-01-13
- **提交数量**：3 个提交
- **主要贡献者**：CZ (1), Ryan (1), humblelittlec1[bot] (1)
- **热点目录**：apps (46 files), common (11 files), libraries (4 files)
- **生成时间**：2026-01-14T00:06:32.101Z

## 2. 核心变更

> ⚠️ **全覆盖要求**：此章节必须涵盖所有提交，不能遗漏任何一个 commit。

### 2.1 利息账本系列处理与补丁间隙功能

**相关提交**：`6563ef37b`
**作者**：CZ

**设计意图**：
添加利息账本系列处理功能，支持向前和向后数据采集，并实现数据间隙检测与补丁机制。该功能旨在解决交易所账户利息数据采集中的时间间隙问题，确保数据完整性。通过统一的 SQL 辅助函数重构现有补丁逻辑，减少代码重复，提高维护性。利息账本系列支持多种交易所类型（HTX、BITGET、ASTER、BINANCE等），并自动处理凭证验证和数据范围管理。

**核心代码**：
[interest-ledger.ts:L75-L123](apps/virtual-exchange/src/series-collector/interest-ledger.ts#L75-L123)

```typescript
export const handleIngestInterestLedgerForward = async (
  series_id: string,
  direction: 'forward' | 'backward',
  signal: AbortSignal,
) => {
  const { account_id, ledger_type } = decodeInterestLedgerSeriesId(series_id);

  const credential = await getCredentialByCredentialId(account_id);
  if (!credential) throw newError('CREDENTIAL_NOT_FOUND_WHEN_HANDLING_INGEST', { account_id });

  let req: IIngestInterestLedgerRequest;

  if (direction === 'forward') {
    const endTime = await findForwardTaskLastEndTime(terminal, series_id, 'account_interest_ledger');
    const time = endTime ? new Date(endTime).getTime() : 0;
    req = {
      account_id,
      direction,
      time,
      ledger_type,
      credential,
    };
  } else {
    req = {
      account_id,
      direction,
      time: Date.now(),
      ledger_type,
      credential,
    };
  }

  const res = await terminal.client.requestForResponseData<IIngestInterestLedgerRequest, ISeriesIngestResult>(
    'IngestInterestLedger',
    req,
  );

  ingestCounter.labels({ task: 'forward' }).inc(res.wrote_count || 0);
};
```

**影响范围**：

- 影响模块：`apps/virtual-exchange`、`apps/vendor-aster`、`apps/vendor-binance`、`apps/vendor-bitget`、`apps/vendor-gate`、`apps/vendor-huobi`、`apps/vendor-okx`
- 需要关注：利息账本数据采集的完整性，凭证验证机制，数据间隙处理逻辑

**提交明细**：

- `6563ef37b`: feat: add interest ledger series handling and patch gap functionality (#2497)

### 2.2 交易所利息账本服务修复与优化

**相关提交**：`12ce55f61`
**作者**：Ryan

**设计意图**：
修复多个交易所利息账本服务的 API 请求参数和时间窗口问题，优化数据采集的稳定性和效率。针对不同交易所（ASTER、BINANCE、BITGET、GATE、HUOBI、OKX）调整请求时间窗口和参数验证逻辑，防止因时间范围过大导致的 API 错误或数据遗漏。统一错误处理机制，增强服务健壮性，确保利息数据采集的连续性和准确性。

**核心代码**：
[interest-ledger-service.ts:L22-L48](apps/vendor-aster/src/services/interest-ledger-service.ts#L22-L48)

```typescript
const fetchInterestRateLedgerForward = async (req: {
    const time = Math.max(req.time, Date.now() - 3600_000 * 24 * 88);
    const params = {
      startTime: time,
      endTime: time + WINDOW_MS,
      limit: 500,
    };
    const res = await client.getAccountIncome(params);
    if (!Array.isArray(res)) {
      throw new Error('getAccountIncome failed');
    }
    return res
      .filter((x) => Date.parse(x.created_at!) >= time);
```

**影响范围**：

- 影响模块：`apps/vendor-aster`、`apps/vendor-binance`、`apps/vendor-bitget`、`apps/vendor-gate`、`apps/vendor-huobi`、`apps/vendor-okx`
- 需要关注：交易所 API 限流策略，时间窗口参数调整，错误处理机制

**提交明细**：

- `12ce55f61`: fix (#2499)

### 2.3 版本更新与变更日志维护

**相关提交**：`4f7fdb73f`
**作者**：humblelittlec1[bot]

**设计意图**：
自动化版本更新流程，统一管理多个包的版本号和变更日志。根据之前的变更记录（CHANGELOG.json 文件），自动更新 package.json 版本号并生成对应的 CHANGELOG.md 文件。确保版本管理的一致性，减少手动更新错误，为发布流程提供标准化的变更记录。

**核心代码**：
[CHANGELOG.json:L4-L22](apps/vendor-aster/CHANGELOG.json#L4-L22)

```json
{
  "version": "0.10.4",
  "tag": "@yuants/vendor-aster_v0.10.4",
  "date": "Tue, 13 Jan 2026 10:53:40 GMT",
  "comments": {
    "patch": [
      {
        "comment": "fix"
      }
    ],
    "none": [
      {
        "comment": "Bump Version"
      }
    ],
    "dependency": [
      {
        "comment": "Updating dependency \"@yuants/exchange\" to `0.8.15`"
      }
    ]
  }
}
```

**影响范围**：

- 影响模块：`apps/vendor-aster`、`apps/vendor-binance`、`apps/vendor-bitget`、`apps/vendor-gate`、`apps/vendor-huobi`、`apps/vendor-hyperliquid`、`apps/vendor-okx`、`apps/vendor-trading-view`、`apps/vendor-turboflow`、`apps/virtual-exchange`、`libraries/exchange`
- 需要关注：版本号同步，依赖关系更新，变更日志格式一致性

**提交明细**：

- `4f7fdb73f`: chore: bump version (#2500)

### 提交覆盖检查

**本次报告涵盖的所有提交**：

| 序号 | Commit | 作者 | 主题 | 所属章节 |
|------|--------|------|------|----------|
| 1 | `6563ef37b` | CZ | feat: add interest ledger series handling and patch gap functionality (#2497) | 2.1 |
| 2 | `12ce55f61` | Ryan | fix (#2499) | 2.2 |
| 3 | `4f7fdb73f` | humblelittlec1[bot] | chore: bump version (#2500) | 2.3 |

> ✅ 确认：所有 3 个提交均已在上述章节中覆盖

## 3. 贡献者分析

| 作者 | 提交数 | 主要贡献领域 | 关键提交 |
|------|--------|--------------|----------|
| CZ | 1 | 利息账本系列处理与补丁功能 | `6563ef37b` |
| Ryan | 1 | 交易所利息账本服务修复 | `12ce55f61` |
| humblelittlec1[bot] | 1 | 版本更新与变更日志维护 | `4f7fdb73f` |

## 4. 技术影响与风险

### 兼容性影响

- 新增 `IExchangeCredential` 接口到 `apps/virtual-exchange/src/types.ts`，影响凭证处理相关代码
- SQL 辅助函数重构（`findPatchGap` 等）统一了 OHLC、利率和利息账本的间隙检测逻辑
- 交易所利息账本服务参数调整可能影响历史数据采集的时间范围

### 配置变更

- `apps/virtual-exchange/tsconfig.json` 添加 `"lib": ["ESNext"]` 配置
- 多个交易所的利息账本服务调整时间窗口参数（WINDOW_MS 等）

### 性能影响

- 利息账本系列处理添加了数据间隙检测和补丁机制，可能增加数据库查询负载
- 统一的 SQL 辅助函数减少了代码重复，提高维护性但可能增加函数调用开销

### 测试覆盖

- 未见测试文件更新，建议为新增的利息账本功能添加单元测试
- 建议为 SQL 辅助函数添加集成测试，确保间隙检测逻辑正确性

---

**报告生成时间**：2026-01-14