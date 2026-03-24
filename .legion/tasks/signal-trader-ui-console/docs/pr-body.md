## What

- 新增 `SignalTraderConsole`，在 `ui/web` 提供一个最小可用的 signal-trader 控制台页面，统一收敛 runtime 选择、状态查看、`SubmitSignal`、projection、event stream 与 audit log。
- 新增只读服务 `SignalTrader/QueryRuntimeAuditLog`，用于按 `runtime_id` 返回受限审计字段，替代 GUI 复用通用 SQL 直读 audit 的方案。

## Why

- 现有 `@yuants/app-signal-trader` 已具备 runtime / health / projection / event / submit 等服务面，但缺少一个可直接复用的 GUI 控制台，日常联调、paper 验证与 live 值班排障成本较高。
- 这次交付的重点不是“更方便地下单”，而是把 high-risk control-plane 的读取边界、live submit gate 与 fail-close 行为收敛成一个可审查、可回滚的最小前端入口。

## How

- 前端读取统一走 `SignalTrader/*` 服务；审计读取改为调用新增的 `SignalTrader/QueryRuntimeAuditLog`。
- `live submit gate / fail-close` 关键行为已落地：存在 `loading/error/stale`、health 非 `normal`、runtime 未启用、提交前 recheck 失败或 live 二次确认 `runtime_id` 不匹配时，一律禁用或阻断提交；不做“尽量提交”。
- 文档同步更新 `apps/signal-trader/GUIDE.md` 与 `docs/zh-Hans/packages/@yuants-ui-web.md`，说明 `SignalTraderConsole` 与新的 audit 读取边界。

## Testing

- 详见 [`test-report.md`](./test-report.md)
- `apps/signal-trader`：`npm run build` 通过（Heft build + Jest 通过）
- `ui/web`：`npm run build` 未通过，但被仓库既有 workspace 依赖解析问题阻塞；当前报错未直接指向新增的 `SignalTraderConsole`

## Risk / Rollback

- 已知风险：audit DTO 白名单仍需进一步收紧；audit 查询分页尚未下推到 repository / SQL 层；`metadata` 后端限制仍待补齐。
- 回滚方式：可先隐藏 `SignalTraderConsole` 入口；也可撤销宿主对 `SignalTrader/SubmitSignal` 的 live 写权限，使页面退化为只读。

## Links

- Plan：[`../plan.md`](../plan.md)
- RFC：[`./rfc.md`](./rfc.md)
- Review RFC：[`./review-rfc.md`](./review-rfc.md)
- Review Code：[`./review-code.md`](./review-code.md)
- Review Security：[`./review-security.md`](./review-security.md)
- Walkthrough：[`./report-walkthrough.md`](./report-walkthrough.md)
