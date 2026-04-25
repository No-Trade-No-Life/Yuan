# RFC：signal-trader 独立前端 capital 同步

## 背景 / 问题

- `signal-trader` 后端近几轮已经补齐资本系统的关键能力：`funding_account`、`trading_account`、`precision_locked_amount`、`investor` / `signal` 聚合查询、formal quote source、internal netting 证据、account-scoped `profit_target_reached` advisory，以及更细的 reconciliation `difference` / `tolerance` / `explanation`。
- 但独立前端 `ui/signal-trader-web` 的阅读心智仍以早期控制台为主：虽然已有 runtime、health、projection、event、audit 面板，但 capital 相关信息还没有被收敛成一套稳定的信息架构与类型同步策略，用户仍容易回退到“看 JSON / 翻事件流”的排障方式。
- 本任务不是再造一个新产品，而是在既有独立控制台上完成前端同步：把 capital / investor / signal / formal quote / advisory / reconciliation explanation 变成默认可读的控制面，同时保持高风险控制台的产品化风格。

## 目标与非目标

### 目标

- 同步 `ui/signal-trader-web` 的前端类型与读取 API，使其覆盖后端当前已提供的 capital 字段与聚合 projection。
- 在单页工作区内形成稳定阅读顺序：先看 capital posture，再看 evidence/advisory，再下钻 raw projection / event / audit。
- 明确展示以下能力，且不要求用户先读原始 JSON 才能理解：
  - capital 分层：`released_vc_total`、`funding_account`、`trading_account`、`precision_locked_amount`
  - investor 聚合
  - signal 聚合
  - formal quote source
  - internal netting 证据
  - profit target advisory
  - reconciliation `difference` / `tolerance` / `explanation`
- 保持写区 fail-close：前端不生成、不回传、也不信任 `reference_price*`，正式价格证据继续由后端 worker 注入。
- 保持独立前端产品化控制台风格，不退化成“原始 JSON 面板墙”。

### 非目标

- 不修改后端协议、不新增 command、不扩展 `SignalTrader/*` 服务契约。
- 不重构成多路由应用，不引入新的全局状态框架。
- 不新增 capital 图表、时间序列分析、导出报表等 scope 外能力。
- 不把前端升级为资本真相来源；前端只做读取、聚合展示与写入护栏。

## 定义 / 假设

- `capital 视图`：subscription 级资本分层摘要，强调 released / funding / trading / precision lock 的关系，而不是完整总账。
- `evidence 视图`：从 event stream / audit log 中抽取的 formal quote、internal netting、advisory、quote fail-close 诊断摘要。
- `raw 视图`：保留 `ProjectionCard`、event stream、audit log，作为可深查的底层证据面。

假设：

- 既有独立前端的技术底座继续有效：`src/app.tsx` 维持单页结构，`src/api.ts` 统一请求，`src/types.ts` 承担 DTO，同步策略优先“宽读 + 保守写 gate”。
- 后端 `QueryProjection` 已支持 `product` / `subscription` / `reconciliation` / `investor` / `signal` 五类读取；本轮不额外申请新 query。
- formal quote、internal netting 与 advisory 的前端展示继续以事件/审计抽取为主，不要求后端再额外提供专门 summary API。

## 前端信息架构

### 页面结构

- 左侧继续保留 `Runtime Rail`：用于选择 runtime、搜索、确认当前工作区主键。
- 主工作区保持两列，但阅读顺序固定为：
  1. 顶部 summary：capital posture、health/runtime config、capability/evidence
  2. `Capital Ledger`：subscription + investor + signal + reconciliation 的结构化摘要
  3. `Formal Price Evidence`：formal quote / internal netting / advisory / fail-close 诊断
  4. raw projection cards：`product`、`subscription`、`investor`、`signal`、`reconciliation`
  5. event stream / audit log：作为下钻证据面
- 写区 `SubmitSignal` 继续放在单独列，避免 capital 阅读区与高风险操作区混排。

### 信息层次

- 第一层看“是否能快速理解当前资本状态”：released、funding、trading、precision lock、health、freshness。
- 第二层看“这些状态为什么成立”：formal quote source、netting、profit target advisory、quote issue。
- 第三层看“如需审计如何追根溯源”：projection JSON、事件时间线、audit 记录。

这个顺序的核心是：capital 相关信息要默认可读，但任何结论都必须还能落回原始证据。

## 设计提案

### 1. 类型 / API 同步策略

- `src/types.ts` 作为唯一前端 DTO 入口，保持与后端能力同名对齐，优先补齐字段，不在组件内部散落匿名类型。
- `ProjectionBundle` 固定包含 `product`、`subscription`、`reconciliation`、`investor`、`signal` 五类结果；`fetchWorkspaceProjections()` 继续并发读取并一次性返回，避免组件各自触发 query 造成口径漂移。
- 兼容策略采用“新增字段可选 + UI 降级展示”：
  - 对 `datasource_id`、`quote_updated_at`、`difference`、`tolerance`、`explanation` 等字段，缺失时允许显示 `-`
  - 但在高风险写 gate 上，依旧以现有 health/freshness/capability 为准，不因为字段缺失而放松写入
