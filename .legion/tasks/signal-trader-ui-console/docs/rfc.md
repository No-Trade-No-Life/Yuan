# signal-trader 控制台 RFC（修订版）

## Executive Summary

- 本 RFC 收敛 signal-trader 控制台首版为一个 **高风险、fail-close、服务优先** 的 `ui/web` 页面。
- 读链路统一走 `SignalTrader/*` 服务；**不再使用通用 SQL 直读 audit**。
- 首版新增唯一后端读取补口：`SignalTrader/QueryRuntimeAuditLog`，按 `runtime_id` 返回固定白名单审计字段。
- `SubmitSignal` 继续复用现有服务契约，但真实安全边界在服务端；前端自动带出字段仅用于便捷与可读性。
- 后端必须基于 `runtime_id` 对 `health`、`freshness`、`signal_key`、`product_id` 做权威校验；前端不得被视为安全边界。
- `SubmitSignal.command.source` 固定为现有合法枚举 `manual`。
- live 提交前端 gate 固定为：config 已加载成功；最近一次 `GetRuntimeHealth` 成功且 `status=normal`；页面无 `loading/error/stale`；提交前再次读取一次 health 且仍为 `normal`；用户手工输入 `runtime_id` 确认。
- 任一条件不满足即 fail-close 禁用提交；不做“尽量提交”。
- projection 首版白名单固定为：`product`、`subscription`、`reconciliation`；不开放动态 query。
- 发布按三阶段推进：只读页面 → paper 可写 → live 受限开放。
- 回滚分两层：隐藏 UI 入口；撤销宿主 `servicePolicy` live 写权限并退化为只读。

## 1. 背景与动机

`@yuants/app-signal-trader` 已有 runtime 配置、health、projection、event 与 `SubmitSignal` 服务面，但缺少一个统一 GUI 控制台。当前值班/联调需要手工调服务或查底层数据，既低效，也无法把 live 风险边界稳定表达在操作入口上。

本设计的目标不是做一个“方便发单”的后台，而是做一个**先证明不会误发，再允许受限人工提交**的控制台页面。

## 2. 目标与非目标

### 2.1 Goals

- 在 `ui/web` 新增 signal-trader 控制台页面。
- 支持 runtime 选择、health 查看、projection 查看、event stream 查看、audit log 查看。
- 支持在严格 fail-close 门禁下调用 `SignalTrader/SubmitSignal` 提交 `-1 / 0 / 1`。
- 将 live 风险控制、可观测、灰度与回滚写成可执行设计，而不是 UI 文案建议。

### 2.2 Non-Goals

- 不新增独立前端工程。
- 不做 runtime 配置编辑、operator backfill/unlock、批量操作。
- 不开放任意 SQL 查询。
- 不开放 projection 动态 query 构造器。
- 不以 UI 替代服务端权限与一致性校验。

## 3. 术语定义

- **runtime**：`runtime_id` 对应的一条 signal-trader 运行实例。
- **live runtime**：`execution_mode=live` 的 runtime。
- **fail-close**：任一前置条件未知、失败、过期或无权限时，一律禁用写操作。
- **stale**：页面所依赖的 config/health 结果已失去可信新鲜度，不能作为 live 提交依据。

## 4. 实现门禁（Implementation Gates）

以下门禁在本 RFC 中已定稿，不再作为 blocker 级 open question：

1. **audit 读取门禁**：首版必须补 `SignalTrader/QueryRuntimeAuditLog`；不允许通用 SQL 直读 audit。
2. **写入边界门禁**：`SubmitSignal` 继续沿用现有服务契约，但服务端必须以 `runtime_id` 为权威上下文重新校验 `health`、`freshness`、`signal_key`、`product_id`。
3. **source 枚举门禁**：`SubmitSignal.command.source` 固定为 `manual`，不得发 `manual_ui`。
4. **live 提交门禁**：仅当本 RFC 第 8 节列出的全部条件满足时，前端才允许 live 提交。
5. **projection 门禁**：首版只允许 `product`、`subscription`、`reconciliation` 三类白名单查询。

## 5. 方案设计

### 5.1 页面结构

