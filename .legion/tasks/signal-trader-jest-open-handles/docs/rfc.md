# RFC: 修复 signal-trader 的 Jest open handles / worker forced exit

## 背景与问题

`@yuants/app-signal-trader` 当前在 `npm run build`（实际执行 `heft test --clean`）以及 Rush 定向构建时，会出现 Jest `A worker process has failed to exit gracefully and has been force exited` 警告。该警告说明测试结束后仍有 Node handle 存活，属于真实 teardown 缺口，而不是可忽略的输出噪音。

结合当前代码，问题主要集中在 live runtime 的 observer loop：

- `RuntimeWorker.startObserverLoop()` 会基于 `setTimeout` 周期调度观察任务，且成功 boot 后自动启动循环，见 `apps/signal-trader/src/runtime/runtime-worker.ts:640`。
- `RuntimeManager` 与多处测试会直接创建 worker/manager，但测试文件没有统一的销毁钩子，`manager.dispose()` 也未被系统性调用，见 `apps/signal-trader/src/__tests__/signal-trader-app.test.ts:125`、`apps/signal-trader/src/__tests__/signal-trader-app.test.ts:210`、`apps/signal-trader/src/__tests__/signal-trader-app.test.ts:1518`。
- 虽然当前 `scheduleObserverTick()` 已对 timer 调用 `unref()`，见 `apps/signal-trader/src/runtime/runtime-worker.ts:48`，但这只能降低 timer 阻塞进程退出的概率，不能替代显式生命周期回收。

本 RFC 的目标是用最小修复消除真实 open handles：保留 `timer.unref()` 作为兜底，同时补齐测试与运行时的 dispose 生命周期，避免继续依赖 Jest 强制退出。

## 动机

- 让 CI / 本地构建输出恢复干净，避免掩盖真正的资源泄漏。
- 明确 live runtime 的启动与销毁边界，降低后续继续添加 observer 能力时再次引入泄漏的概率。
- 坚持最小修复，不借助 `--forceExit`、禁用测试或吞掉 warning 这类假修复。

## 目标与非目标

### 目标

- 修复 `apps/signal-trader` 测试触发的 open handles / worker forced exit。
- 让 live observer loop 在测试结束和对象淘汰时可被稳定回收。
- 保持现有业务语义不变，不改变 observer 轮询频率、health 语义和 service 协议。

### 非目标

- 不升级 Jest / Heft / Rush 测试框架。
- 不引入新的全局测试 harness 或大规模重构测试结构。
- 不通过延长超时、增加 sleep、`--forceExit` 或过滤 stderr 方式压制症状。

## 定义

- `open handle`：Jest 结束后仍持有的异步资源，如 timer、socket、未完成 promise 驱动的底层句柄等。
- `observer loop`：live runtime 周期调用 `observeOnce()` 的轮询逻辑，由 `RuntimeWorker.startObserverLoop()` 驱动。
- `dispose`：显式停止 loop 并释放关联资源的生命周期动作；本 RFC 中不要求做复杂的异步 drain，只要求停止后不再继续调度。

## 根因分析

### 根因 1：live worker 会自动启动轮询，但测试未形成对称 teardown

只要 runtime 以 live 模式成功 boot，`RuntimeWorker.boot()` 就会调用 `startObserverLoop()`，见 `apps/signal-trader/src/runtime/runtime-worker.ts:181` 与 `apps/signal-trader/src/runtime/runtime-worker.ts:223`。而测试文件中大量 case 会新建 `RuntimeManager` 并调用 `upsertRuntimeConfig()` 启动 live runtime，但没有统一 `afterEach` 回收 manager，导致上一个 case 的 observer timer 可能延续到文件结束。

### 根因 2：`timer.unref()` 只能兜底，不能代替生命周期关闭

`scheduleObserverTick()` 里的 `timer.unref()` 已经是正确方向，但它只表示“如果只剩这个 timer，不要阻止进程退出”。若测试进程同时还持有其他待完成工作，或 timer 在 case 之间不断重新注册，Jest 仍可能判定 worker 未优雅退出。因此 `unref` 必须保留，但不能作为唯一修复手段。

### 根因 3：当前应用层缺少更高层的 dispose 出口

