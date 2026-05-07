# 代码审查报告

## 结论

PASS

## 阻塞问题

- （无）

## 建议（非阻塞）

- `apps/signal-trader/src/runtime/runtime-manager.ts:155-163` - `limit/cursor` 目前只做了 `Math.trunc` + 区间裁剪，但没有对非有限数值做显式兜底。若收到 `NaN`/字符串等异常输入，分页行为会变得不直观，甚至可能退化为返回超出预期的整页数据。当前不构成 blocker，但建议把服务边界收紧为“仅接受有限数字”。
- `apps/signal-trader/src/runtime/runtime-manager.ts:43-60` - 审计日志已增加文本截断与 detail 深度裁剪，整体方向正确；不过还没有限制对象/数组宽度或总响应体积。现阶段可接受，但后续若 `detail` 结构继续膨胀，建议补总大小上限或白名单投影，避免 UI 表格被超大 payload 拖垮。
- `ui/web/src/modules/SignalTrader/SignalTraderConsole.tsx:153-157,324-337,458-460` - 前端 stale 判定仍基于本地 `poll_interval_ms * 3` 推导，并未完全复用后端 health 语义。现在最终 recheck 已经补上，所以正确性过关；但长期看仍有前后端规则漂移风险。

## 修复指导

1. 对 `QueryRuntimeAuditLog` 的 `req.limit` / `req.cursor` 先做显式数值化与 `Number.isFinite` 判断，再进入裁剪逻辑；非法值直接回退到默认值或拒绝请求。
2. 为 audit log response projector 增加更明确的体积护栏，例如：限制 `detail` 顶层 key 数、数组长度，或在 service 层按白名单映射成更稳定的 DTO。
3. 若后端后续提供更明确的 freshness/stale 字段，前端应优先直接消费该语义，避免继续维护一套 UI 本地推导规则。

## 复核摘要

- `ui/web/src/modules/SignalTrader/SignalTraderConsole.tsx:446-460` - 之前的 blocker 已修复：最终提交前会重新读取 health，并同时校验 `status !== 'normal'` 与 `getHealthStale(...)`，live submit 已恢复 stale/expired fail-close。
- `ui/web/src/modules/SignalTrader/SignalTraderConsole.tsx:421-423,446-489` - preview 与实际提交 payload 现已基本对齐：提交时优先复用同一个 `submitCommand` 对象，`signal_id` / `upstream_emitted_at` 不再二次生成后悄悄漂移。
- `apps/signal-trader/src/runtime/runtime-manager.ts:152-167,38-60` - `QueryRuntimeAuditLog` 当前边界基本可接受：按 `runtime_id` 查询，`limit` 被夹在 `1..200`，并对 `note/evidence/detail` 做了截断/裁剪，未见 blocker 级泄露或越权问题。

[Handoff]
summary:

- 已重新审查 signal-trader-ui-console 当前代码改动，本轮结论为 PASS。
- 上一轮 blocker（live submit 最终 recheck 未 fail-close stale health）已确认修复。
- 仍有少量非阻塞建议，主要集中在 QueryRuntimeAuditLog 的异常输入收口与长期体积护栏。
  decisions:
- (none)
  risks:
- `QueryRuntimeAuditLog` 对非有限数值输入的容错仍偏宽松。
- 前端 stale 规则与后端 health 语义长期仍有漂移风险。
  files_touched:
- path: /Users/c1/Work/signal-trader/.legion/tasks/signal-trader-ui-console/docs/review-code.md
  commands:
- (none)
  next:
- 如要继续收口服务边界，优先补 `limit/cursor` 的有限数值校验。
- 如 audit detail 预计继续扩张，再补总大小/宽度限制。
  open_questions:
- (none)
