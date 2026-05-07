# signal-trader-capital-system-completion RFC 审查

## 结论

- Verdict: `PASS-WITH-NITS`
- 审查日期: 2026-03-23
- 审查方式: 对抗性 RFC review（两轮）

## 已关闭的 blocker

1. **buffer 首版过宽**
   - RFC 已收口到只做 `precision_lock`，并冻结 subscription 级守恒关系；不再一次性引入 rounding / fee / 其它残差原因。
2. **internal netting 事件设计不自洽**
   - 已明确 `MidPriceCaptured` 负责价格真相，`InternalNettingSettled` 只通过 `mid_price_event_id` 引用，不重复写价格。
   - 同时补上了 `pending_order_qty = 0` 与无未完成挂单前提。
3. **profit target 误把账户观察值宣称成 investor 真相**
   - 已降级为 account-scoped advisory alert，只用现有 `AlertTriggered` 结构和 message 解释，不宣称 investor 真相达标。
4. **projection 过度膨胀**
   - `InvestorProjection` / `SignalProjection` 已限制为 totals / ids / counts，不再混入 reconciliation explanation / transfer 语义。
5. **reconciliation 过早纳入 buffer 主判定**
   - 已明确 buffer 只进入 explanation，不进入 mismatch 主判定。

## 保留的 nits

1. `MidPriceCaptured` 首版仍依赖 `submit_signal.entry_price` 作为最小证据来源，后续若要做更强资本系统，需要更正式的市场价格来源。
2. `profit_target_reached` 仍是 advisory，不是 investor 级盈亏真相；这是本轮的刻意边界，而不是遗漏。

## 审查摘要

- 当前 RFC 已达到可编码状态，可以进入实现阶段。
- 实现时优先保证三件事：
  - `precision_lock` 的守恒与 replay 一致性
  - internal netting 的触发门槛足够保守
  - reconciliation 只做 tolerance / explanation 小步升级