`RuntimeManager` 已有 `dispose()`，见 `apps/signal-trader/src/runtime/runtime-manager.ts:116`，`RuntimeWorker` 也有 `dispose()`，见 `apps/signal-trader/src/runtime/runtime-worker.ts:386`。但 `createSignalTraderApp()` 当前只暴露 `start()`，未暴露统一销毁出口，见 `apps/signal-trader/src/app.ts:28`。这意味着测试、bootstrap 或未来集成代码容易只关心启动，不关心关闭，形成生命周期断层。

## 方案设计

### 设计概览

采用“两层兜底、一个收口”的最小修复：

1. 保留并继续依赖 `observer timer unref`，确保轮询 timer 本身不会单独阻塞进程退出。
2. 把 `dispose` 变成实际使用的生命周期契约：任何创建 live `RuntimeManager` / app 的测试和运行入口，都必须在结束时显式调用销毁逻辑。
3. 在测试侧引入统一回收，而不是逐个 case 手写清理，减少遗漏概率。

### 端到端流程

1. 测试或 app 创建 `RuntimeManager`。
2. live runtime boot 成功后启动 observer loop。
3. case 完成或 app 结束时，统一调用 `manager.dispose()`（若通过 app 创建，则调用 app 提供的 `dispose()`）。
4. `RuntimeWorker.dispose()` 调用 `stopObserverLoop()`，清除已挂起 timer，并将 `observerLoopActive=false`，从而阻止 in-flight tick 在 finally 中再次注册 timer。
5. Jest worker 在所有 case 结束后不再残留 signal-trader 自身创建的 timer handle。

### 组件边界

- `RuntimeWorker`：负责 observer loop 的启动、停止与“停止后不再重调度”。
- `RuntimeManager`：负责聚合销毁所有 worker，作为测试与 app 主要回收入口。
- `createSignalTraderApp()`：建议补充 app 级 `dispose()`，把 manager 生命周期向上暴露，避免调用方直接依赖内部字段。
- `signal-trader-app.test.ts`：新增统一 teardown 注册点，确保每个测试创建的 manager 必被 dispose。

## 数据模型与接口

本次不新增持久化数据结构；仅补齐生命周期接口约定。

### 建议接口调整

1. `createSignalTraderApp()` 返回值新增 `dispose(): void`，内部委托 `runtimeManager.dispose()`。
2. 测试文件增加局部 manager registry，例如 `const disposables: Array<{ dispose(): void }>`，在 `afterEach` 中统一清理。
3. 如测试内直接创建 `RuntimeManager`，必须通过同一 helper 注册，避免遗漏。

### 兼容策略

- `dispose()` 为新增能力，不改变已有 `start()`、service handler、runtime config、query/write API 的输入输出。
- 若现有调用方不使用新增 `app.dispose()`，行为与今天一致；只是仍可能继续承担资源泄漏风险。

## 错误语义

- `dispose()` 应设计为幂等：重复调用不抛错，不要求调用方判断状态。
- `dispose()` 的首要语义是“停止后续调度”，而不是等待所有历史异步任务完成；因此它应当可快速返回。
- 若 dispose 期间某个 worker 已不存在 timer，视为正常无操作。
- 测试验证以“构建输出不再出现 worker forced exit”为准，而不是依赖 Jest open-handle 明细打印。

## 安全性考虑

本修复不改变权限、资金流、订单协议，但仍需注意：

- 不要为了解决测试退出问题而绕过真实错误，例如吞掉 observer 异常或静默忽略 dispose 失败。
- 新增生命周期 helper 只应管理对象销毁，不应注入额外 mock 权限或改变 service 暴露面。
- 若补充 app 级 `dispose()`，不得隐式关闭外部不属于 signal-trader 的资源，边界应保持在 runtime manager / service registration 自身。
- 对测试 helper 的输入保持最小约束，避免因为“泛用 teardown 容器”误收纳无关对象，造成误清理。

## 替代方案

### 方案 A：仅依赖 `timer.unref()`，不补 dispose

不选原因：当前代码已经做了 `unref`，warning 仍存在，说明它不是充分条件。继续只靠 `unref` 属于已被现状证伪的修补。

### 方案 B：在 Jest / Heft 配置层启用 `--forceExit` 或过滤 warning

不选原因：这是压制症状，不是修复根因；同时会掩盖未来真实资源泄漏，与任务约束直接冲突。

### 方案 C：重构整个测试框架，统一 fake timers / integration harness

不选原因：投入明显超出本任务 scope，且会扩大改动面与回归风险。当前问题已有明确聚焦点，应优先最小闭环修复。

## 向后兼容、发布与回滚

### 向后兼容

