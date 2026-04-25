# 安全审查报告

## 结论

PASS-WITH-NITS

## 阻塞问题

- (none)

## 建议（非阻塞）

- `libraries/signal-trader/src/engine/dispatch-command.ts:971-996`，`apps/signal-trader/src/runtime/runtime-worker.ts:1160-1200` - 当前 auto-flat 仍然基于单次 `observed_balance >= profit_target_value` 触发，且即便同一快照把 runtime 推入 `audit_only` / `reconciliation_status='mismatch'`，只要账户当前并非 flat，生命周期仍会启动 forced-flat。新补丁已经避免“纯充值关闭空仓 profile”，但尚未完全消除“异常余额快照/充值/transfer 抖动导致持仓被过早平掉”的操作风险。建议把 `reconciliation_status === 'matched'` 作为 auto-flat 前置条件，或至少要求连续命中/时间窗口确认后再执行。
- `apps/signal-trader/src/runtime/runtime-worker.ts:1222-1232,1280-1289` - 审计日志已补 `observed_balance`、`profit_target_value`、`reconciliation_status`、`account_id`，可追溯性明显提升；但若要单靠 audit log 完整复盘，仍建议补 `snapshot_id` 对应的 `captured_at/updated_at` 或触发 event id，避免排查时还要反查 event stream 时间线。
- `apps/signal-trader/src/__tests__/signal-trader-app.test.ts` / `libraries/signal-trader/src/index.test.ts` - 建议继续补回归用例，覆盖：1）`reconciliation mismatch` 且余额越阈值时是否应该 auto-flat；2）`flatten_requested` 期间重复 observer 快照与 retry 行为是否幂等；3）外部传入 `source='agent'` 被降级后的审计/事件表现是否稳定。

## 修复指导

1. 若产品预期是“只有可信收益命中才 auto-flat”，则把 `matched reconciliation` 纳入触发门槛。
2. 为 profit target 审计日志增加触发快照时间或 event id，进一步提升定位效率。
3. 补足异常快照与重试路径测试，防止后续回归重新放大操作风险。

[Handoff]
summary:

- 结论为 PASS-WITH-NITS。
- 已确认外部 `source='agent'` 会在 runtime worker 被降级为 `manual`，原先 audit_only 写能力扩大问题已收敛。
- 已确认 `flatten_requested` 窗口会拒绝非 agent 新 signal，自动平仓期间再次下单路径已收敛。
- 已确认 flat 状态下不会因纯阈值快照直接关闭 profile，且审计日志已补关键定位字段。
  decisions:
- (none)
  risks:
- `reconciliation mismatch` 或异常余额快照下，持仓仍可能因单次越阈值被过早 auto-flat。
- 审计日志仍缺少触发快照时间/事件 id，复杂故障下复盘仍需串查 event stream。
  files_touched:
- path: /Users/c1/Work/signal-trader/.legion/tasks/signal-trader-mock-exchange-account-ui/docs/review-security.md
  commands:
- (none)
  next:
- 评估是否将 `reconciliation_status === 'matched'` 设为 auto-flat 必要条件。
- 为 profit target 触发补快照时间或 event id。
  open_questions:
- (none)
