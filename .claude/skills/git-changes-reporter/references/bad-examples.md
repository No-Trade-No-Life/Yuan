# 不合格报告示例集

本文档收集常见的报告质量问题，帮助 Agent 识别并避免这些错误。

## 目录

1. [使用 JSON 行号作为 Commit ID](#1-使用-json-行号作为-commit-id)
2. [缺少代码片段](#2-缺少代码片段)
3. [设计意图仅描述"做了什么"](#3-设计意图仅描述做了什么)
4. [风险评估过于笼统](#4-风险评估过于笼统)
5. [缺少文件行号引用](#5-缺少文件行号引用)
6. [贡献者表格缺少关键提交列](#6-贡献者表格缺少关键提交列)

---

## 1. 使用 JSON 行号作为 Commit ID

### ❌ 错误示例

```markdown
### 2.1 API 请求优化与限速

- **关键提交**：`1279`, `703`, `856`
- **核心改动**：...
```

### 为什么错误

- `1279`、`703` 是 JSON 文件的行号，不是 commit ID
- JSON 文件结构变化后，这些数字会指向错误的 commit
- 无法通过行号查找 commit 历史

### ✅ 正确示例

```markdown
### 2.1 API 请求优化与限速

- **关键提交**：
  - [`b285cde59`](#b285cde59): 添加请求间隔处理以优化 Binance 数据请求
  - [`76802e0c0`](#76802e0c0): 添加请求间隔处理以优化 Aster 数据请求
- **核心改动**：...
```

### 如何修复

在 JSON 文件中查找 `"short"` 字段：

```json
{
  "hash": "b285cde59c6a9f7b3e5d4a2c1f8e9b7a6c5d4e3f",
  "short": "b285cde59",  // ← 使用这个作为 commit ID
  "author": "Siyuan Wang",
  ...
}
```

---

## 2. 缺少代码片段

### ❌ 错误示例

```markdown
### 2.1 API 请求优化与限速

- **核心改动**：
  - 新增 `getRequestIntervalMs()` 函数
  - 优化了请求间隔逻辑
  - 修改了 quote.ts 文件
```

### 为什么错误

- 读者无法直接看到核心逻辑
- 需要额外打开文件才能理解改动
- 缺少关键代码的行号定位

### ✅ 正确示例

````markdown
### 2.1 API 请求优化与限速

- **核心改动**：
  - [quote.ts:L65-L78](apps/vendor-binance/src/public-data/quote.ts#L65-L78)：新增 `getRequestIntervalMs()` 函数，动态计算安全请求间隔：
    ```typescript
    const getRequestIntervalMs = (rateLimits: IRateLimit[] | undefined, fallbackMs: number) => {
      const intervals: number[] = [];
      for (const item of rateLimits ?? []) {
        if (item.rateLimitType !== 'REQUEST_WEIGHT' && item.rateLimitType !== 'RAW_REQUESTS') continue;
        const duration = toIntervalMs(item.interval, item.intervalNum);
        const limit = item.limit;
        if (duration == null || limit == null || limit <= 0) continue;
        intervals.push(Math.ceil(duration / limit)); // ← 关键逻辑
      }
      return Math.max(fallbackMs, Math.max(...intervals));
    };
    ```
    该函数通过解析交易所的 `rateLimits` 配置，计算每个限速规则的最小间隔（duration/limit），
    然后取最大值作为安全间隔，确保不触发任何限速规则。
````

---

## 3. 设计意图仅描述"做了什么"

### ❌ 错误示例

```markdown
- **设计意图**：添加了 `getRequestIntervalMs` 函数用于计算请求间隔。
```

### 为什么错误

- 仅重复了代码中已经明显的信息
- 未解释为什么需要这个函数
- 未说明解决了什么问题或带来什么好处

### ✅ 正确示例

```markdown
- **设计意图**：交易所 API 有多种限速规则（按权重、按请求数等），硬编码间隔
  容易触发限速导致服务不稳定。通过动态解析 API 响应中的 `rateLimits` 配置，
  自动计算满足所有规则的最小安全间隔，实现了：
  1. **自适应限速**：不同交易所、不同接口的限速规则自动适配
  2. **最大吞吐**：在不触发限速的前提下使用最短间隔
  3. **代码复用**：该函数被 `futureRequestInterval$` 和 `spotRequestInterval$` 共享
```

### 判断标准

好的设计意图说明应该回答：

- 为什么需要这个改动？（解决什么问题）
- 这个改动如何解决问题？（方案选择理由）
- 这个改动的影响范围？（谁会用到）

---

## 4. 风险评估过于笼统

### ❌ 错误示例

```markdown
### 兼容性影响

- API 有变更，调用方需要注意
- 可能影响现有功能
```

### 为什么错误

- 未列出具体受影响的模块或服务
- 未说明具体需要做什么改动
- 未评估影响严重程度

### ✅ 正确示例

```markdown
### 兼容性影响

**高风险**：Bitget API 重构（`65358bffa`）

- **变更内容**：删除了 `src/services/accounts/futures.ts` 和 `spot.ts`，
  改用统一的 `account.ts`
- **受影响服务**：
  - `apps/trading-bot/src/strategies/bitget-arbitrage.ts`：依赖 `getFuturesAccount()`
  - `apps/risk-monitor/src/providers/bitget.ts`：依赖 `getSpotAccount()`
  - `apps/portfolio-tracker/src/integrations/bitget.ts`：同时使用两个接口
- **迁移要求**：
  - 修改导入路径：`from './accounts/futures'` → `from './accounts/account'`
  - 更新函数调用：`getFuturesAccount()` → `getAccount('futures')`
  - 无向后兼容层，**必须同步升级所有依赖服务**
- **测试建议**：在 staging 环境验证账户查询和下单流程

**中风险**：请求间隔优化（`b285cde59`, `76802e0c0`）

- **性能影响**：数据刷新频率可能降低 20-30%（取决于交易所限速规则）
- **业务影响**：高频交易策略可能需要调整参数
- **配置选项**：可通过环境变量 `REQUEST_INTERVAL_OVERRIDE` 强制使用旧间隔（仅用于紧急回退）
```

### 判断标准

好的风险评估应该包含：

- 风险级别（高/中/低）
- 具体受影响的文件/模块/服务
- 需要采取的行动
- 回退方案（如果有）

---

## 5. 缺少文件行号引用

### ❌ 错误示例

```markdown
- **核心改动**：
  - `apps/vendor-binance/src/public-data/quote.ts`：新增函数
  - `apps/vendor-aster/src/services/markets/quote.ts`：同样优化
```

### 为什么错误

- 读者需要手动打开文件并查找改动位置
- 无法快速跳转到具体代码
- 大文件中难以定位

### ✅ 正确示例

```markdown
- **核心改动**：
  - [quote.ts:L65-L78](apps/vendor-binance/src/public-data/quote.ts#L65-L78)：新增 `getRequestIntervalMs()` 函数
  - [quote.ts:L95-L106](apps/vendor-binance/src/public-data/quote.ts#L95-L106)：在 `futureRequestInterval$` 中使用新函数
  - [quote.ts:L220-L231](apps/vendor-binance/src/public-data/quote.ts#L220-L231)：在 `spotRequestInterval$` 中使用新函数
```

### 格式规范

正确的文件引用格式：

```markdown
[显示名称:L 起始行-L 结束行](完整路径#L起始行-L结束行)
```

示例：

```markdown
[terminal.ts:L138-L143](libraries/protocol/src/terminal.ts#L138-L143)
```

---

## 6. 贡献者表格缺少关键提交列

### ❌ 错误示例

```markdown
## 3. 贡献者分析

| 作者        | 提交数 | 主要领域           |
| ----------- | ------ | ------------------ |
| CZ          | 4      | API 优化、凭证管理 |
| Siyuan Wang | 3      | 接口重构           |
```

### 为什么错误

- 无法快速跳转到该作者的代表性提交
- 难以评估贡献的具体内容

### ✅ 正确示例

```markdown
## 3. 贡献者分析

| 作者                | 提交数 | 主要领域                     | 关键提交    |
| ------------------- | ------ | ---------------------------- | ----------- |
| CZ                  | 4      | API 优化、凭证管理、利率处理 | `9b9495d1e` |
| Siyuan Wang         | 3      | 接口重构、请求限速优化       | `65358bffa` |
| humblelittlec1[bot] | 5      | 版本发布自动化               | `c36262cad` |
```

### 如何选择关键提交

- 选择该作者改动最大的提交（按行数或文件数）
- 选择技术难度最高或最具代表性的提交
- 自动化提交（bot）可以选择最新的版本发布提交

---

## 总结检查清单

在提交报告前，确保：

- [ ] 所有 commit 引用使用短哈希（7 位十六进制），而非 JSON 行号
- [ ] 每个技术领域至少有一个代码片段（5-15 行）或文件引用
- [ ] 设计意图回答了"为什么"，至少 50 个汉字
- [ ] 风险评估具体列出了受影响的模块/服务
- [ ] 文件引用使用 `[name:L1-L10](path#L1-L10)` 格式
- [ ] 贡献者表格有四列：作者、提交数、主要领域、关键提交
- [ ] 所有 `<!-- TODO -->` 标记已移除

---

**提示**：使用 `validate-report.js` 自动检查这些问题：

```bash
node .claude/skills/git-changes-reporter/scripts/validate-report.js your-report.md
```
