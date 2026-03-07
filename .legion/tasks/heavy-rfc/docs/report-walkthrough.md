# Implementation Walkthrough（heavy-rfc）

## 1) 目标与范围

- 目标：基于已通过评审的 heavy RFC，完成 `libraries/live-trading` 单一 core lib 落地，并交付测试与评审闭环。
- 实现范围：`libraries/live-trading/src/**`（domain/engine/api/tests）及实现阶段报告文档。
- 文档交付范围（本次输出绑定）：
  - `.legion/tasks/heavy-rfc/docs/report-walkthrough.md`
  - `.legion/tasks/heavy-rfc/docs/pr-body.md`

## 2) 设计摘要（引用 RFC）

- 设计基线来自 `.legion/tasks/heavy-rfc/docs/rfc.md`（Option B）：分层状态机 + 外置 `planned_effects`，核心库仅做确定性状态转移。
- 输入与执行语义沿用 RFC 冻结约束：push 输入、三值信号 `-1/0/1`、`close_then_open`、下单同时携带 TP/SL。
- 风控与幂等边界沿用 RFC：风险参数校验、`signal_id` 全局幂等、拒绝路径必须产出审计事件。

## 3) 改动清单（按模块/文件）

- `libraries/live-trading/src/types.ts`
  - 定义 core lib 公开契约：`TLiveTradingCommand`、`IDispatchResult`、`IAuditEvent`、`ILiveTradingEffect`、查询请求类型。
  - 冻结 `signal` 枚举、风险策略字段、投资者状态结构与审计事件模型。
- `libraries/live-trading/src/domain/compute-position-plan.ts`
  - 实现“以损定仓”规划与风险参数校验。
  - 支持 `take_profit_ratio` / `take_profit_amount` 两种止盈口径并校验冲突场景。
- `libraries/live-trading/src/engine/create-live-trading-state.ts`
  - 提供初始状态工厂与 seed 合并，统一状态版本与序列计数器初始化。
- `libraries/live-trading/src/engine/dispatch-command.ts`
  - 实现 `submit_signal`/`update_risk_policy` 命令分发。
  - 落地幂等重放与冲突检测、`signal=0` 强平、`close_then_open`、限流/冷却、拒绝审计、effect 规划。
  - 保持 pure core 边界：不执行网络/DB/消息副作用，仅输出 `planned_effects`。
- `libraries/live-trading/src/engine/query-investor-state.ts`
  - 提供投资者状态查询与防御性深拷贝返回。
- `libraries/live-trading/src/engine/query-audit-trail.ts`
  - 提供按投资者/时间窗/信号过滤的审计查询。
- `libraries/live-trading/src/live-trading-core.test.ts`
  - 覆盖 23 个核心用例：幂等、冲突、风控参数、时间戳漂移与单调性、限流/冷却、平仓与反手、审计过滤。

## 4) 如何验证（命令 + 预期）

- 验证来源：`.legion/tasks/heavy-rfc/docs/test-report.md`
- 命令 1：`npx heft test --clean`（workdir=`libraries/live-trading`）
  - 预期：Jest 1 suite 全通过。
  - 实际：PASS，Jest 1 suite（`lib/live-trading-core.test.js`）中 `23/23` 用例通过。
- 命令 2：`rush build --to @yuants/live-trading`（workdir=`/Users/c1/Work/Yuan`）
  - 预期：目标包与依赖构建通过。
  - 实际：PASS，构建成功（含缓存恢复）。

## 5) Code / Security Review 结论

- Code review：`.legion/tasks/heavy-rfc/docs/review-code.md` 结论 PASS，blocking=0。
  - 已确认此前阻塞项（`received_at` 漂移超窗、non_monotonic 覆盖）闭环。
  - 保留若干非阻塞建议（例如 `queryAuditTrail` 的 `NaN` 入参防御、时间边界精细化测试）。
- Security review：`.legion/tasks/heavy-rfc/docs/review-security.md` 结论 PASS，blocking=0。
  - 已确认拒绝审计主路径可用（含 `E_UNSERIALIZABLE_INPUT` 回归覆盖）。
  - 保留非阻塞建议：未知异常审计兜底、错误信息脱敏、审计容量监控与宿主鉴权审计强化。

## 6) 风险与回滚

- 主要残余风险：
  - 未知异常未统一兜底审计时，可能出现“抛错但无拒绝事件”的可追溯性盲区。
  - `error_message` 直出若未由宿主脱敏，存在信息泄露面。
  - `audit_events`/`processed_signals` 环形上限下存在高压场景取证挤出风险。
- 回滚要点（对齐 RFC）：
  - 触发阈值异常时，将宿主执行模式切换到 `audit_only`，停止新开仓 effect。
  - 执行查单/撤单补偿，并基于审计事件重建状态。
  - 保留 core lib 版本回退能力，优先回退至上一稳定实现。

## 7) 未决项与下一步

- 未决项（Open Questions，见 RFC）：
  - `stop_loss_ref_pct` 在实盘阶段是否迁移到 P95/P99/窗口遗忘口径。
  - 最小手与慢速注资策略是否进入默认策略。
  - 审计保留周期与导出合规格式最终冻结流程。
- 下一步建议：
  1. 在宿主层落地未知异常审计兜底与错误脱敏策略。
  2. 补齐 `received_at` 阈值边界测试（`±5min` 与 `±(5min+1ms)`）。
  3. 按 RFC 灰度手册推进 `audit_only -> paper` 集成验证。
