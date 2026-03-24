# signal-trader-ui-capital-sync 交付走查

## 目标与范围

- 目标：把独立前端 `ui/signal-trader-web` 同步到最新后端资本系统能力，让用户能直接阅读 capital posture、investor/signal 聚合、formal quote / netting / advisory 证据，而不再主要依赖原始 JSON 与事件流排障。
- 范围绑定：本轮 scope 限制在 `ui/signal-trader-web/**` 与 `.legion/playbook.md`；实际实现集中在 `ui/signal-trader-web/**`，未修改 `.legion` 三文件，也未改动后端 schema / command 协议。
- 交付口径：在保留 raw projection / event / audit 下钻路径的前提下，新增结构化 capital 与 evidence 读面，并维持写区 fail-close 边界。

## 设计摘要

- 设计依据：`./rfc.md`
- 审查结论：`./review-rfc.md` 给出 `PASS-WITH-NITS`，认可主阅读路径从“原始 JSON 排障”切换为“capital posture -> evidence -> raw 下钻”。
- 关键设计决策：
  - 前端只做读取、聚合展示与写入护栏，不新增写协议，不信任也不回传 `reference_price*`。
  - capital 相关信息按“summary -> ledger -> evidence -> raw”组织，先让用户看懂，再允许追溯到底层证据。
  - 原始证据面继续保留，但展示前统一经过 `sanitize*` 处理，避免整对象裸透传扩大浏览器暴露面。

## 改动清单

### 1. 类型与数据读取层

- `ui/signal-trader-web/src/types.ts`
  - 同步 `subscription`、`reconciliation`、`investor`、`signal` DTO，补齐 `funding_account`、`trading_account`、`precision_locked_amount`、`difference`、`tolerance`、`explanation` 等资本字段。
  - 扩展 `ProjectionBundle` / `ProjectionErrors`，为五类 projection 并发读取与逐项容错提供统一前端类型边界。
- `ui/signal-trader-web/src/api.ts`
  - 保持前端请求入口集中在 `signalTraderApi`，继续通过 `SignalTrader/QueryProjection` / `QueryEventStream` / `QueryRuntimeAuditLog` 读取，不新增后端接口。
  - `submitSignal()` 仍只发送用户输入字段：`signal`、`entry_price`、`stop_loss_price`、`metadata`；未引入 `reference_price*`，维持正式价格证据由后端 worker 注入的边界。

### 2. 证据提炼与页面信息架构

- `ui/signal-trader-web/src/insights.ts`
  - 从 event stream / audit log 提炼 formal quote、internal netting、profit target advisory、quote fail-close 诊断，集中管理证据摘要逻辑，避免在组件中散落前端推理。
- `ui/signal-trader-web/src/app.tsx`
  - 工作区读取改为并发加载 `product` / `subscription` / `reconciliation` / `investor` / `signal` 五类 projection，并对每一项单独容错，避免单个 query 失败拖垮整组 capital 视图。
  - 顶部 summary 新增 `Capital Posture`、`Health + Runtime Config`、`Capability + Evidence` 三组摘要，优先暴露 released/funding/trading/precision lock、health/freshness、quote source 等关键信号。
  - 新增 `Capital Ledger` 结构化卡片，集中展示 subscription 资金分层、investor 聚合、signal 聚合与 reconciliation `difference/tolerance/explanation`。
  - 新增 `Formal Price Evidence` 卡片，把 formal quote、internal netting、profit target advisory、quote issue 收敛为可读证据面，并明确标注“只读展示，不参与前端提交 gate”。
  - raw `ProjectionCard`、event stream、audit log 继续保留，且原始内容经 `sanitize*` 过滤后展示，保留审计能力同时收敛暴露面。

### 3. 样式与验证

- `ui/signal-trader-web/src/styles.css`
  - 为 capital/evidence 卡片、summary 区与双列控制台布局补齐视觉层级，保持独立控制台的产品化风格，并兼顾窄屏响应式降级。
- `ui/signal-trader-web/tests/signal-trader.spec.ts`
  - `paper` 冒烟覆盖 capital/evidence 模块可见、基础提交成功与事件流更新。
  - `dummy-live` 冒烟覆盖 runtime confirmation 必填与 fail-close 禁用态，验证高风险写入护栏未被本轮 UI 同步破坏。

## 如何验证

- 详细结果见：`./test-report.md`
- 执行命令：
  - `npm run build`（workdir=`ui/signal-trader-web`）
    - 预期：TypeScript 构建通过，Vite 产物生成成功。
  - `npm run test:e2e:paper`（workdir=`ui/signal-trader-web`）
    - 预期：页面可见 runtime rail、`资金分层与聚合`、`quote、netting 与 advisory`；可成功提交 signal 并看到事件流更新。
- 关键人工核对点：
  - capital 视图能看到 `funding_account`、`trading_account`、`precision_locked_amount`、investor/signal 聚合与 reconciliation explanation。
  - evidence 视图能看到 formal quote source、internal netting、profit target advisory、quote issue。
  - payload preview 与提交请求不包含 `reference_price*`；live / dummy-live 下仍需 `runtime_id` 二次确认。

## 风险与回滚

- 主要风险：
  - evidence 摘要来自 event / audit 提炼，若后端事件命名继续演进，前端摘要可能先于 raw 视图失配。
  - 页面信息密度提升后，后续继续扩资本语义时，读面可能再次膨胀。
  - `sanitize*` 已显著收敛暴露面，但后续仍需坚持 allowlist 思路，避免新字段被无意展示。
- 回滚策略：
  - 首选回滚新增 capital / evidence 派生卡片，保留 raw projection / event / audit 读面不动。
  - 如证据提炼口径存在问题，可只关闭 `src/insights.ts` 驱动的摘要展示，不触碰 `SubmitSignal`、runtime rail 与基础读取能力。
  - 不需要回滚后端协议；本轮变更为纯前端同步，可独立撤回。

## 未决项与下一步

- 未决项：
  - Playwright 目前仍偏 smoke test，对 capital / investor / signal / quote / reconciliation 的字段值断言还不够强。
  - 若后端后续继续扩 advisory / evidence 类型，`EvidenceCard` 可能需要进一步拆分为更细的 view model 或卡片层次。
- 下一步建议：
  1. 补更强的 E2E 断言，覆盖关键字段值与降级占位符，而不只校验模块可见。
  2. 持续收紧 `sanitizeEventPayload` / `sanitizeAuditDetail` 的 allowlist，降低未来字段漂移带来的展示面扩大风险。
  3. 如后续资本语义继续扩张，再评估 `Capital Ledger` / `Evidence` 的分组或折叠策略，避免重新退化成信息墙。
