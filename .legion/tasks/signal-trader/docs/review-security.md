# 安全审查报告

## 结论

PASS

## 阻塞问题

- (none)

## 建议（非阻塞）

- `mock-execution-port` 虽已增加 `NODE_ENV` / `SIGNAL_TRADER_ALLOW_UNSAFE_MOCK` 守门，但仍从主入口导出；建议后续迁移到显式 testing/unsafe 导出路径，进一步降低误接入概率。
- `sanitizeMetadata` 当前只保留 `trace_id`、`reference_id`、`tags`；建议把允许字段清单文档化，并在宿主侧统一复用，避免不同接入方出现脱敏口径漂移。
- `unknown_execution_report` 现在已覆盖 `order not found` 与 `product_mismatch`；建议后续继续细分 account/venue/correlation mismatch，提升监控与审计可追溯性。
- 建议持续监控 `idempotency_conflict`、`unknown_execution_report`、`reconciliation_mismatch` 三类告警速率，作为 fail-close 与协议绕过的早期信号。

## 修复复核

- 已确认：`audit_only` 后再次 `submit_signal` 不再产出 `planned_effects`，仅追加 `SignalReceived + IntentRejected + AlertTriggered`，满足 fail-close。
- 已确认：`apply_execution_report` 增加 `product_id` 一致性校验，不匹配时仅追加 `unknown_execution_report` 告警，不再修改订单/持仓。
- 已确认：`SignalReceived` 与 `AuthorizedAccountSnapshotCaptured` 在落事件前经过 metadata allowlist 脱敏，不再原样写入任意 metadata。
- 已确认：mock execution port 新增运行时安全边界，非 test 环境默认拒绝启用，除非显式设置 `SIGNAL_TRADER_ALLOW_UNSAFE_MOCK=true`。