页面注册为 `SignalTraderConsole`，采用单页六区块：

1. `RuntimeSelectorBar`：选择 runtime、显示 execution mode 摘要、手动刷新。
2. `RuntimeStatusCard`：显示 `status`、关键 freshness、不可提交原因。
3. `SubmitSignalCard`：最小提交表单、最终 command 预览、live 二次确认。
4. `ProjectionPanel`：白名单 projection 数据展示。
5. `EventStreamPanel`：最近事件流。
6. `AuditLogPanel`：受限 audit log 展示。

### 5.2 端到端流程

1. 页面打开后调用 `SignalTrader/ListRuntimeConfig` 获取 runtime 列表。
2. 用户选择 runtime 后并发读取：
   - `SignalTrader/GetRuntimeHealth`
   - `SignalTrader/QueryProjection`（仅白名单 query）
   - `SignalTrader/QueryEventStream`
   - `SignalTrader/QueryRuntimeAuditLog`
3. 页面基于 config + 最新 health 计算只读状态与写入 gate。
4. 用户填写 `signal` 与可选高级字段。
5. 若为 live runtime，提交前必须再次调用一次 `GetRuntimeHealth`，结果仍为 `normal` 才可继续。
6. 用户在确认框中手工输入 `runtime_id` 后，调用 `SignalTrader/SubmitSignal`。
7. 提交后刷新 health / event / audit；projection 可按最小必要刷新。

### 5.3 组件边界

- 页面容器负责 runtime 切换、刷新调度、错误汇总、写后联动刷新。
- `SubmitSignalCard` 不自行信任缓存上下文；最终提交能力由容器在最新 gate 结果下放行。
- 只读区块与写区块视觉和代码上分离，避免把展示组件当作写入前提。

## 6. 数据模型与接口

### 6.1 读取接口

| 区块         | 接口                                | 最小请求                         | 返回约束                                                          |
| ------------ | ----------------------------------- | -------------------------------- | ----------------------------------------------------------------- |
| runtime 下拉 | `SignalTrader/ListRuntimeConfig`    | `{}`                             | 至少含 `runtime_id`、`execution_mode`、`signal_key`、`product_id` |
| 状态卡       | `SignalTrader/GetRuntimeHealth`     | `{ runtime_id }`                 | 至少含 `status` 与 freshness 所需字段                             |
| projection   | `SignalTrader/QueryProjection`      | `{ runtime_id, query }`          | `query.type` 仅允许白名单                                         |
| 事件流       | `SignalTrader/QueryEventStream`     | `{ runtime_id, query }`          | 只读最近 N 条即可                                                 |
| 审计         | `SignalTrader/QueryRuntimeAuditLog` | `{ runtime_id, limit, cursor? }` | 固定白名单字段                                                    |

### 6.2 `QueryRuntimeAuditLog` 首版字段约束

固定返回白名单字段：

- `seq`
- `runtime_id`
- `action`
- `operator`
- `note`
- `evidence`
- `detail`
- `created_at`

约束：

- 仅允许按 `runtime_id` 查询。
- 不支持任意 where/order by。
- 服务端负责字段脱敏与错误收敛；UI 不直接暴露底层库错误细节。

### 6.3 `SubmitSignal` 字段策略

前端可编辑字段：

- 必填：`signal`（仅 `-1 / 0 / 1`）
- 可选：`entry_price`、`stop_loss_price`、`metadata`

前端自动带出/生成字段：

- `runtime_id`：当前选中 runtime
- `command_type`：固定现有契约值
- `signal_key`：由当前 runtime config 带出
- `product_id`：由当前 runtime config 带出
- `source`：**固定为 `manual`**
- `signal_id`：前端生成唯一值
- `upstream_emitted_at`：提交时生成

但这些自动带出字段**不是安全边界**。服务端必须基于 `runtime_id` 做权威校验；若与服务端视角的 runtime 配置或健康态不一致，必须拒绝写入。

## 7. 错误语义

### 7.1 读取错误

