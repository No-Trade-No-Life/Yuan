# 安全审查报告

## 结论

PASS

## 阻塞问题

- (none)

## 建议（非阻塞）

- `apps/signal-trader/src/services/paper-account-publisher-registry.ts:67` - 目前标准 `QueryAccountInfo` / `AccountInfo` 只会在 `allowAnonymousRead === true` 时注册，且 `apps/signal-trader/src/__tests__/signal-trader-app.test.ts:1978` 已补负向回归测试验证匿名读关闭时不会暴露这条标准 mock 读面；此前“绕过 signal-trader 读策略”的阻塞风险已收敛。
- `apps/signal-trader/src/services/paper-account-publisher-registry.ts:67` - 现有门禁仍只绑定 `allowAnonymousRead`，没有和 `authorizeRead` 做细粒度联动。这不构成当前安全阻塞，但如果未来要支持“需鉴权、不可匿名”的标准 `QueryAccountInfo` / `AccountInfo` 暴露，建议设计可继承 `authorizeRead` 的发布授权模型，避免后续为满足功能而重新放开未受控读面。

## 修复指导

1. 保持当前 secure-by-default 行为：非匿名读策略下不注册标准 mock 读面。
2. 如后续确实需要 authenticated-only 的标准账户读面，再引入与 `authorizeRead` 对齐的细粒度授权，不要回退到无条件注册。

[Handoff]
summary:

- 结论为 PASS。
- 标准 `QueryAccountInfo` / `AccountInfo` 现在只在 `allowAnonymousRead === true` 时注册，且已补 `allowAnonymousRead: false` 的负向回归测试，原先绕过 signal-trader 读策略的风险已关闭。
- 本轮未发现新的 blocking 安全问题。
  decisions:
- 将最终结论定为 PASS，因为新增门禁与负向测试已覆盖本次审查关注的核心暴露面风险。
  risks:
- 后续若要支持非匿名标准读面，需要补齐与 `authorizeRead` 一致的细粒度授权模型。
  files_touched:
- path: /Users/c1/Work/signal-trader/.legion/tasks/signal-trader-mock-exchange-account-ui/docs/review-security.md
  commands:
- (none)
  next:
- 仅在未来扩展 authenticated-only 标准读面时再做一次权限模型复审。
  open_questions:
- (none)
