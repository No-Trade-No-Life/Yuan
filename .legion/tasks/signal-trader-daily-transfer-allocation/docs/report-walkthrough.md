# signal-trader-daily-transfer-allocation 交付 walkthrough

## 目标与范围

- 目标：将 `daily_burn_amount` 从“按需补资前的预算释放”改为“funding account 每天固定拨资到 trading account 的真实日拨 capital allocation”，并确保 live / paper 在无下单情况下也会完成拨资。
- 范围绑定 `scope`：
  - `libraries/signal-trader/**`
  - `apps/signal-trader/**`
  - `ui/signal-trader-web/**`
  - `.legion/playbook.md`
- 本次交付不修改数据库 schema，不重写 transfer 协议，也不扩大到 full capital ledger / 多账户资金规划。

## 设计摘要

- 设计基线见 RFC：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-daily-transfer-allocation/docs/rfc.md`
- 核心设计结论：
  - `funding_account` 表示尚未拨入 trading 的剩余预算。
  - `trading_account` 表示已拨入 trading 的资本池总额。
  - `available_vc` 表示在扣除 `current_reserved_vc` 与 `precision_locked_amount` 后仍可扩张的容量。
  - runtime transfer 统一围绕 `getTradingCapitalTarget()` 收口，既补 deficit，也只在真正 excess 时 sweep。
- RFC 审查结论见：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-daily-transfer-allocation/docs/review-rfc.md`；结论为 `PASS-WITH-NITS`，blocker 已关闭，保留项主要是首次 live observer 的保守性折中与 excess 来源细分留待后续 ledger 任务。

## 改动清单

### 1. Core projection 与预算语义

- `libraries/signal-trader/src/domain/evaluate-budget.ts`
  - 冻结 daily allocation 公式，令 `released_vc_total` 成为按日累计已拨资本。
  - 收口 `funding_account` / `trading_account` / `available_vc` 的新语义，避免继续混用“未占用风险额度/已占用风险额度”的旧解释。
- `libraries/signal-trader/src/engine/query-projection.ts`
  - 确保 investor / signal query 直接复用新的 projection 结果，不在 app 层复制预算公式。
- `libraries/signal-trader/src/index.test.ts`
  - 补齐 D0 / D1 / D2、precision lock、over-reserved 等断言，验证新语义在不同时间推进和持仓状态下保持自洽。

### 2. Runtime transfer 编排

- `apps/signal-trader/src/runtime/runtime-worker.ts`
  - 将日拨资金同步抽象为统一 allocation sync 动作。
  - 让 boot、observer、submit 共用同一套 deficit / excess 判定逻辑。
  - 把 transfer-out 下限提升到 `getTradingCapitalTarget()`，避免把已分配本金或维持现有仓位所需余额误扫回 funding。
- `apps/signal-trader/src/runtime/runtime-manager.ts`
  - paper clock 推进后立即触发 paper runtime allocation sync，满足“不下单推进一天也会拨资”。
- `apps/signal-trader/src/__tests__/signal-trader-app.test.ts`
  - 覆盖 paper/live 在无下单情况下的日拨 transfer-in、平仓后不 sweep 已分配本金、observer transfer-out 去重等关键路径。

### 3. 前端同步

- `ui/signal-trader-web/src/app.tsx`
  - 将 capital 卡片与相关展示语义同步到 projected funding / trading 的新定义，降低 operator 继续沿用旧心智模型的风险。

### 4. 评审与交付文档

- 代码评审：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-daily-transfer-allocation/docs/review-code.md`
  - 结论 `PASS`，确认新语义自洽、runtime target 统一、legacy snapshot fallback 已补齐。
- 安全评审：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-daily-transfer-allocation/docs/review-security.md`
  - 结论 `PASS-WITH-NITS`，确认未新增高风险写接口，重复补资与误 sweep 风险已显著收敛。

## 如何验证

- 详细测试记录见：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-daily-transfer-allocation/docs/test-report.md`
- 建议按以下步骤复核：

1. `npm run build`（workdir=`libraries/signal-trader`）
   - 预期：build 通过，Jest `26/26` 通过，API Extractor 通过；仅保留工具链 warning。
2. `npm run build`（workdir=`apps/signal-trader`）
   - 预期：build 通过，Jest `50/50` 通过；覆盖 paper/live 不下单日拨资、paper clock、excess sweep。
3. `node common/scripts/install-run-rush.js build -t @yuants/signal-trader -t @yuants/app-signal-trader`
   - 预期：Rush 目标链路构建通过；仅保留 Node / worker forced exit warning。
4. `npm run test:e2e:paper`（workdir=`ui/signal-trader-web`）
   - 预期：paper stack 拉起成功，Playwright 用例 `@paper loads runtime health and submits a signal` 通过。

重点验收项：

- D0 / D1 / D2 下 `funding_account` 递减、`trading_account` 递增，即使未下单也成立。
- `advancePaperClock(DAY_MS)` 后无需 submit 也会触发 transfer-in。
- 平仓或无仓状态下不会把已分配 tranche 直接 sweep 回 funding，只回收超出目标池的 excess。
- live observer 周期内即使无订单，也会补齐跨天产生的 deficit。

## 风险与回滚

### 风险

- transfer 频率上升：observer / paper clock 现在会在无下单日也触发资金动作。
- 心智迁移风险：若 operator 仍用旧语义理解 funding / trading，可能误判账户状态。
- excess 简化策略：当前默认把高于目标池的盈利或人工补款视为可回收 excess，来源未细分。
- 工程尾项：`apps/signal-trader` 测试 teardown warning 仍在，会削弱长期回归信号质量，但不影响本轮功能结论。

### 回滚

- 先将受影响 live runtime 停用或切回 `audit_only`，阻断新的真实 transfer。
- 回退 core projection 公式与 runtime allocation sync 接线。
- 重启 worker / replay projection，让 query 结果回到旧预算语义。
- 保留既有 audit log 与 transfer 历史，用于排障与资金核对。

## 未决项与下一步

- 未决项：
  - live 首次 observer 仍允许在 fresh balance 前提下先做 transfer-in，这是业务目标与更强资金门禁之间的折中。
  - excess sweep 还未区分盈利、人工补款和其他来源；若后续需要更细资金解释，应另开 capital ledger 任务。
- 下一步建议：
  1. 让人类 reviewer 重点确认 funding / trading / available 的业务语义是否满足预期。
  2. 在灰度 live runtime 上观察 observer 周期内的 transfer 频率与 audit log 可读性。
  3. 视需要继续开新任务，细化 operator 文案与 capital ledger 来源跟踪。
