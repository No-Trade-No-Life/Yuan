# Git 变更报告模板

此模板用于指导 Agent 生成语义化 Markdown 报告。报告应基于 `generate-json.js` 生成的 JSON 数据，并结合实际代码分析。

## 报告结构

````markdown
# Git 变更报告（<range.label>）

## 1. 概览

- **时间范围**：<range.startDate> 至 <range.endDate>
- **提交数量**：<range.commitCount> 个提交
- **主要贡献者**：<前 3 位 contributors>
- **热点目录**：<前 3 个 topDirs>
- **生成时间**：<range.generatedAt>

## 2. 核心变更

> ⚠️ **全覆盖要求**：此章节必须涵盖所有提交，不能遗漏任何一个 commit。

### 2.1 <变更主题/领域名称>

**相关提交**：`<commit.short>`, `<commit.short>`
**作者**：<contributor.name>

**设计意图**：
<解释为什么做这个改动，业务背景，技术动机。至少 50 字。>

**核心代码**：
[file.ts:L42-L58](path/to/file.ts#L42-L58)

```typescript
// 选择最能体现设计意图的 5-15 行代码
const example = () => {
  // ...
};
```

**影响范围**：

- 影响模块：`module-a`, `module-b`
- 需要关注：<具体的注意事项>

**提交明细**：

- `<commit.short>`: <一句话描述这个 commit 做了什么>
- `<commit.short>`: <一句话描述这个 commit 做了什么>

### 2.2 <下一个变更主题>

...

### 提交覆盖检查

**本次报告涵盖的所有提交**（由脚本自动生成）：

| 序号 | Commit           | 作者     | 主题      | 所属章节 |
| ---- | ---------------- | -------- | --------- | -------- |
| 1    | `<commit.short>` | <author> | <subject> | 2.1      |
| 2    | `<commit.short>` | <author> | <subject> | 2.2      |
| ...  | ...              | ...      | ...       | ...      |

> ✅ 确认：所有 N 个提交均已在上述章节中覆盖

## 3. 贡献者分析

| 作者               | 提交数                | 主要贡献领域 | 关键提交         |
| ------------------ | --------------------- | ------------ | ---------------- |
| <contributor.name> | <contributor.commits> | <领域>       | `<commit.short>` |
| <contributor.name> | <contributor.commits> | <领域>       | `<commit.short>` |

## 4. 技术影响与风险

### 兼容性影响

- <描述兼容性变更，如 API 变更、配置格式变化>

### 配置变更

- <新增、修改或删除的配置项>

### 性能影响

- <可能影响性能的变更>

### 测试覆盖

- <新增或修改的测试文件>
- <测试策略变化>

---

## 语义聚类指南

### 领域分类标准

#### 错误处理与观测

- 异常处理逻辑变更
- 日志格式或级别调整
- 监控指标新增/修改
- 告警规则变更
- 健康检查改进

#### 安全与鉴权

- 认证机制变更
- 授权逻辑调整
- 加密算法更新
- 输入验证增强
- 安全头设置

#### 功能开发

- 新特性实现
- API 端点新增/修改
- 业务逻辑变更
- 用户界面改进
- 数据模型扩展

#### 重构与优化

- 代码结构重组
- 性能优化
- 内存使用改进
- 代码清理
- 依赖解耦

#### 运维与部署

- 配置管理变更
- 部署脚本更新
- CI/CD 流水线调整
- 文档更新
- 环境变量管理

#### 依赖更新

- 包版本升级
- 第三方库替换
- 依赖关系调整
- 构建工具变更

### 分析深度建议

#### Level 1：基础分析（快速概览）

- 仅基于 JSON 数据
- 统计信息汇总
- 目录热度分析
- 贡献者统计

#### Level 2：中级分析（团队同步）

- 查看关键提交的 patch
- 识别主要技术领域
- 评估风险等级
- 提供改进建议

#### Level 3：深度分析（代码审查）

- 查看实际代码文件
- 分析变更上下文
- 评估架构影响
- 提供详细建议

## 写作风格指南

### 文件引用格式

- 完整路径：`apps/vendor-aster/src/quote.ts`
- 带行号：`libraries/protocol/src/terminal.ts:138-143`
- IDE 链接格式：`[terminal.ts:138-143](libraries/protocol/src/terminal.ts#L138-L143)`

### 提交引用格式

- 短哈希：`03a48cfc4`
- 带主题：`03a48cfc4 (feat: enforce terminal_id...)`
- 带链接：`[03a48cfc4](https://github.com/owner/repo/commit/03a48cfc4)`
- 上下文引用：`在 03a48cfc4 中，CZ 改进了...`

**⚠️ 重要警告**：

- **绝对不要使用 JSON 文件的行号作为 commit ID**（例如：`1279`、`703` 等）
- JSON 文件中的行号（如 `1279`）只是文件位置，不是 commit 标识符
- 正确的 commit ID 在 JSON 的 `"short"` 字段中（如 `"a9300e76f"`）
- 错误示例：`1279`（行号） ❌
- 正确示例：`a9300e76f`（短哈希） ✅
- 引用务必完整

### 语气与表达

- **客观专业**：基于事实，避免主观判断
- **简明扼要**：使用短句和列表，避免冗长段落
- **聚焦意图**：解释"为什么"而不仅是"做了什么"
- **Actionable**：提供具体建议而非泛泛而谈

### 风险描述

- **高风险**：可能导致系统故障、数据丢失、安全漏洞
- **中风险**：可能影响功能、性能或用户体验
- **低风险**：轻微影响，易于修复

## 质量检查清单

生成报告后检查：

- [ ] 提交范围正确无误
- [ ] 每个技术领域有具体文件引用
- [ ] 贡献者分析完整准确
- [ ] 风险识别全面
- [ ] 建议具体可行
- [ ] 格式规范统一
- [ ] 链接可点击（在 IDE 环境中）
- [ ] 无拼写或语法错误
- [ ] **commit 引用使用正确的短哈希，而不是 JSON 行号，是否完整覆盖所有相关提交**

## 示例报告片段

### 概览示例

```markdown
## 1. 概览

- **时间范围**：2025-11-26 至 2025-12-02
- **提交数量**：32 个提交
- **主要贡献者**：CZ (16), humblelittlec1[bot] (11), Ryan (2)
- **热点目录**：apps (239 files), libraries (71 files), common (68 files)
- **生成时间**：2025-12-02T06:23:53.974Z
```
````

### 领域分析示例（含提交明细）

````markdown
### 2.1 Binance 请求间隔优化

**相关提交**：`b285cde59`, `76802e0c0`
**作者**：Siyuan Wang

**设计意图**：
通过动态计算 API 限速参数，自动调整请求间隔，避免触发交易所限速机制。
此前使用固定间隔 500ms，在高频场景下仍会触发限速；现在根据交易所返回的
rateLimits 配置动态计算安全间隔（duration/limit），确保稳定性。

**核心代码**：
[quote.ts:L65-L78](apps/vendor-binance/src/public-data/quote.ts#L65-L78)

```typescript
const getRequestIntervalMs = (rateLimits: IRateLimit[], fallbackMs: number) => {
  const intervals: number[] = [];
  for (const item of rateLimits ?? []) {
    if (item.rateLimitType !== 'REQUEST_WEIGHT') continue;
    const duration = toIntervalMs(item.interval, item.intervalNum);
    const limit = item.limit;
    if (duration == null || limit == null) continue;
    intervals.push(Math.ceil(duration / limit));
  }
  return Math.max(fallbackMs, Math.max(...intervals));
};
```
````

**影响范围**：

- 影响模块：`vendor-binance`, `vendor-aster`（使用相同模式）
- 期货和现货数据流均受益

**提交明细**：

- `b285cde59`: 添加 getRequestIntervalMs 函数动态计算 Binance 期货/现货请求间隔
- `76802e0c0`: 将相同的请求间隔优化逻辑应用到 Aster vendor

````

### 提交覆盖检查示例

```markdown
### 提交覆盖检查

**本次报告涵盖的所有提交**：

| 序号 | Commit | 作者 | 主题 | 所属章节 |
|------|--------|------|------|----------|
| 1 | `b285cde59` | Siyuan Wang | feat: add request interval for binance | 2.1 |
| 2 | `76802e0c0` | Siyuan Wang | feat: add request interval for aster | 2.1 |
| 3 | `03a48cfc4` | CZ | feat: enforce terminal_id derivation | 2.2 |
| 4 | `c36262cad` | bot | chore: bump version to 1.2.0 | 2.3 |

> ✅ 确认：所有 4 个提交均已在上述章节中覆盖
````

---

## 关键要求

### 1. 三元组结构

每个核心变更**必须**包含以下三部分：

1. **设计意图**：

   - **必须**回答"为什么做这个改动"
   - **禁止**仅描述"做了什么"
   - 至少 50 个字符的实质性内容
   - 包含业务背景、技术动机

2. **核心代码**：

   - **必须**包含代码片段或带行号的文件引用
   - 代码片段长度：5-15 行
   - **选择标准**：最能体现设计意图的代码，而非随机选取
   - 使用语法高亮的代码块

3. **影响范围**：
   - 列出影响的模块/服务
   - 说明需要关注的事项
   - 标注兼容性影响（如有）

### 2. 引用格式

**文件引用**：`[file.ts:L42-L58](path/to/file.ts#L42-L58)`

**Commit 引用**：使用 JSON 中的 `short` 字段（如 `a9300e76f`），而非行号

### 3. 全覆盖原则

**核心变更章节必须涵盖所有提交**，不能遗漏任何一个 commit。

**组织方式**：

- 将相关提交按领域/主题聚类
- 每个主题下列出所有相关提交的一句话摘要（格式：`commit_hash: 做了什么`）
- 使用"提交覆盖检查"表格确认所有提交都已覆盖

**展示优先级**（决定详细程度，不是是否包含）：

1. **Breaking changes**：详细展示，包含代码片段
2. **新功能**：详细展示，包含代码片段
3. **重要修复**：中等详细，包含文件引用
4. **架构变更**：中等详细，包含影响分析
5. **次要变更**（版本号、文档、CHANGELOG）：简要列出，一句话摘要即可

> ⚠️ 注意：所有提交都必须在报告中出现，只是详细程度不同