- `403`：无读取权限或服务未开放；对应面板显示明确无权限空态。
- `5xx/network`：可恢复错误；允许人工刷新重试。
- `stale`：视为不可用于 live 写入；页面保留数据显示，但写入区禁用。

### 7.2 写入错误

- `403`：无写权限；不自动重试。
- `409`/业务拒绝：服务端因 health、freshness、signal_key、product_id 或其他权威校验拒绝；不自动重试。
- `5xx/network`：显示“结果未知/需人工核查”，并提供 `correlation_id` 或请求时间用于排障；不自动补发。

### 7.3 重试语义

- 首版**不做自动重试**。
- 所有控制面重试均由人工重新触发。
- 提交按钮单飞；请求未完成前禁止重复提交。

## 8. live 提交门禁

live 提交前端 gate 固定为以下全部条件同时满足：

1. 当前 runtime config 已加载成功。
2. 最新一次 `SignalTrader/GetRuntimeHealth` 调用成功，且 `status=normal`。
3. 页面当前不存在 `loading` / `error` / `stale` 状态。
4. 用户点击提交后，前端**再次**读取一次 `GetRuntimeHealth`，结果仍为 `normal`。
5. 用户在确认框中**手工输入 `runtime_id`**，且完全匹配当前 runtime。
6. 宿主 `servicePolicy` 明确允许当前会话执行 `SignalTrader/SubmitSignal`。

任一条件不满足，一律 fail-close 禁用 live 提交。

说明：

- `paper` runtime 可以不要求手工输入 `runtime_id`，但仍要求 config/health 加载成功且页面无 `loading/error/stale`。
- 前端 gate 只是误操作护栏；**真正安全边界仍是服务端权威校验**。

## 9. 安全考虑

- 不走通用 SQL audit，避免把控制台建立在通用查询面之上。
- 不开放动态 projection，避免页面演化为隐性调试器或数据探针。
- 对 `metadata` 做 JSON object 与体积限制，防止资源耗尽与审计噪音。
- 所有输入先做前端基础校验，但以后端拒绝为最终裁决。
- UI 入口存在不等于 live 可写；live 权限依赖宿主 `servicePolicy` 单独授权。

## 10. 备选方案

### 方案 A：通用 SQL 直读 audit（放弃）

放弃了什么：最快落地路径。

为什么放弃：无法把授权模型、字段边界、shared/prod 可审计性收敛成稳定控制面约束；review 已判定为 blocker。

### 方案 B：新增标准只读服务 `QueryRuntimeAuditLog`（采用）

得到什么：审计字段白名单、按 `runtime_id` 收敛、错误边界一致、可灰度可回滚。

代价：需要补一个只读服务，但变更面可控，且比开放 SQL 风险更小。

### 方案 C：前端只传最小字段，服务端全量补齐（本期不采用）

放弃了什么：最强的一致性与最小前端上下文耦合。

为什么暂不采用：现有 `SubmitSignal` 契约已被复用，首版不改写契约；但必须把服务端权威校验写成硬要求，确保前端自动带出不构成真实边界。

## 11. 向后兼容、迁移、发布与回滚

### 11.1 Backward Compatibility

- 页面为新增能力，不破坏现有调用方。
- `SubmitSignal` 继续复用现有契约，不引入新的写接口。
- 新增 `QueryRuntimeAuditLog` 为只读增量能力。

### 11.2 Rollout

1. **阶段一：只读页面**
   - 打开页面入口。
   - 验证 runtime/config/health/projection/event/audit 全部只读链路。
2. **阶段二：paper 可写**
   - 保持 live 写权限关闭。
   - 仅对 paper runtime 验证 `SubmitSignal` happy path 与拒绝路径。
3. **阶段三：live 受限开放**
   - 仅对具备宿主 `servicePolicy` 的受限角色开放 live 写。
   - 验证手工输入 `runtime_id` 与提交前 health 复读 gate。

### 11.3 Rollback

两层回滚，且任一层都可独立执行：

1. **UI 入口回滚/隐藏**：移除或隐藏页面入口，停止暴露交互面。
2. **live 写权限回滚**：通过宿主 `servicePolicy` 撤销 `SignalTrader/SubmitSignal` live 写权限，页面自动退化为只读。

