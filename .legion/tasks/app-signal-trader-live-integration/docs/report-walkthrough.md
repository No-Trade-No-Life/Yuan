# `@yuants/app-signal-trader` 交付 walkthrough

## 1. 目标与范围

- **目标**：交付可部署的 `@yuants/app-signal-trader` 宿主应用，把 `@yuants/signal-trader` 从纯 core library 提升为可运行、可重放、可审计的 `paper/live` runtime。
- **范围绑定**：本次改动仅覆盖以下路径：
  - `apps/signal-trader/**`
  - `libraries/signal-trader/**`
  - `tools/sql-migration/sql/**`
  - `rush.json`
  - `common/config/rush/**`

## 2. 设计摘要

- 设计来源：[`../plan.md`](../plan.md)、[`./rfc.md`](./rfc.md)、[`./review-rfc.md`](./review-rfc.md)。
- 本次实现延续 RFC 的宿主化方案：由 app 宿主负责 runtime orchestration、事件持久化、checkpoint、execution adapter、observer/reconciliation、控制面服务与审计；core library 继续只负责事件、投影与 effect 语义。
- live 支持矩阵已不再由 app 内部 OKX 白名单决定，而是由 capability registry + canonical capability key `observer_backend` 决定；宿主通过显式 descriptor 声明 support matrix，并新增 `SignalTrader/ListLiveCapabilities` 供只读枚举。
- fail-close 状态机已收敛：
  - **boot / preflight 失败**（如 descriptor 缺失、不匹配、能力不足、observer/provider 未就绪、首次准入校验失败）=> `stopped`
  - **运行中安全异常**（如 binding 冲突、unknown terminal state、reconciliation mismatch、缺失关键外部 ID、观测链升级为不可接受）=> `audit_only`
- operator 审计身份不再信任请求体自报字段，而是通过 `servicePolicy.resolveOperatorAuditContext(...)` 注入受信主体并写入审计日志。

## 3. 改动清单（按模块/文件）

### 3.1 `apps/signal-trader/**`

- 新增 `@yuants/app-signal-trader` 宿主应用，补齐 runtime manager / worker、命令串行化、replay、checkpoint、health 与控制面服务。
- 实现 `paper` 与 `live` 双执行路径：
  - `paper` 提供本地可复现闭环；
  - `live` 通过宿主注入的 `liveVenue` / `observerProvider` 执行，并在 boot 与 upsert 阶段执行 capability descriptor 校验。
- 新增 capability registry 收口与 `SignalTrader/ListLiveCapabilities`，让宿主 support matrix 可枚举、可审计，而不是隐式写死在 app 内部。
- 收紧 fail-close 语义：boot/preflight 失败固定停在 `stopped`，运行中安全异常统一锁到 `audit_only`。
- 补齐 runtime audit log，并把 operator 审计身份统一切到 `servicePolicy.resolveOperatorAuditContext(...)`。
- 保留并强化 observer / reconciliation / freshness gate，确保 submit 前与运行中观测使用同一套安全门禁。

### 3.2 `libraries/signal-trader/**`

- 维持 core library 的事件语义边界，不把宿主风险控制扩散为 domain 语义改写。
- 补充与宿主接入相关的测试，覆盖 replay、paper 闭环、live fail-close 与 capability registry 契约。

### 3.3 `tools/sql-migration/sql/**`

- 新增 signal trader 所需 migration，覆盖 runtime config、event、order binding、runtime checkpoint 等持久化表。
- 审计与恢复链路继续依赖 SQL 持久化，确保 runtime 可回放、可诊断、可人工接管。

### 3.4 `rush.json` / `common/config/rush/**`

- 将 `@yuants/app-signal-trader` 注册进 Rush 工程与依赖图，使构建、测试与发布链路能识别新 app。

## 4. 如何验证

参考 [`./test-report.md`](./test-report.md)：

### 4.1 执行命令

```bash
npm run build
```

工作目录：`apps/signal-trader`

### 4.2 预期结果

- 构建与单包测试通过；
- `@yuants/app-signal-trader` **26 个测试**全部通过；
- capability registry 相关场景已覆盖：合法 descriptor 可启动，registry 缺失 / descriptor 缺失 / 能力不足会在 boot 阶段 fail-close 到 `stopped`；
- `stopped` / `audit_only` 语义已覆盖：boot/preflight 问题进入 `stopped`，运行中安全异常进入或保持 `audit_only`。

### 4.3 评审结果

- [`./review-rfc.md`](./review-rfc.md)：**PASS**
- [`./review-code.md`](./review-code.md)：**PASS**
- [`./review-security.md`](./review-security.md)：**PASS**

## 5. 风险与回滚

### 5.1 当前风险

- 该 app 仍是 high-risk live host：任何 execution observation、binding、freshness 或 reconciliation 失真，都可能直接影响真实下单安全。
- 非阻塞剩余项主要集中在审计字段脱敏、observer cycle 结构化审计与控制面可维护性增强，不影响本次交付结论。

### 5.2 回滚原则

- 若发现 unknown terminal state、binding 冲突、reconciliation mismatch、关键外部 ID 缺失或 live 能力漂移：
  - 停止产生新的 external effect；
  - 运行中异常进入 `audit_only`，准入/启动前异常保持 `stopped`；
  - 保留 event store、binding、checkpoint 与 audit log 作为排障证据。
- 回滚与恢复优先依赖：
  - `SignalTrader/DisableRuntime`
  - `SignalTrader/BackfillOrderBinding`
  - `SignalTrader/UnlockRuntime`
  - `SignalTrader/ReplayRuntime`
- 不通过物理回滚历史事件来“抹平”状态，而是通过 fail-close + 人工接管完成恢复。

## 6. 未决项与下一步

### 6.1 非阻塞建议

- 为 `operator_note` / `evidence` 增加长度与脱敏约束，降低审计库承载敏感文本的风险。
- 为 observer cycle 增加更细的结构化审计，提升事故复盘与运维可观测性。
- 在 README / GUIDE / API 注释中继续强调：`ListLiveCapabilities` 只用于展示 support matrix，不是 live 授权来源。

### 6.2 后续动作

- 在具备 postgres / node-unit 依赖的环境补跑 migration smoke 与更完整的 live runbook 联调。
- 如需扩展更弱能力 backend、多 product、多 inflight order 或更复杂 rebasing，需另开 RFC，不在本 PR 范围内直接放宽。
