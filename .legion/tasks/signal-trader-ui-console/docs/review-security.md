# 安全审查报告

## 结论

PASS

## 阻塞问题

- （无）

## 建议（非阻塞）

- `apps/signal-trader/src/runtime/runtime-manager.ts:152-167`、`apps/signal-trader/src/runtime/runtime-manager.ts:43-60` `[STRIDE: Information Disclosure / Denial of Service]` `QueryRuntimeAuditLog` 相比通用 SQL 已明显收敛：只允许按 `runtime_id` 查询、无任意 where/order、读权限统一走 `authorizeRead`。但当前返回的 `detail` 仍是“整对象透传后裁剪”，历史 `unlock/backfill` 记录里的 `audit_context`、外部订单号等字段仍可能被前端读到；同时分页是在 `listByRuntime(runtime_id)` 全量取回后再内存裁剪，长期存在体积膨胀与响应放大风险。建议后端把 audit response 收敛为 action-specific DTO/子字段白名单，并把 limit/cursor/窗口限制前推到 repository/SQL 层。
- `ui/web/src/modules/SignalTrader/SignalTraderConsole.tsx:128-138`、`ui/web/src/modules/SignalTrader/SignalTraderConsole.tsx:480-489`、`apps/signal-trader/src/runtime/runtime-worker.ts:200-271` `[STRIDE: Tampering / Denial of Service]` `metadata` 的 JSON object 与 4000 字符限制只在前端执行；直接调用 `SignalTrader/SubmitSignal` 的客户端可绕过该限制，把超大或异常结构的 `metadata` 送入后端事件链路。当前权限边界仍在服务端 `authorize`，因此不构成越权 blocker，但建议在服务端对 `command.metadata` 做类型/大小上限校验，并在拒绝时返回稳定错误码。
- `apps/signal-trader/src/services/signal-trader-services.ts:42-50`、`apps/signal-trader/src/services/signal-trader-services.ts:135-173` `[STRIDE: Spoofing / Elevation of Privilege]` 当前服务默认是 secure-by-default：未配置 `authorizeRead` 时读请求拒绝，未显式打开 `enableMutatingServices` 时写服务不会注册，这点是加分项。但一旦宿主使用宽松的 `allowAnonymousRead` 或未按 `runtime_id` 做细粒度 `authorize/authorizeRead`，前端的 `runtime_id` 选择与 live confirm 都只是 UX 护栏，不是安全边界。建议在接入文档里明确要求生产策略必须按 `serviceName + runtime_id` 授权，且不要对 audit/health/config 开匿名读。
- `apps/signal-trader/src/runtime/runtime-manager.ts:155-166` `[STRIDE: Tampering / Denial of Service]` `limit/cursor` 目前只做 `Math.trunc` 与区间裁剪，没有先做 `Number.isFinite` 收口。非常规数值输入会让分页语义变得不直观，并削弱 200 条上限的防线。建议先显式数值化并拒绝/回退非法值。
- 依赖与凭证检查：本次审查范围内未见新增依赖、未见硬编码密钥/凭证；`ListRuntimeConfig` 继续默认屏蔽 `secret_ref`（`apps/signal-trader/src/services/signal-trader-services.ts:11-14,106-111`），方向正确。

## 修复指导

1. 为 `SignalTrader/QueryRuntimeAuditLog` 增加服务端投影层：按 `action` 输出稳定 DTO，默认去掉/脱敏 `audit_context.request_id`、`source`、外部订单号等非 GUI 必需字段。
2. 把 audit log 分页下推到 repository/SQL：`WHERE runtime_id = ? AND seq < ? ORDER BY seq DESC LIMIT ?`，避免全量拉取后内存裁剪。
3. 在后端 `SubmitSignal` 入口增加 `command` 校验：至少校验 `signal` 枚举、`metadata` 必须为普通对象、总字节数上限、嵌套深度上限。
4. 在宿主接入文档中把 `servicePolicy` 写成强约束：生产默认关闭 `allowAnonymousRead`，并要求 `authorizeRead/authorize` 基于 `runtime_id` 做最小权限授权与审计。

[Handoff]
summary:

- `QueryRuntimeAuditLog` 已比通用 SQL 方案明显收敛，当前未见 blocker 级越权路径。
- live submit 前端 recheck + 后端 freshness/status/scope gate 形成了较完整的 fail-close 闭环。
- 主要遗留风险是 audit `detail` 仍偏宽、metadata 限制仅在前端、以及 audit 分页未下推到存储层。
  decisions:
- (none)
  risks:
- 审计 detail 仍可能向有读权限的 GUI 用户暴露超出最小必要的 operator/audit 上下文字段。
- 直接调用 `SubmitSignal` 可绕过前端 metadata 大小限制。
- audit log 全量拉取后再裁剪，长期有响应放大与资源消耗风险。
  files_touched:
- path: /Users/c1/Work/signal-trader/.legion/tasks/signal-trader-ui-console/docs/review-security.md
  commands:
- (none)
  next:
- 先补 `QueryRuntimeAuditLog` 的 detail 白名单/脱敏与 SQL 层分页。
- 再补 `SubmitSignal` 服务端 metadata 校验，避免把 UI 校验误当安全边界。
  open_questions:
- (none)
