# 安全审查报告

## 结论

PASS

本次仅复核两点：

- capability gate 是否已在建立 clients/对外连接之前执行：**已收敛**
- 之前的安全 blocking issues 是否已全部收敛：**已收敛**

## 阻塞问题

- [x] 无

## 建议（非阻塞）

- 建议保留并固化一条回归测试：`read-sensitive` / `write` / `destructive` 命令在未过 gate 时，不得触发 `TerminalGateway.ensure()`。
- 建议后续若新增 `remote-proxy` 类命令，继续沿用“先 preflight/gate，后惰性建连”的顺序，避免回退。
- 建议对安全门顺序在设计/RFC 或测试命名中做显式标注，便于后续重构时守住 secure-by-default。

## 修复指导

- 本轮无需新增阻塞修复。
- 当前顺序已满足“先 gate，后建连”：`tools/yuanctl/src/cli/index.ts` 先执行 `checkCapabilityGate(..., createPreflightContext(...))`，随后才调用 `createRuntimeContext()`；而 `TerminalGateway.ensure()` 仅在 `createRuntimeContext()` 的 clients 分支中触发。

## 复核说明

- `tools/yuanctl/src/cli/index.ts:47-48` 已调整为先 `checkCapabilityGate()`，后 `createRuntimeContext()`，之前“被拒绝命令仍先触发对外连接”的阻塞路径已关闭。
- `tools/yuanctl/src/cli/runtime-context.ts:116-125` 的 `createPreflightContext()` 不含 clients 初始化或网络副作用；真实建连仍在 `tools/yuanctl/src/cli/runtime-context.ts:106-110` 的 clients 分支内，顺序正确。
- 之前报告中的其余 blocking 范围本轮未见回退：deploy 默认输出仍做最小化裁剪，错误仍保持脱敏，config 写入/host URL 校验仍在位，未见新增硬编码密钥/凭证。

[Handoff]
summary:

- 已完成 tools/yuanctl 当前改动的最终安全复查，聚焦 capability gate 顺序与历史 blocking issue 收敛情况。
- 结论为 PASS：当前已实现先 gate、后 createRuntimeContext、再按需建连。
- 之前安全 blocking issues 本轮未见残留或回退。
  decisions:
- (none)
  risks:
- 后续若新增 remote-proxy/clients 类命令，需继续防止 gate 顺序回退。
  files_touched:
- path: /Users/c1/Work/agent-access/.legion/tasks/yuanctl-cli/docs/review-security.md
  commands:
- (none)
  next:
- 如后续继续扩命令面，补一条“未过 gate 不建连”的显式回归测试即可。
  open_questions:
- (none)
