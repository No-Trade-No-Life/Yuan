# signal-trader-paper-time-control 交付走查

## 目标与范围

- 目标：为 `signal-trader` 的 paper stack 增加运行态可控的时间偏移能力，使本地联调时无需修改系统时间，也能推进到 D+1 / D+2 验证 `daily burn`、capital projection、runtime replay 与 `SubmitSignal` 行为。
- 范围绑定本任务 scope：`apps/signal-trader/**`、`ui/signal-trader-web/scripts/**`、`.legion/playbook.md`。
- 本次交付只覆盖 paper 模式；live 继续使用真实时间，不引入数据库 schema 变更，也不持久化 clock 状态。

## 设计摘要

- 设计依据：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-paper-time-control/docs/rfc.md`。
- 核心方案是在 app 进程内引入 paper-only 的全局时间控制器，以“真实时间 + 全局 offset”提供统一的 paper 有效时间。
- `RuntimeManager` 持有唯一 `PaperClockController`，`RuntimeWorker` 与 manager 级 query/submit/replay 路径统一通过该控制器取时，避免同一条业务链路混用真实时间与偏移时间。
- 对外通过 paper-only services 暴露 `Get/Advance/SetOffset/ResetPaperClock`，并提供 `ui/signal-trader-web/scripts/paper-clock.mjs` 作为人类可直接调用的 CLI 入口。
- RFC 审查结论为 `PASS-WITH-NITS`，已确认 paper-only 隔离、统一取时入口与 CLI 语义均已收口：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-paper-time-control/docs/review-rfc.md`。

## 改动清单

### 1. `apps/signal-trader/**`

- 新增 paper clock 控制模型，统一封装 paper/live 两套取时语义，保证 paper 走 `effective_now_ms`，live 保持真实时间。
- runtime manager 接入全局 paper clock 的读取、推进、设置与重置能力，并作为 service 调用的唯一状态入口。
- runtime worker 将关键业务时间来源收口到统一取时方法，覆盖 paper runtime 的 replay、budget refresh、freshness gate、`QueryProjection` 与 `SubmitSignal` 等关键路径。
- signal-trader service 注册层新增 paper clock 相关 service，只在显式启用 `enablePaperClockServices` 的 paper bootstrap 中暴露，避免污染 live 接口面。
- 类型层新增 paper clock state 与 request/response 相关定义，以最小增量完成协议扩展，不改已有核心协议结构。
- 测试补足 manager / service / runtime 级最小闭环，验证时间推进、状态读取与 paper/live 隔离语义。

### 2. `ui/signal-trader-web/scripts/**`

- paper bootstrap 显式启用 paper clock services，使本地 paper stack 在运行中可接收时间控制请求。
- 新增 `paper-clock.mjs` 脚本，提供 `status`、`advance`、`set-offset`、`reset` 等人工操作入口，默认通过 Host `/request` 与本地 stack 通信。
- CLI 输出同时展示毫秒值与 ISO 时间，降低“偏移已生效但肉眼难判断”的联调成本。

### 3. `.legion/playbook.md`

- 根据 scope 预留沉淀位，用于后续将“paper-only 运行态时间控制”模式抽象为可复用 playbook；本次交付重点仍在实现与验证闭环。

## 如何验证

- 详细测试记录见：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-paper-time-control/docs/test-report.md`。
- 执行 `npm run build`（workdir=`apps/signal-trader`），预期构建通过，并且 app 内 Jest 2 个 suite / 48 个测试通过；当前存在已知 warning：Heft 对 TypeScript `5.9.3` 的版本提示与 Jest worker 未优雅退出，但不影响功能结论。
- 执行 `node common/scripts/install-run-rush.js build -t @yuants/app-signal-trader`，预期目标包与依赖链构建成功；当前存在 Node `24.13.0` 未验证与 worker forced exit warning。
- 手工 smoke：`status -> advance 1d -> reset`，预期初始 `offset_ms=0`，推进后 `offset_ms=86400000` 且有效时间前进 1 天，`reset` 后恢复到 `offset_ms=0`。
- 若需要人类复核，可按 RFC 中的操作步骤执行 `node ui/signal-trader-web/scripts/run-paper-stack.mjs start` 后，再调用 `node ui/signal-trader-web/scripts/paper-clock.mjs status|advance 1d|reset`，确认运行中 stack 可直接推进到下一天。

## 风险与回滚

- 主要风险是全局 paper offset 为单进程共享模型：多个 paper runtime 会共用同一有效时间，适合当前本地联调，但不适合未来多沙盒并行场景。
- 另一个风险是 offset 仅存于内存，stack 重启后会归零；若联调人员不了解这一点，可能误判行为切换。
- 安全面的关键约束是 paper-only service 不得泄露到 live/bootstrap 默认路径；相关审查已给出 `PASS-WITH-NITS` 结论：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-paper-time-control/docs/review-security.md`。
- 代码审查已确认核心资金/投影语义已切换到统一时间源，但仍保留少量与业务无关的真实时间戳作为后续一致性优化项：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-paper-time-control/docs/review-code.md`。
- 运行态回滚方式简单：执行 `reset` 或重启 paper bootstrap 即可恢复真实时间基线；若需代码级回滚，则撤销 paper clock controller、services 与 CLI 脚本增量即可。

## 未决项与下一步

- 当前 CLI 采用 `set-offset` 语义，没有提供“设置绝对时间戳”的命令；若后续人类 review 认为联调场景需要绝对时间定位，可在后续任务中扩展。
- 单进程全局 offset 模型已满足本轮目标，但若未来出现多 paper runtime 并行且需要独立时间线，需要升级为 runtime-scoped clock registry。
- 测试 warning 仍值得后续收尾，尤其是 app 测试退出清理问题，避免长期积累噪音。
- 人类 review 建议重点检查：paper-only 暴露面是否足够收敛、`QueryProjection` / `SubmitSignal` / replay 是否已完全共用同一时间源、CLI 命名是否与实际 offset 语义一致。
