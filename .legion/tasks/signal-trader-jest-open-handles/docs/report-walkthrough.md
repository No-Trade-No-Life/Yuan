# signal-trader-jest-open-handles 交付报告

## 目标与范围

- 目标：修复 `@yuants/app-signal-trader` 在 `npm run build` 与 Rush 定向 build 中出现的 Jest open handles / worker forced exit 问题，并补齐可供评审与交接的交付文档。
- 范围绑定本任务 `scope`：
  - `apps/signal-trader/**`
  - `.legion/playbook.md`
- 本次实际交付重点落在 `apps/signal-trader` 运行时生命周期修复与验证；`.legion/playbook.md` 未作为本轮必要改动面。

## 设计摘要

- 设计依据见 RFC：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-jest-open-handles/docs/rfc.md`。
- 核心判断：warning 的主要来源不是 Jest/Heft 配置，而是 live runtime observer loop 在测试结束后仍可能留下活动 timer，导致 worker 无法优雅退出。
- 采用最小修复策略：保留 observer timer 的 `unref()` 兜底，让残留 timer 不阻塞进程退出；同时补齐 `RuntimeManager.dispose()` 生命周期出口，避免后续继续积累 teardown 缺口。
- 设计审查结论见：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-jest-open-handles/docs/review-rfc.md`，结论为 `PASS-WITH-NITS`，允许按最小修复面落地。

## 改动清单

### `apps/signal-trader/src/runtime/runtime-worker.ts`

- 将 observer loop 的定时调度统一收口到 `scheduleObserverTick()`。
- 对 observer timer 调用 `unref()`，确保该 timer 不会单独持有 Node 进程。
- 保持 `stopObserverLoop()` / `dispose()` 的停止语义，使轮询在销毁后不再继续重调度。

### `apps/signal-trader/src/runtime/runtime-manager.ts`

- 补齐并明确 `RuntimeManager.dispose()` 的生命周期职责。
- 由 manager 聚合清理其持有的 worker，减少测试或调用方遗漏底层 worker 清理的概率。

### `apps/signal-trader` 测试与构建链路

- 本轮验证覆盖 `apps/signal-trader` 的 Heft/Jest build 与 Rush 定向 build。
- 未引入 `--forceExit`、未吞 warning、未通过禁用测试掩盖问题，符合任务约束。

### `.legion/tasks/signal-trader-jest-open-handles/docs/*`

- 补齐 RFC、RFC review、test report、code review、security review，并在本次新增交付 walkthrough 与 PR body。

## 如何验证

- 详细测试记录见：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-jest-open-handles/docs/test-report.md`。
- 建议按以下命令复核：
  1. `npm run build`（workdir=`apps/signal-trader`）
     - 预期：构建通过；Jest `50/50` 通过；不再出现 `A worker process has failed to exit gracefully and has been force exited`。
  2. `node common/scripts/install-run-rush.js build -t @yuants/app-signal-trader`
     - 预期：Rush 定向构建通过；不再出现 worker forced exit warning。
  3. `npx jest lib/__tests__/signal-trader-app.test.js --runInBand --detectOpenHandles`
     - 预期：`39/39` 通过；进程不会因 signal-trader 自身 observer timer 残留而挂住。
- 当前剩余输出仅为工具链/环境提示，不属于本任务修复对象：
  - Heft 对 TypeScript `5.9.3` 的版本提示
  - `npm warn Unknown env config "tmp"`
  - Rush 对 Node `24.13.0` 的未验证提示

## 风险与回滚

### 风险

- 本次属于低风险工程修复，不改变 live/paper 业务语义、权限边界或资金相关逻辑。
- 主要风险在于 observer loop 生命周期调整若边界不清，可能影响少量依赖后台轮询时序的测试或集成代码。
- 代码审查与安全审查结论均为 `PASS`：
  - `review-code.md`：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-jest-open-handles/docs/review-code.md`
  - `review-security.md`：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-jest-open-handles/docs/review-security.md`

### 回滚

- 若发现本次生命周期收口影响现有运行时行为，可优先回滚 `RuntimeManager.dispose()` 相关新增或调用路径。
- 若问题集中在 observer loop 调度策略，可单独回滚 `runtime-worker` 中本轮与 timer 生命周期相关的实现，而不必回退整个包的其他逻辑。
- 回滚判据：重新出现业务断言变化、运行态 observer 被过早停止、或 live/paper 行为与修复前不一致。

## 未决项与下一步

- RFC review 与 code review 均提到一个非阻塞后续项：测试侧仍可继续补统一 teardown / disposable 注册，进一步强化生命周期纪律。
- `createSignalTraderApp().dispose()` 作为更高层生命周期收口点，本轮未扩大到必须落地；如后续继续增加 app 级后台资源，建议补齐。
- `.legion/playbook.md` 可在下一轮沉淀“后台轮询器默认采用 `unref + dispose` 模式”的复用经验，但不阻塞本次合入。
