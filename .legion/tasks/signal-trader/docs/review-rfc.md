# RFC 审查报告（复审）

## 结论

PASS

本次 RFC 已基本收敛到**可编码的最小 V1**：

- 已删除/降级投影型 append 事件，主张与事件溯源边界重新对齐；
- 已冻结 `entry_price` 的时机：新增风险暴露时必须在 `submit_signal` 提供；
- 已冻结 `OrderSubmitted` attribution 快照，净额成交后的反拆具备确定性基础；
- 已把 `profit_target_value` 从阻塞项中移除，V1 只保留 alert 语义；
- 已把对账收敛为单账户单标量最小闭环。

结论：**可以开始实现**，但实现时应主动按最小边界落地，不要把 follow-up / 可选里程碑一起做进去。

## 阻塞问题

- [ ] 无新增阻塞项。

## 非阻塞建议

- `SignalRejected` 仍出现在错误语义，但最小事件清单未列出；实现时建议统一收敛到 `IntentRejected` 或把 `SignalRejected` 明确补入 schema，避免事件名漂移。
- `Debug playbook` 仍残留 `Ledger* / PositionUpdated / BufferAdjusted` 等旧表述；不影响编码，但建议后续文档清理，避免误导 reviewer。
- `update_risk_policy` 在安全章节仍被提及；实现时应视为后续能力，不纳入首版 frozen API。

## 修复指导

### 允许开始实现的最小模块边界

- `src/types/commands.ts`
- `src/types/events.ts`
- `src/types/snapshot.ts`
- `src/domain/compute-target-position.ts`
- `src/domain/reducer.ts`
- `src/engine/create-event-sourced-trading-state.ts`
- `src/engine/dispatch-command.ts`
- `src/engine/append-events.ts`
- `src/engine/replay-events.ts`
- `src/engine/query-projection.ts`
- `src/engine/query-event-stream.ts`
- `src/ports/execution-port.ts`
- `src/ports/mock-execution-port.ts`
- `src/index.ts`

### 实现时最容易踩的 3 个坑

1. **不要把 projection 变化再 append 成事件**：账本、buffer、position 变化应由 reducer 从事实事件推导。
2. **不要在 `apply_execution_report` 时回读“当前最新 projection”倒推历史归因**：必须只依赖 `OrderSubmitted.attribution` 快照反拆。
3. **不要把可选语义偷渡进首版**：`update_risk_policy`、复杂资金账户查询面、内冲抵增强版都应晚于最小闭环。
