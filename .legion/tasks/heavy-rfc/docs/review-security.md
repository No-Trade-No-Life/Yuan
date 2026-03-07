# Security Review Report

## 结论

PASS

## Blocking Issues

- [ ] (none)

## 建议（非阻塞）

- `[STRIDE:Repudiation]` `libraries/live-trading/src/engine/dispatch-command.ts:327` - 目前仅白名单中的 `E_*` 会走 `rejectWithAudit`；建议增加兜底拒绝审计（例如未知异常映射 `E_INTERNAL_REJECTED`），减少“抛错但无审计”残余盲区。
- `[STRIDE:Information Disclosure]` `libraries/live-trading/src/engine/dispatch-command.ts:438` - `toRejectPayload` 直接暴露 `error_message`，宿主若原样外抛可能泄漏内部实现细节；建议宿主对外返回通用错误并仅保留内部审计详情。
- `[STRIDE:Denial of Service/Repudiation]` `libraries/live-trading/src/engine/dispatch-command.ts:399` - `audit_events`/`processed_signals` 上限已存在（10k/20k），建议补充淘汰计数与水位监控，防止高压下取证信息被静默挤出。
- `[STRIDE:Spoofing/Elevation of Privilege]` `libraries/live-trading/src/engine/dispatch-command.ts:17` - 当前仅声明“宿主负责鉴权”，符合边界；建议在公开文档继续强化前置条件（caller 必须与 `investor_id` 绑定授权）并要求宿主记录鉴权审计。
- `[STRIDE:Tampering]` `libraries/live-trading/src/live-trading-core.test.ts:350` - 已覆盖 `E_UNSERIALIZABLE_INPUT` 的拒绝审计回归；建议保留该用例为 release gate，避免后续对白名单或 catch 分支改动引入回退。

## 修复指导

1. 本轮复核结论为 PASS：`E_UNSERIALIZABLE_INPUT` 已纳入拒绝审计白名单，且已有回归测试覆盖，`submit_signal` 在该拒绝路径可稳定产生 `SignalRejected` 与 `emit_audit_event`。
2. 为进一步提升“拒绝即审计”完备性，建议在 `catch` 中对非白名单异常补充统一审计兜底策略，并保留错误分类字段用于后续溯源。
3. 在宿主层落实 secure-by-default：严格执行调用者鉴权与 `investor_id` 授权绑定、对外错误信息脱敏、持续启用依赖 SCA 与审计容量监控。
