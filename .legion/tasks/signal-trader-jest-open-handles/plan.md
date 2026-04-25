# signal-trader-jest-open-handles

## 目标

修复 `@yuants/app-signal-trader` 在 build/test 时的 Jest open handles / worker forced exit 问题，并交付完整 Legion 文档。

## 问题定义

- 当前 `apps/signal-trader` 的测试在 `npm run build` 与 Rush build 下会出现：
  - `A worker process has failed to exit gracefully and has been force exited`
- 这说明 Jest 结束后仍有 open handles，最可能是 runtime observer loop 的定时器没有被正确释放或允许进程退出。
- 该问题虽然不阻断测试通过，但会污染 CI / 本地信号，也会掩盖真正的 teardown 问题。

## 验收标准

- `apps/signal-trader` 的 `npm run build` 不再出现 worker forced exit warning。
- `node common/scripts/install-run-rush.js build -t @yuants/app-signal-trader` 不再出现 worker forced exit warning。
- 若需要引入清理接口，应保证 runtime 生命周期更清晰，不影响现有功能行为。
- 生成并落盘：
  - `docs/rfc.md`
  - `docs/review-rfc.md`
  - `docs/test-report.md`
  - `docs/review-code.md`
  - `docs/review-security.md`
  - `docs/report-walkthrough.md`
  - `docs/pr-body.md`

## 假设

- 根因优先考虑 observer loop 的 `setTimeout` 持有进程，特别是 live runtime 在测试中启动后没有显式 dispose。
- 首版修复优先做最小改动：让 observer 定时器不阻止进程退出，并补一个显式 `dispose()` 入口，避免大规模重构测试。

## 约束

- 文档语言使用中文；代码默认 ASCII。
- Scope 限制在：
  - `.legion/tasks/signal-trader-jest-open-handles/**`
  - `apps/signal-trader/**`
  - `.legion/playbook.md`
- 不通过 `--forceExit`、禁用测试或吞 warning 的方式“假修复”。

## 风险分级

- **等级**：Low
- **标签**：`continue` `test` `teardown`
- **理由**：这是工程性修复，不改变业务协议或资金语义；主要风险是误伤 observer loop 行为，因此仍需最小设计和验证。

## 要点

- 先查 open handles 根因，再做最小修复
- 优先修 observer timer / lifecycle，不走粗暴 `forceExit`
- build/test 输出要真正安静下来

## 范围

- `.legion/tasks/signal-trader-jest-open-handles/**`
- `apps/signal-trader/**`
- `.legion/playbook.md`

## Design Index

- `apps/signal-trader/src/runtime/runtime-worker.ts`
- `apps/signal-trader/src/runtime/runtime-manager.ts`
- `apps/signal-trader/src/__tests__/signal-trader-app.test.ts`
- 本任务 RFC：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-jest-open-handles/docs/rfc.md`

## 最小实现边界

- 包含：observer timer teardown 修复、必要的 manager dispose、build/test 验证、任务文档。
- 暂不包含：测试框架升级、Heft/Jest 工具链大改。

## 阶段概览

1. **调研与设计** - 2 个任务
2. **实现** - 2 个任务
3. **验证与交付** - 2 个任务

---

_创建于: 2026-03-24 | 最后更新: 2026-03-24 14:35_
