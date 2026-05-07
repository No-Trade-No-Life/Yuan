# signal-trader 交付 walkthrough

## 目标与范围

- 目标：基于根 RFC 交付 `libraries/signal-trader` V1 核心库，并补齐可用于评审与 PR 的交付材料。
- 本次范围绑定以下 scope：
  - `libraries/signal-trader/**`
  - `rush.json`
  - `signal-trader-rfc-v1-事件溯源重排版.md`
  - `.legion/tasks/signal-trader/docs/**`
- 本轮不包含：真实交易所接入、真实 EventStore/数据库落地、宿主 service adapter、复杂资金划转流程。

## 设计摘要

- 设计真源：`/Users/c1/Work/signal-trader/signal-trader-rfc-v1-事件溯源重排版.md`
- 核心选择：采用 append-only 事件溯源模型，事件流是唯一事实来源，projection / snapshot 仅作为查询与执行规划派生结果。
- V1 实现边界收敛为四条命令主链：`upsert_subscription`、`submit_signal`、`apply_execution_report`、`capture_authorized_account_snapshot`。
- 关键约束包括：新增风险暴露必须校验 `entry_price/stop_loss_price`，`direction=0` 保留强语义审计事件，执行与账本通过事件闭环推进，可重放一致性优先。

## 改动清单

### 1. 新增 Rush library 并接入仓库构建

- `libraries/signal-trader/package.json`
  - 新建 `@yuants/signal-trader` 包，声明构建脚本、依赖与发布信息。
- `libraries/signal-trader/config/*`
  - 补齐 heft、TypeScript、Jest、API Extractor 配置。
- `rush.json`
  - 注册 `@yuants/signal-trader` 项目，使其纳入 Rush project inventory。

### 2. 落地事件溯源核心类型与状态模型

- `libraries/signal-trader/src/types/events.ts`
  - 定义 V1 最小事件模型与事件 payload 结构。
- `libraries/signal-trader/src/types/commands.ts`
  - 定义四条主命令契约。
- `libraries/signal-trader/src/types/snapshot.ts`
  - 定义事件重放后的快照 / projection 结构。

### 3. 落地 engine 主流程

- `libraries/signal-trader/src/engine/create-event-sourced-trading-state.ts`
  - 提供事件溯源状态初始化入口。
- `libraries/signal-trader/src/engine/dispatch-command.ts`
  - 实现命令分发、事件追加规划、风险校验与 effect 规划。
- `libraries/signal-trader/src/engine/append-events.ts`
  - 提供事件流追加能力。
- `libraries/signal-trader/src/engine/replay-events.ts`
  - 提供事件流重放能力，保证同流同版本下结果确定。
- `libraries/signal-trader/src/engine/query-projection.ts`
  - 提供 projection 查询入口。
- `libraries/signal-trader/src/engine/query-event-stream.ts`
  - 提供事件流查询入口。

### 4. 落地领域计算与 reducer

- `libraries/signal-trader/src/domain/compute-target-position.ts`
  - 实现目标仓位等核心领域计算。
- `libraries/signal-trader/src/domain/reducer.ts`
  - 将事件流约束为可重放、可查询的统一 projection。

### 5. 落地执行端口与 mock port

- `libraries/signal-trader/src/ports/execution-port.ts`
  - 冻结执行端口契约与授权边界。
- `libraries/signal-trader/src/ports/mock-execution-port.ts`
  - 提供 mock execution port 以支撑集成验证与 effect 测试。

### 6. 对外导出、测试与 API report

- `libraries/signal-trader/src/index.ts`
  - 汇总对外 API 导出。
- `libraries/signal-trader/src/index.test.ts`
  - 覆盖核心闭环、回归与多活跃订单补偿等关键行为。
- `libraries/signal-trader/etc/signal-trader.api.md`
  - 生成 API report，固化对外接口面。

### 7. 评审与验证文档

- `/.legion/tasks/signal-trader/docs/test-report.md`
  - 记录目标化 Rush build 验证结果。
- `/.legion/tasks/signal-trader/docs/review-code.md`
  - 代码评审结论 PASS。
- `/.legion/tasks/signal-trader/docs/review-security.md`
  - 安全评审结论 PASS。

## 如何验证

### 已执行验证

- 命令：`node common/scripts/install-run-rush.js build -t @yuants/signal-trader`
- 预期：`@yuants/signal-trader` 定向构建通过；生成/校验测试与 API report；无新的失败项。
- 实际：PASS。
- 报告：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader/docs/test-report.md`

### 评审结果

- 代码评审：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader/docs/review-code.md` → PASS
- 安全评审：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader/docs/review-security.md` → PASS

## 风险与回滚

### 当前风险

- `queryEventStream` 当前查询边界偏保守，若未来被当作完整审计检索接口使用，需要补文档或增强检索能力。
- mock execution port 仍从主入口导出，虽已有运行时安全守门，但仍建议后续迁移到显式 testing/unsafe 导出路径。
- `sanitizeMetadata`、`unknown_execution_report` 等安全口径已收敛，但仍需在宿主侧保持一致策略，避免接入漂移。

### 回滚建议

- 若后续接入宿主后出现 replay 不一致、账实不符、不可解释状态漂移或高风险告警突增，按 RFC 回滚方案执行：
  1. 宿主切换到 `audit_only`。
  2. 停止产生新的外部订单 effect。
  3. 保留事件追加、告警与快照捕获。
  4. 从稳定 reducer 版本重放事件流重建 projection 并定位问题。

## 未决项与下一步

- 建议把 mock port 从主入口迁移到显式 testing/unsafe 导出路径，进一步降低误接入概率。
- 可继续补强 `desired_delta !== 0` 的多活跃订单补偿回归测试。
- 若后续推进宿主集成，应优先围绕 `audit_only -> paper -> live` 路径接入，不绕过事件闭环直接改状态。
- 如进入发布/合并阶段，需要补齐对应 Rush change file（若仓库发布流程要求本次变更进入发布链路）。
