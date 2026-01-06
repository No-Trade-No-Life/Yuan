# Git 变更报告（9b6f0cec2..f41c302e4）

## 1. 概览

- **时间范围**：2026-01-05 至 2026-01-05
- **提交数量**：2 个提交
- **主要贡献者**：Siyuan Wang (1), humblelittlec1[bot] (1)
- **热点目录**：apps (4 files), .legion (3 files), common (1 file)
- **生成时间**：2026-01-06T00:06:34.076Z

## 2. 核心变更

> ⚠️ **全覆盖要求**：此章节必须涵盖所有提交，不能遗漏任何一个 commit。

### 2.1 OKX OHLC 数据双写支持

**相关提交**：`50afccf76`
**作者**：Siyuan Wang

**设计意图**：
为 OKX 的 OHLC K 线数据添加对 `ohlc_v2` 表的双写支持，实现数据同步。当前 `publishChannel('ohlc')` 仅将数据写入旧表 `ohlc`，而新的 `ohlc_v2` 表采用归一化的 `series_id` 格式（移除 `%2F` 编码）。双写确保新读取侧（基于 `encodeOHLCSeriesId`）能直接命中数据，同时保持向后兼容。关键决策包括：1) 在写入 `ohlc_v2` 时对 legacy `series_id` 进行归一化处理，2) 在同一订阅链路内完成双写以避免额外连接开销，3) 复用现有 `bufferWriter` 的错误处理机制。

**核心代码**：
[ohlc.ts:L151-L206](apps/vendor-okx/src/public-data/ohlc.ts#L151-L206)

```typescript
const series_id_v2 = `${encodePath(datasource_id, instType, instId)}/${duration}`;
map(
  (x): IOHLCV2WriteRow => ({
    __origin: x,
    series_id: series_id_v2,
    created_at: x.created_at,
    closed_at: x.closed_at,
    open: x.open,
    high: x.high,
    low: x.low,
    close: x.close,
    volume: x.volume,
    open_interest: x.open_interest,
  }),
),
writeToSQL({
  tableName: 'ohlc_v2',
  columns: OHLC_V2_WRITE_COLUMNS,
  conflictKeys: ['series_id', 'created_at'],
  writeInterval: 1000,
  terminal,
}),
map((x) => x.__origin),
```

**影响范围**：

- 影响模块：`apps/vendor-okx` 的 OHLC 数据流
- 需要关注：双写会增加数据库写入负载，但复用现有 `bufferWriter` 机制，失败不会影响上游数据流
- 兼容性：旧表 `ohlc` 保持不变，新表 `ohlc_v2` 使用归一化的 `series_id` 格式

**提交明细**：

- `50afccf76`: 添加对 `ohlc_v2` 表的双写支持，更新 `publishChannel` 逻辑以实现数据同步

### 2.2 版本更新与变更日志维护

**相关提交**：`f41c302e4`
**作者**：humblelittlec1[bot]

**设计意图**：
自动化版本管理和变更日志更新，确保软件版本号与变更记录保持同步。在功能实现提交（`50afccf76`）之后，自动更新 `package.json` 版本号、生成 `CHANGELOG.json` 和 `CHANGELOG.md` 记录，并清理临时的变更文件。这是标准的 CI/CD 流程，确保发布版本包含完整的变更历史和正确的版本号。

**核心代码**：
[CHANGELOG.json:L4-L17](apps/vendor-okx/CHANGELOG.json#L4-L17)

```json
{
  "version": "0.31.10",
  "tag": "@yuants/vendor-okx_v0.31.10",
  "date": "Mon, 05 Jan 2026 07:03:01 GMT",
  "comments": {
    "patch": [
      {
        "comment": "double write ohlc to ohlc_v2 table"
      }
    ],
    "none": [
      {
        "comment": "Bump Version"
      }
    ]
  }
}
```

**影响范围**：

- 影响模块：`apps/vendor-okx` 的版本管理和文档
- 需要关注：版本号从 `0.31.9` 更新到 `0.31.10`，变更记录已同步更新
- 自动化流程：临时变更文件 `common/changes/@yuants/vendor-okx/2026-01-05-06-59.json` 已被清理

**提交明细**：

- `f41c302e4`: 更新版本号至 `0.31.10`，同步变更日志记录

### 提交覆盖检查

**本次报告涵盖的所有提交**：

| 序号 | Commit | 作者 | 主题 | 所属章节 |
|------|--------|------|------|----------|
| 1 | `50afccf76` | Siyuan Wang | feat: 添加对 ohlc_v2 表的双写支持，更新 publishChannel 逻辑以实现数据同步 (#2471) | 2.1 |
| 2 | `f41c302e4` | humblelittlec1[bot] | chore: bump version (#2472) | 2.2 |

> ✅ 确认：所有 2 个提交均已在上述章节中覆盖

## 3. 贡献者分析

| 作者 | 提交数 | 主要贡献领域 | 关键提交 |
|------|--------|--------------|----------|
| Siyuan Wang | 1 | 市场数据双写实现 | `50afccf76` |
| humblelittlec1[bot] | 1 | 版本管理与文档维护 | `f41c302e4` |

## 4. 技术影响与风险

### 兼容性影响

- **向前兼容**：旧表 `ohlc` 保持不变，现有读取逻辑不受影响
- **向后兼容**：新表 `ohlc_v2` 使用归一化的 `series_id` 格式，需要读取侧适配 `encodeOHLCSeriesId` 约定
- **数据一致性**：双写确保新旧表数据同步，但 `series_id` 格式不同（legacy vs 归一化）

### 配置变更

- **无新增配置**：双写逻辑硬编码在 `apps/vendor-okx/src/public-data/ohlc.ts` 中
- **环境变量**：当前实现无开关控制，如需回滚需代码回退

### 性能影响

- **数据库写入**：双写会增加约 100% 的写入量，但复用现有 `bufferWriter` 批量机制
- **网络开销**：在同一订阅链路内完成双写，无额外 WebSocket 连接开销
- **错误处理**：`bufferWriter` 机制确保写入失败不会影响上游数据流

### 测试覆盖

- **风险指标**：JSON 分析显示 `no_tests` 风险（中等）
- **验证建议**：需要补充最小验证脚本，确认同一批 OHLC 数据正确写入两张表
- **测试策略**：建议添加单元测试验证 `series_id` 归一化逻辑和字段映射正确性

---

**生成说明**：本报告基于 `docs/reports/git-changes-2026-01-06.json` 数据生成，遵循 git-changes-reporter skill 的三元组结构要求。