- `submitSignal()` 的前端 payload 只继续发送用户输入字段：`signal`、`entry_price`、`stop_loss_price`、`metadata`；不增加也不透传 `reference_price*`。

### 2. capital 视图设计

- `Capital Ledger` 卡片作为首要阅读面，展示四类内容：
  - subscription 资本分层：`funding_account`、`trading_account`、`available_vc`、`precision_locked_amount`
  - investor 聚合：`investor_id`、active subscriptions、funding total、locked total
  - signal 聚合：`signal_key`、products、target net、settled net
  - reconciliation 摘要：`status`、`difference`、`tolerance`、`explanation`
- `released_vc_total` 继续放在顶部 summary，而不是重复塞进 ledger 卡片，避免信息重复。
- `explanation` 必须直接展示在卡片正文，不折叠到 tooltip；因为这正是本轮 capital 同步的核心可读价值。

### 3. evidence 视图设计

- `EvidenceCard` 负责把后端新能力转成“为什么”的视图，而不是只给 event type：
  - `Quote Truth`：价格、source、datasource、quote updated at
  - `Internal Netting`：signal、settled qty、attribution count、captured at
  - `Advisory + Fail-Close`：profit target message、latest alert、quote issue、issue at
- 数据来源固定为：
  - formal quote / netting / advisory：从 `queryEventStream` 读取后经 `src/insights.ts` 提炼
  - quote fail-close：从 `queryRuntimeAuditLog` 中读取 `reference_price_missing`
- 不引入第二套“前端推理公式”；只做受控字段提取和格式化，避免 UI 自造 capital 真相。

### 4. raw 与 product 化的边界

- 产品化视图不是替代 raw 视图，而是放在 raw 视图之前。
- `ProjectionCard`、event stream、audit log 必须保留，用于回答“卡片上的结论来自哪里”。
- 当 summary 与 raw 不一致时，以 raw / event / audit 为最终排障入口；前端不缓存额外派生真相。

## 数据模型 / 接口约束

### 前端核心接口

| 模块                | 来源                        | 最小字段                                                                                          | 约束                                 |
| ------------------- | --------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Capital summary     | `subscription` projection   | `released_vc_total` `funding_account` `trading_account` `precision_locked_amount`                 | 数值字段缺失时显示 `-`，不做猜测填充 |
| Investor lens       | `investor` projection       | `investor_id` `active_subscription_count` `total_funding_account` `total_precision_locked_amount` | 不自行拼接跨 runtime 聚合            |
| Signal lens         | `signal` projection         | `signal_key` `product_ids` `total_target_position_qty` `total_settled_position_qty`               | 仅展示当前 runtime 相关 signal 聚合  |
| Reconciliation lens | `reconciliation` projection | `status` `difference` `tolerance` `explanation`                                                   | explanation 缺失时明确显示 `-`       |
| Evidence            | event / audit               | `price` `source` `datasource_id` `quote_updated_at` `settled_qty` `message` `note`                | 只读提炼，不反写任何状态             |

### 兼容策略

- 后端继续 append-only 加字段时，前端优先补 `types.ts`，再补 `insights.ts` / `app.tsx` 展示，不在多个组件里零散适配。
- 若 projection 暂缺某个新字段，页面仍可工作，但对应卡片显示占位值并保留 raw JSON 兜底。
- 若 event / audit 中不存在对应 evidence，`EvidenceCard` 显示 `-`，不把“缺证据”误展示成“无风险”。

## 错误语义与重试

- `ListRuntimeConfig` / `GetRuntimeHealth` / `QueryProjection` / `QueryEventStream` / `QueryRuntimeAuditLog` 任一读取失败时，错误局部显示在对应资源区域，不让整页白屏。
- projection 读取失败时，capital/evidence 卡片展示当前可得数据，并在 raw 区域暴露错误，便于区分“字段为空”与“请求失败”。
- event / audit 缺失 evidence 时视为“证据未知”，可通过手动刷新重试；前端不自动补造证据。
- 写请求继续保持单飞与 fail-close：提交前强制刷新 health，若 gate 未通过或后端拒绝，直接展示原因，不自动重试。
- 网络或 5xx 导致写结果未知时，提示用户去 event stream / audit log 核查，不自动补发 `SubmitSignal`。

## 安全考虑

- 前端只消费 formal quote evidence，不生成正式价格真相；`reference_price*` 继续留在后端 worker 注入边界。
- capital/evidence 视图只做只读展示，不新增更高权限的 operator 动作。
- `metadata` 仍维持 object-only 与体积限制，避免控制台成为任意 payload 注入入口。
- 对 quote issue、advisory message 等文本做普通字符串展示，不渲染 HTML，不引入 XSS 面。
- 高风险 profile 的写入 gate 仍以 capability + health + freshness + runtime confirmation 为准，capital 可视化增强不能被误解为“更容易写入”。