说明：即使 UI 入口仍在，只要第二层已执行，页面也必须呈现只读状态。

## 12. 可观测性（Observability）

最小要求：

- **前端日志事件**：`page_opened`、`runtime_selected`、`submit_attempted`、`submit_blocked`、`submit_confirmed`、`submit_succeeded`、`submit_rejected`。
- **读取失败事件**：`health_query_failed`、`projection_query_failed`、`event_query_failed`、`audit_query_failed`。
- **关键标签**：`runtime_id`、`execution_mode`、`status`、`correlation_id?`、`error_type`。
- **指标**：submit attempt 次数、blocked 次数、accepted/rejected 次数、audit query failure 次数。
- **排障入口**：页面展示 `runtime_id`、请求时间、服务返回的 `correlation_id`（若有），供宿主日志检索。

首版不强制告警自动化，但上述日志/指标必须足以支持值班排障与灰度观测。

## 13. 验证计划

关键行为与验证映射：

1. **页面可读闭环**
   - 验证 `ListRuntimeConfig`、`GetRuntimeHealth`、`QueryProjection`、`QueryEventStream`、`QueryRuntimeAuditLog` 的请求参数与渲染。
2. **projection 白名单生效**
   - 验证仅 `product`、`subscription`、`reconciliation` 可请求，其他类型不可构造。
3. **paper 可写**
   - 验证 `signal=-1/0/1` 成功路径、按钮单飞、写后刷新。
4. **live gate fail-close**
   - 构造 `loading/error/stale/non-normal` 场景，验证提交始终禁用。
   - 构造“首次 health 正常、提交前复读失败/非 normal”场景，验证提交被阻断。
   - 验证未手工输入正确 `runtime_id` 时不可提交。
5. **服务端权威校验被依赖**
   - 使用 mock 或受控测试桩验证：当前端带出错误 `signal_key/product_id` 或陈旧上下文时，服务端拒绝请求。
6. **权限与回滚**
   - 验证移除 UI 入口后页面不可达。
   - 验证撤销宿主 `servicePolicy` 后页面仍可读但 live 提交不可用。
7. **可观测性**
   - 验证 submit attempt / blocked / accepted / rejected 与 audit query failure 有日志或指标记录。

## 14. Milestones

### Milestone 1：只读控制台

- 页面入口、runtime 选择、health、projection、event、audit 可读。
- `QueryRuntimeAuditLog` 已可用。
- 不暴露写入能力。

### Milestone 2：paper 写入

- `SubmitSignal` 在 paper runtime 可写。
- 表单字段策略、错误语义、写后刷新生效。
- submit observability 生效。

### Milestone 3：live 受限开放

- live gate 全部启用。
- 手工输入 `runtime_id` 确认生效。
- 宿主 `servicePolicy` 可单独控制 live 写权限。

## 15. 剩余风险（非 blocker）

- `metadata` 的结构噪音仍可能影响审计可读性；首版先靠体积限制与 object 限制控制。
- 写后刷新若并发过多，可能带来瞬时 UI 抖动；实现时应采用最小必要刷新策略。
- `QueryRuntimeAuditLog` 的字段脱敏细节仍需在实现时与后端对齐，但不影响本 RFC 的边界收敛。

## 16. 落地 Plan

### 文件变更点

- `ui/web/**`：页面、组件、i18n、入口注册。
- `apps/signal-trader/**`：新增 `SignalTrader/QueryRuntimeAuditLog` 只读服务与相关文档。
- `docs/zh-Hans/packages/@yuants-ui-web.md`
- `apps/signal-trader/GUIDE.md`

### 执行步骤

1. 先实现 `QueryRuntimeAuditLog` 与只读页面闭环。
2. 再接入 paper `SubmitSignal`，验证错误语义与 observability。
3. 最后开启 live gate 与宿主权限控制说明。

### 验证步骤

1. 只读链路逐项验证。
2. paper 写入 happy path / reject path 验证。
3. live gate fail-close 与手工输入 `runtime_id` 验证。
4. UI 入口隐藏与 `servicePolicy` 撤销两层回滚验证。
