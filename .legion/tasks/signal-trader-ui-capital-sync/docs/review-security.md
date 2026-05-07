# signal-trader-ui-capital-sync 安全审查

## 结论

- Verdict: `PASS-WITH-NITS`
- 审查日期：2026-03-23

## 关键结论

1. 前端没有意外信任或回传 `reference_price*`；正式价格证据仍只作为只读展示，不进入提交链路。
2. 原有 fail-close gate 没有被放松：`enableMutation`、capability、health、freshness、`runtime_id` 二次确认和提交前重检都还在。
3. 之前的高风险问题已收敛：事件流、审计明细、Runtime Config、Projection 现在都经过 `sanitize*` 处理，不再直接把后端原始对象全量透传到浏览器。
4. 页面已明确标注“只读证据不参与前端提交 gate”，降低了证据卡误导高风险操作的风险。

## Nits

1. `sanitizeEventPayload` / `sanitizeAuditDetail` 虽已显著收敛，但仍建议长期保持显式 allowlist 习惯，避免后端未来新增字段时无意扩展示面。
2. 当前展示面仍会暴露一部分内部标识的脱敏版本；如果部署边界继续扩大，前端读权限仍需谨慎控制。
3. 目前 quote/advisory 诊断主要靠页面和日志观察，若未来需要更强运维闭环，可考虑配合后端 health/metric 信号做更明确的提醒。
