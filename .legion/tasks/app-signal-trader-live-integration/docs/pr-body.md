## What

新增 `@yuants/app-signal-trader` 宿主应用，并把 `@yuants/signal-trader` 接入可部署 runtime。此次交付补齐 runtime orchestration、paper/live execution、SQL 持久化、observer/reconciliation、审计日志与 fail-close 控制面，同时把新 app 接入 Rush 构建链路。

## Why

仓库此前只有 signal-trader core library，缺少真正可运行的宿主层，导致 runtime 配置、实盘执行、订单归因、重启恢复、审计与人工接管都无法落地。本 PR 让 signal-trader 具备可验证、可回放、可审计的宿主形态，并把 live 支持矩阵从 app 内部白名单收口为显式 capability contract。

## How

- live 支持矩阵不再由 app 内部 OKX 白名单决定，而是由 capability registry + canonical capability key `observer_backend` 决定，并新增 `SignalTrader/ListLiveCapabilities` 枚举 support matrix。
- fail-close 状态机收敛为：boot/preflight 失败 => `stopped`；运行中安全异常 => `audit_only`。
- operator 审计身份改为通过 `servicePolicy.resolveOperatorAuditContext(...)` 注入受信主体，避免信任请求体自报 `operator`。

## Testing

- 参考：[`./test-report.md`](./test-report.md)
- 已通过：`npm run build`（workdir=`apps/signal-trader`）
- 结果：`@yuants/app-signal-trader` 26 tests 通过；RFC review / code review / security review 均为 PASS

## Risk / Rollback

- 风险：该 PR 涉及 high-risk live host，任何 capability、binding、freshness、observer 或 reconciliation 失真都会直接影响实盘安全。
- 回滚：准入/启动前问题停在 `stopped`，运行中问题锁到 `audit_only`；停止新 external effect，保留 event/binding/checkpoint/audit log，通过 `BackfillOrderBinding`、`UnlockRuntime`、`ReplayRuntime` 做人工接管与恢复。

## Links

- Plan：[`../plan.md`](../plan.md)
- RFC：[`./rfc.md`](./rfc.md)
- RFC Review：[`./review-rfc.md`](./review-rfc.md)
- Code Review：[`./review-code.md`](./review-code.md)
- Security Review：[`./review-security.md`](./review-security.md)
- Test Report：[`./test-report.md`](./test-report.md)
- Walkthrough：[`./report-walkthrough.md`](./report-walkthrough.md)