- 运行时业务行为保持不变。
- 新增 `dispose()` 仅是可选增强，对现有调用点兼容。
- 测试改动只影响资源回收，不应改变断言结果。

### 发布 / 落地顺序

1. 先补测试侧统一 teardown，确保本地可复现并验证 warning 消失。
2. 再补 app 级 dispose 收口，减少未来集成代码再次遗漏。
3. 最后用 `npm run build` 与 Rush 定向 build 双路径回归。

### 回滚策略

- 若 teardown 改动引入测试行为异常，优先回滚新增 helper / `afterEach` 组织方式，保留现有业务逻辑不动。
- 若 app 级 `dispose()` 影响现有集成，可单独回滚该暴露接口，测试侧回收方案仍可保留。
- 回滚判据：出现业务断言变化、live/paper 行为差异，或 observer 在运行态被过早关闭。

## 验证计划

### 关键行为与验收映射

1. live runtime 启动后，测试结束会统一触发 dispose，不再遗留 signal-trader 自建 timer。
2. `RuntimeWorker.dispose()` 后即使存在 in-flight observer，循环也不会再次注册下一次 tick。
3. `npm run build` 在 `apps/signal-trader` 下执行，不再出现 worker forced exit。
4. `node common/scripts/install-run-rush.js build -t @yuants/app-signal-trader` 不再出现 worker forced exit。
5. 现有测试断言保持通过，尤其是 live audit_only、paper clock、service 暴露等行为不变。

### 建议验证步骤

- 单包：在 `apps/signal-trader` 下执行 `npm run build`。
- 仓库级：在根目录执行 `node common/scripts/install-run-rush.js build -t @yuants/app-signal-trader`。
- 定点观察：如仍有 warning，临时用 Jest `--detectOpenHandles` 或等价调试方式定位，但不把该开关纳入常规脚本。
- 代码级检查：确认测试文件存在统一 `afterEach` 回收，且新增 manager/app 创建点均经过注册 helper。

## 风险

- 若测试在断言后仍依赖 manager 后台异步继续推进，统一 dispose 可能暴露原本被隐藏的时序问题。
- 若 app 级 `dispose()` 设计边界不清，可能误让调用方以为它会关闭 terminal 之外的外部资源。
- 若仅清理测试入口、遗漏少量创建点，warning 可能下降但不会完全消失。

## 未决问题

- 是否需要让 `registerSignalTraderServices()` 返回 composite disposable，以便 app 级生命周期更完整？本任务可先不做，只要问题已由 manager 生命周期闭环解决。
- 是否需要在未来为 `RuntimeManager.start()` / `upsertRuntimeConfig()` 增加更显式的“started/stopped”状态？当前不是本轮必需。

## 里程碑

### M1：确认并固定最小根因

- 明确 warning 来自 live observer loop 生命周期未闭环，而不是 Jest 配置问题。
- 产出标准：代码证据与失败路径能对应到 `RuntimeWorker.startObserverLoop()` + 测试未 dispose。

### M2：实现最小修复

- 测试侧增加统一 teardown helper / `afterEach`。
- 视需要补充 `createSignalTraderApp().dispose()` 作为上层收口。
- 保持 `timer.unref()` 与 `RuntimeManager.dispose()` 语义一致，不做框架级重构。

### M3：构建回归与收口

- 跑通单包 build 与 Rush 定向 build。
- 确认无 worker forced exit，且原有测试全部通过。

## 落地计划

### 预计变更点

- `apps/signal-trader/src/__tests__/signal-trader-app.test.ts`
  - 增加统一生命周期回收 helper 与 `afterEach`。
  - 将测试内新建的 `RuntimeManager` 纳入统一注册。
- `apps/signal-trader/src/app.ts`
  - 视实现需要新增 app 级 `dispose()`，统一对外暴露 runtime manager 销毁入口。
- `apps/signal-trader/src/runtime/runtime-manager.ts`
  - 仅在必要时补充幂等性或类型约束；不预期大改。
- `apps/signal-trader/src/runtime/runtime-worker.ts`
  - 原则上保留现有 `timer.unref()` + `stopObserverLoop()` 设计，仅在验证发现缺口时做最小补强。

### 验证步骤

1. 运行 `apps/signal-trader` 单包 build，确认无 worker forced exit。
2. 运行 Rush 定向 build，确认仓库级调用也无 worker forced exit。
3. spot check 至少一条 live case 和一条 paper case，确认行为未变。
