# 代码审查报告

## 结论

PASS-WITH-NITS

## 阻塞问题

- [ ] (none)

## 建议（非阻塞）

- `apps/signal-trader/src/runtime/runtime-worker.ts:398-423` - 外部 `source='agent'` 在 worker 入口被降级为 `manual`，边界已经清晰很多；但当前没有看到对应回归测试，建议补一条“外部伪造 `agent` + audit_only` 时仍被拒绝”的测试，避免后续有人把 sanitize 挪走后静默回归。
- `apps/signal-trader/src/runtime/runtime-worker.ts:1160-1236` - profit target lifecycle 的重试和 `PROFIT_TARGET_FLATTENING` 拦截逻辑已明显收敛，但当前也没看到针对 “close order rejected/cancelled 后自动重试” 与 “flatten_requested 期间外部 submit 被拒绝” 的专项回归测试。这里属于高风险编排，建议把这两个分支补成独立用例。
- `ui/signal-trader-web/src/risk.ts:64-65` - `subscription_status='closed'` 的前后端 gate 现在是一致的；但 `flatten_requested` 是 runtime 内部瞬时态，前端 risk gate 还感知不到，因此 UI 仍可能显示可提交、最终由后端返回 `PROFIT_TARGET_FLATTENING`。这不构成当前阻塞，但建议后续评估是否要把该态透出给前端，减少交互落差。
- `libraries/signal-trader/src/engine/dispatch-command.ts:192-210` - `signal=0` forced-flat attribution 改成按 `target_position_qty - settled_position_qty` 分摊是合理的，和“待结算缺口”语义一致。建议补一条多 subscription + partial fill 组合回归，锁住该字段现在表示的是 delta 而不是绝对 target，避免后续维护时再被误改回去。

## 修复指导

当前无阻塞项，建议补强以下回归：

1. 外部提交 `source='agent'`，在 audit_only 下仍返回 reject，证明 sanitize 生效。
2. `profit_target_value` 触发后，首个 forced-flat 订单若 `rejected/cancelled`，后续 snapshot/observe 能再次自动提平仓。
3. `flatten_requested` 期间外部 manual/model signal 返回 `PROFIT_TARGET_FLATTENING`。
4. 多 subscription / 部分成交下 forced-flat attribution 仍正确把 projection 收敛为 0。

[Handoff]
summary:

- 本轮复审结论为 PASS-WITH-NITS。
- 先前两个 blocking 问题（伪造 `source='agent'` 绕过 audit_only、profit target lifecycle 在 reject/cancel 后卡死）从代码路径上已修复。
- 当前剩余主要是测试覆盖和前端对 `flatten_requested` 瞬时态不可见的体验级问题。
  decisions:
- `signal=0` attribution 按 `target_position_qty - settled_position_qty` 分摊，评审认为合理。
- `subscription_status='closed'` 后 submit reject 与前端 risk gate 现状一致。
  risks:
- 新增的 lifecycle / sanitize 约束若缺少专项测试，后续重构时容易回归。
- 前端暂时无法提前感知 `PROFIT_TARGET_FLATTENING` 窗口，只能依赖后端 reject。
  files_touched:
- path: /Users/c1/Work/signal-trader/.legion/tasks/signal-trader-mock-exchange-account-ui/docs/review-code.md
  commands:
- (none)
  next:
- 补专项回归测试并评估是否向前端透出 flattening 态。
  open_questions:
- (none)