## 备选方案

### 方案 A：继续只展示 raw projection / event / audit

- 放弃原因：实现最省事，但用户仍要自己拼 capital 语义，等于后端能力存在、前端产品能力不存在。

### 方案 B：为 capital / evidence 单独新增后端 summary API

- 放弃原因：本任务约束明确为“只做前端同步，不改后端协议”；当前 projection + event + audit 已足够形成最小可读闭环。

## 向后兼容、发布与回滚

### 向后兼容

- 不改后端协议，现有 `SignalTrader/*` 接口保持兼容。
- 前端对新增字段保持可选读取；旧 runtime 或旧夹具即使未返回完整 capital 字段，也不会造成页面崩溃。
- 原始 projection / event / audit 视图继续保留，确保旧排障路径不被切断。

### 发布 / 灰度

- 先完成 `types.ts` 与 `api.ts` 同步，再落 `Capital Ledger` / `EvidenceCard`，最后补 Playwright 验收，避免 UI 先上线但字段口径未冻结。
- 本任务面向独立前端控制台，可先在 `paper` 环境完成 UI 验证，再跑 `dummy-live` fail-close 冒烟。

### 回滚

- 若 capital 卡片口径有误，可优先回滚新增卡片展示，保留 raw projection / event / audit 不动。
- 若 evidence 提炼误导性过强，可仅关闭 `insights.ts` 的摘要卡片，仍不影响基础控制台读写与原始证据面。
- 回滚原则是“先移除前端派生展示，后考虑字段适配”，不触碰后端资本语义。

## 验证计划

- 类型验证：`src/types.ts` 中 subscription / investor / signal / reconciliation 字段与当前后端能力一一对齐。
- API 验证：`fetchWorkspaceProjections()` 能稳定获取五类 projection，且失败时局部报错而非整页中断。
- capital 视图验证：页面能明确展示 capital / investor / signal / reconciliation explanation 四类内容。
- evidence 视图验证：页面能展示 formal quote source、internal netting、profit target advisory、quote issue 诊断。
- 安全验证：提交信号时 payload 预览与实际请求都不包含 `reference_price*`；高风险模式仍需 runtime confirmation。
- 兼容验证：当某些字段缺失时，卡片降级显示 `-`，raw JSON 仍可查看。
- 自动化验证：Playwright 至少覆盖 `paper` happy path 与 `dummy-live` fail-close path，并断言 capital / evidence 文案可见。

## 风险 / Open Questions

### 主要风险

- evidence 视图来自 event / audit 提炼，若命名或 event type 后续再演进，前端摘要可能比 raw 更早失配，因此 `insights.ts` 必须集中管理。
- capital 卡片展示的是“当前 runtime 工作区”视角，不是全局 investor ledger；文案必须避免让用户误以为这是完整总账。
- reconciliation explanation 可能较长，若 UI 不控制层级，容易把卡片挤成纯文本墙。

### Open Questions

- 是否需要在后续任务中把 evidence 提炼进一步结构化为可测试的 view model，而不仅是轻量 helper？本轮不阻塞。
- 若未来后端新增更多 advisory 类型，`EvidenceCard` 是否拆为多卡片布局？本轮先保持单卡片收敛。

## 里程碑

1. 类型与 query 同步：冻结 `types.ts` / `api.ts` 的 capital、investor、signal、reconciliation 字段与读取路径。
2. capital 信息架构：完成 summary + `Capital Ledger` 结构化展示，并保留 raw projection 兜底。
3. evidence 信息架构：完成 formal quote / netting / advisory / quote issue 摘要提炼。
4. 验证与收口：通过 build 与 Playwright 冒烟，确认 fail-close 写区未被 capital 同步破坏。

## 落地计划

### 预期文件变更点

- `ui/signal-trader-web/src/types.ts`：同步 capital / investor / signal / reconciliation 字段。
- `ui/signal-trader-web/src/api.ts`：固定五类 projection 并发读取与提交 payload 边界。
- `ui/signal-trader-web/src/insights.ts`：集中提炼 formal quote、netting、advisory、quote issue。
- `ui/signal-trader-web/src/app.tsx`：实现 capital 与 evidence 的页面结构、卡片与降级逻辑。
- `ui/signal-trader-web/src/styles.css`：维持独立控制台的产品化视觉层次。
- `ui/signal-trader-web/tests/signal-trader.spec.ts`：补充 capital/evidence 可见性与 fail-close 回归断言。

### 验证步骤

- 运行前端 build，确认类型与打包通过。
- 运行 Playwright `paper` 冒烟：验证 capital/evidence 卡片可见，且 happy path 提交不回归。
- 运行 Playwright `dummy-live` 冒烟：验证 runtime confirmation 仍是必选，按钮保持 fail-close。
- 人工检查 payload preview、event stream、audit log，确认 formal quote evidence 仅来自读取面，不来自前端写入。
