# signal-trader 独立前端 RFC

## 1. 背景与问题

当前 signal-trader 已具备稳定的 `SignalTrader/*` 服务面与本地启动脚本，但现有 GUI 路线依赖 `ui/web` 宿主，构建链重、上下文噪音大，也不适合把高风险控制面继续塞回旧页面壳。本任务要交付的是一个独立、可直接运行、默认服务于本地联调的前端项目，重点覆盖 paper 与 dummy/live 的可视化控制，而不是继续修补 `ui/web/src/modules/SignalTrader/SignalTraderConsole.tsx`。

同时，这个前端不是普通看板。它会暴露 `SignalTrader/SubmitSignal`，因此必须把风险护栏、环境区分、错误语义与回滚方式写成可执行方案，而不是停留在文案提醒。仓库既有经验也说明：live readiness 不能只看快照是否变化，控制面判断要基于 matched + freshness，这一点需要在产品设计和刷新策略里一并体现（见 `.legion/playbook.md`）。

## 2. 目标与非目标

### 2.1 目标

- 在 `ui/signal-trader-web` 新建独立 Vite + React 项目，并接入 Rush。
- 页面默认面向本地 `paper` 与 `dummy/live` 联调，所有服务访问统一走 Host HTTP `/request`。
- 单页完成 runtime 选择、环境摘要、health、projection、event stream、audit log、`SubmitSignal` 操作。
- 把 `paper`、`dummy-live`、`live` 三种风险级别清晰视觉化，并在 `dummy-live/live` 上启用 fail-close 写入护栏。
- 保持实现轻量，优先复用现有依赖和 TypeScript/Rush/Vite 约定，不引入新的全局宿主状态体系。

### 2.2 非目标

- 不接入 `ui/web`，不修改旧 `SignalTraderConsole`。
- 不新增 operator 类高危动作，如 `UnlockRuntime`、`BackfillOrderBinding`。
- 不在首版引入多页面路由、用户体系、真实部署平台适配或生产鉴权闭环。
- 不改写 signal-trader 服务契约；前端只消费现有 `SignalTrader/*` 能力。
- 不把控制面做成通用调试器，不开放任意 query/SQL 构造。

## 3. 术语与假设

- `runtime`：一条 `SignalTraderRuntimeConfig` 对应的运行实例。
- `paper`：`execution_mode=paper`，默认可在健康态下直接提交。
- `dummy-live`：本地 dummy backend 驱动的 live 形态，用于模拟实盘风险与请求链路；前端视为高风险模式，但文案与排障入口强调“模拟实盘”。
- `live`：真实 live runtime，前端必须使用最严格护栏。
- `fail-close`：任何关键上下文未知、过期、出错、权限不足或二次校验失败时，一律禁止提交。

假设：

- 前端可通过 `ListRuntimeConfig`、`GetRuntimeHealth`、`QueryProjection`、`QueryEventStream`、`QueryRuntimeAuditLog` 构成首版只读闭环。
- Host `/request` 是唯一服务入口；若本地环境启用 `HOST_TOKEN`，只由 Node 侧代理/预览服务器注入，不让浏览器直接持有凭证。
- 环境 profile 由 Node 侧显式注入 `SIGNAL_TRADER_ENV_PROFILE=paper|dummy-live|live`，前端再结合 `execution_mode`、`allow_unsafe_mock`、`observer_backend`、`ListLiveCapabilities` 做交叉校验；任一关键信号缺失或冲突，一律按 `live` 处理并默认禁写。
- 前端写能力不是默认开启，而是额外受 `SIGNAL_TRADER_ENABLE_MUTATION=0|1` 控制；即使 UI 允许，最终安全边界仍以后端授权与健康校验为准。

## 4. 用户流与信息架构

### 4.1 核心用户流

1. 打开页面，看到当前 Host、环境等级、服务连接状态。
2. 页面读取 runtime 列表，默认选择上次成功联调的 runtime；若无缓存则选首个可用 runtime。
3. 选择 runtime 后，页面并发读取 health、三类 projection、event stream、audit log。
4. 用户先通过顶部摘要和状态卡确认环境、健康态、freshness、subscription/reconciliation 是否正常。
5. 若只是排障，停留在只读区；若要提交信号，再进入写区完成输入、预览、确认、提交。
6. 提交后局部刷新 health/event/audit，必要时刷新 projection，帮助用户立即验证闭环。

### 4.2 单页信息架构

- 顶部 `Control Header`：Host 地址、环境等级徽标、全局刷新、最近一次同步时间。
- 左侧 `Runtime Rail`：runtime 列表、搜索、当前 runtime 基础配置摘要。
- 主内容分为两列：
  - `Operate Column`：状态卡、SubmitSignal 卡片、风险提示。
  - `Observe Column`：product/subscription/reconciliation 三个 projection、event stream、audit log。
- 页面保持单页，不引入路由；所有切换都围绕“当前 runtime 工作区”展开。

这个信息架构的意图是把“先看环境和健康，再决定是否可写”做成默认阅读顺序，而不是把提交表单放在最醒目的首屏中心。

## 5. 视觉与交互方向

产品方向不是旧后台表格壳，而是“高风险实时控制台”。视觉上强调环境感、运行态层次和可扫读性：

- `paper` 使用低压绿色/石墨色，强调可实验、可恢复。
- `dummy-live` 使用琥珀色，文案显式标注“模拟实盘链路”，提醒其行为接近 live。
- `live` 使用高对比红色风险带，仅在明确授权时展示可写入口。
- 顶部环境带与提交卡片共用同一风险色，不允许出现“顶部提示高风险，但按钮看起来仍是普通主按钮”的割裂体验。
- 状态卡优先展示 `status`、freshness、matched/reconciliation 摘要和锁定原因；坏状态不藏在折叠区。
- 事件流与审计日志采用时间轴/列表混合布局，支持快速扫读最近变化，不做复杂图表。

交互原则：

- 读写分区明显，写区默认折叠次级字段，避免误触。
- 所有高风险禁用都要给出具体原因，如“health 非 normal”“freshness 过期”“等待二次校验”。
- `dummy-live/live` 提交前显示最终 payload 预览与确认文案，避免用户只凭按钮文案做判断。

## 6. 技术方案

### 6.1 工程形态

项目落在 `ui/signal-trader-web`，以 `ui/webpilot` 的轻量 Vite 结构为参考，但交付为标准 Web 单页应用，而不是扩展程序。建议结构：

```text
ui/signal-trader-web/
  config/rush-project.json
  package.json
  tsconfig.json
  vite.config.ts
  index.html
  src/
    main.tsx
    app/App.tsx
    app/layout/
    api/request-client.ts
    api/signal-trader-services.ts
    state/workspace-store.ts
    features/runtime/
    features/health/
    features/submit-signal/
    features/projections/
    features/event-stream/
    features/audit-log/
    components/
    styles/
```

约束：

- 单页应用，不引入 `react-router`。
- 状态管理使用 React hooks + context + 本地 store，不新增 Redux/Zustand 一类全局状态库。
- 网络层统一走 `api/request-client.ts`，页面代码不直接拼 `/request` payload。

### 6.2 Host `/request` 代理层

浏览器统一调用同源 `/request`，分两种运行路径：

- `vite dev`：`vite.config.ts` 代理 `/request` 到 `SIGNAL_TRADER_HOST_ORIGIN`。
- `build/preview`：新增一个轻量 Node 服务器（例如 `scripts/serve-with-proxy.mjs`），负责静态文件托管 + `/request` 反向代理；Playwright 与本地预览都跑这条链路。
- 目标地址来自环境变量，例如 `SIGNAL_TRADER_HOST_ORIGIN=http://127.0.0.1:8888`。
- 若存在 `HOST_TOKEN`，只在 Vite dev server / Node 预览服务器注入 `host_token` header；浏览器端永不感知 token。
- 因此前端的“可运行”定义是：`dev` 与 `build + serve-with-proxy` 都可工作，而不是只在 `vite dev` 下成立。

这样可以满足“服务访问走 Host `/request`”的约束，同时避免 token 和跨域细节泄漏到页面逻辑，也让 `preview` / Playwright 验证有明确落点。

### 6.3 状态管理

状态分三层：

- `session state`：Host 地址、环境 profile、是否允许写入、最近选择的 runtime，保存在 `localStorage`。
- `workspace state`：当前 runtime、加载状态、错误状态、最近刷新时间，由 `workspace-store` 统一维护。
- `resource state`：health、projections、events、audit、submit in-flight 状态，按资源拆成独立 hooks。

设计原则：

- runtime 切换是唯一的工作区主键，所有资源查询都挂在 `runtime_id` 下。
- 写区不直接信任缓存；提交前必须触发一次强制 `GetRuntimeHealth` 复读。
- 错误与空态保持资源级隔离，避免某个面板失败导致整个页面进入“全局白屏”。

### 6.4 数据刷新策略

- `ListRuntimeConfig`：首屏加载 + 手动刷新；不做高频轮询。
- `ListLiveCapabilities`：首屏读取 + 手动刷新；若读取失败，则所有 `dummy-live/live` runtime 一律禁写。
- `GetRuntimeHealth`：当前 runtime 每 5 秒轮询；提交前额外强制刷新一次。
- `QueryProjection`：默认跟随 runtime 切换和手动刷新；提交成功后增量刷新三类 projection。
- `QueryEventStream`、`QueryRuntimeAuditLog`：每 8-10 秒轮询最近窗口，保持控制台“活着”；也支持手动刷新。
- 当页面不可见时自动降频或暂停，只保留用户显式触发刷新。
- freshness 判断优先复用后端字段：`last_account_snapshot_status`、`last_matched_reconciliation_at_ms`、`updated_at`，不自行发明第二套 readiness 规则。

### 6.5 SubmitSignal 与风险护栏

读取面与写入面共用当前 runtime 上下文，但写入 gate 明确为：

`profile_allow_mutation && risk_tier_resolved && capability_ok && health_ok && freshness_ok && confirm_ok`

其中：

- `profile_allow_mutation`：由 `SIGNAL_TRADER_ENABLE_MUTATION=1` 显式打开；默认关闭。
- `risk_tier_resolved`：环境 profile 与 runtime config/capability 交叉校验后无冲突；否则按 `live` + 禁写处理。
- `capability_ok`：`paper` 可跳过；`dummy-live/live` 必须存在匹配的 capability summary，且 `supports_submit=true`。
- `health_ok`：`status=normal`，且无 lock reason。
- `freshness_ok`：`last_account_snapshot_status=fresh`，且 matched/reconciliation 字段满足最小新鲜度要求。
- `confirm_ok`：`dummy-live/live` 必须手工输入 `runtime_id`，并确认最终 payload 预览。

环境分级规则：

- `paper`：要求 config/health 成功加载，`status=normal`，页面无错误/加载中。
- `dummy-live`：除 `paper` 条件外，还要求手工输入 `runtime_id`、展示 amber 风险提示、提交后二次结果核查提示。
- `live`：与 `dummy-live` 相同，并追加更强红色风险提示与“真实账户/真实执行链路”确认文案。

提交流程：

1. 用户选择 `signal=-1/0/1`，可选填写价格与 metadata。
2. 页面生成只读 payload 预览，自动带出 `runtime_id`、`signal_key`、`product_id`、`source=manual`。
3. 点击提交时先执行一次强制 `GetRuntimeHealth`。
4. 二次校验仍满足 gate 后才真正调用 `SignalTrader/SubmitSignal`。
5. 结果返回后立即刷新 health/event/audit；若返回 `accepted=false` 或 `409`，用拒绝原因直出，不自动重试。

## 7. 数据模型与接口约束

### 7.1 最小读取接口

| 面板            | 服务                                | 请求                             | 关键字段                                                                                               |
| --------------- | ----------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------ |
| runtime 列表    | `SignalTrader/ListRuntimeConfig`    | `{}`                             | `runtime_id` `execution_mode` `signal_key` `product_id` `observer_backend` `allow_unsafe_mock`         |
| capability 矩阵 | `SignalTrader/ListLiveCapabilities` | `{}`                             | `key` `observer_backend` `supports_submit` `supports_account_snapshot`                                 |
| health          | `SignalTrader/GetRuntimeHealth`     | `{ runtime_id }`                 | `status` `lock_reason` `last_account_snapshot_status` `last_matched_reconciliation_at_ms` `updated_at` |
| projection      | `SignalTrader/QueryProjection`      | `{ runtime_id, query }`          | 仅允许 `product` `subscription` `reconciliation`                                                       |
| event stream    | `SignalTrader/QueryEventStream`     | `{ runtime_id, query }`          | 最近窗口数据即可                                                                                       |
| audit log       | `SignalTrader/QueryRuntimeAuditLog` | `{ runtime_id, limit, cursor? }` | `items` `next_cursor`                                                                                  |

### 7.2 前端内部视图模型

- `RuntimeListItem`：从 runtime config 投影出 `runtime_id`、`execution_mode`、`riskTier`、`product_id`、`subscription_status`、`signal_key`。
- `RiskTier`：`paper | dummy-live | live`，由 `env profile + runtime.execution_mode + runtime.allow_unsafe_mock + runtime.observer_backend + capability summary` 推导；任一信号缺失/冲突则提升到 `live`。
- `WorkspaceSnapshot`：聚合当前 runtime 的 config、health、三类 projection、latest events、latest audit、refresh 状态。

兼容策略：

- 对 projection 结果保持“透传 + 局部格式化”，不在前端重新定义完整 DTO。
- 对新增字段保持宽容读取；对缺失关键字段走降级展示，但 live gate 默认按未知处理并禁用写入。

## 8. 错误语义与重试策略

- `403`：权限未开放或 Host 未允许该服务。页面保留只读上下文，并把写区固定为禁用状态。
- `409` / `accepted=false`：业务拒绝，常见于 health/freshness/runtime 校验失败。前端直接展示服务端 reason，不自动补发。
- `5xx` / network：视为结果未知。只读请求允许人工重试；写请求不自动重试，并提示用户去 event/audit 核查。
- `stale` 或关键字段缺失：视为不可恢复前提缺失，live/dummy-live 提交直接 fail-close。
- 任一 in-flight 写请求期间按钮单飞，防止重复提交。

## 9. 安全考虑

- 浏览器不持有 `HOST_TOKEN`；如需 token，仅由 Vite dev proxy 或 Node 预览服务器注入请求头。
- 不暴露 operator 服务，不在首版加入 runtime 配置写入。
- `SIGNAL_TRADER_ENABLE_MUTATION` 默认为关闭；只有明确本地联调时才开启可写入口。
- `metadata` 只接受 JSON object，限制层级和体积；超限直接在前端拒绝，并依赖服务端继续做权威限制。
- `dummy-live/live` 的视觉与交互护栏必须默认开启，不能通过前端 URL 参数静默绕过。
- 任何客户端风险判断都只是误操作护栏；真正安全边界仍是 Host `servicePolicy` 与 signal-trader 服务端校验。

## 10. 备选方案

### 方案 A：继续在 `ui/web` 里修旧控制台

放弃原因：会继承旧宿主的构建噪音、依赖耦合与上下文包袱，也违背“不接入 `ui/web`”的明确约束。

### 方案 B：独立前端直接跨域调用 Host

放弃原因：本地联调时更容易把 `HOST_TOKEN`、跨域配置与请求细节泄漏到浏览器；对首版而言，代理层更安全也更可控。

### 方案 C：独立前端 + 同源 `/request` 代理（采用）

得到什么：项目边界清晰、联调成本低、凭证不落浏览器、可直接对接 paper 与 dummy/live 本地栈。

代价：开发环境需要配置 Host 地址与代理，但这是可接受的工程显式性。

## 11. 向后兼容、发布与回滚

- 向后兼容：本项目为新增独立前端，不改变旧 `ui/web` 页面，也不修改现有 `SignalTrader/*` 服务契约。
- 发布顺序：先跑通本地 `paper` 只读 + 写入，再接本地 `dummy-live`，最后才验证受限 `live` 护栏。
- 回滚策略：
  1. 前端层回滚：从 `rush.json` 中移除项目或停止交付该前端包。
  2. 运行层回滚：保持 UI 只读，撤销 Host 对 `SubmitSignal` 的 live 写权限。
  3. 风险层回滚：即使页面仍可打开，也可通过环境配置把 `dummy-live/live` 写区整体隐藏或禁用。

## 12. 验证计划

关键行为与验证映射：

- 项目骨架可运行：`ui/signal-trader-web` 可被 Rush 识别，`vite dev` 与 `build + serve-with-proxy` 都可执行。
- Host 代理有效：页面请求实际命中 Host `/request`，浏览器网络面板不暴露 `HOST_TOKEN`，而 Node 侧代理/预览服务器能正确转发 header。
- 信息架构成立：runtime 切换后，health/projection/event/audit 均随 `runtime_id` 正确刷新。
- paper 写入闭环：`SubmitSignal` 成功后，event/audit/health 能观察到状态变化。
- dummy-live/live 护栏成立：未通过 runtime 输入确认、capability 缺失、health 非 normal、freshness 异常、profile 未显式允许写入、请求复读失败时均无法提交。
- 降级语义成立：任一读面板失败时页面仍可继续使用其他面板，且错误原因可见。
- 排障入口成立：提交失败或结果未知时，页面能给出足够的 runtime、时间、reason 线索供人工核查。

建议测试分层：

- 单元测试：风险层级推导、gate 计算、payload 组装。
- 集成测试：request client、代理配置、资源刷新与错误收敛。
- Playwright 冒烟：
  - `paper` happy path 作为自动化主路径。
  - `dummy-live` 先覆盖 fail-close path（风险提示、确认输入、默认禁写或 capability 缺失禁写），不强求首版自动化真实提交成功。
  - `webServer` 由两部分组成：本地 stack wrapper（启动/阻塞/退出时清理）+ 前端 dev/serve-with-proxy。

## 13. 里程碑

### M1 - 工程落地与只读骨架

- 新建 `ui/signal-trader-web`，接入 Rush。
- 完成 Vite dev server、Node 预览代理、基础布局、Host `/request` client、runtime 列表与 health 面板。
- 验收：能在本地 paper 栈上读到 runtime 与 health。

### M2 - 写入闭环与最小审计面

- 补齐 SubmitSignal、环境摘要、capability 矩阵、风险色系统与 audit log。
- 完成写入 gate、payload 预览、paper 成功写入与 dummy-live/live fail-close。
- 验收：paper 可提交，dummy-live/live 默认安全收口。

### M3 - 完整观测面

- 补齐 product/subscription/reconciliation projection、event stream、写后联动刷新与错误语义。
- 验收：能稳定展示一个 runtime 的完整观测面。

### M4 - 冒烟验证与交付文档

- 补齐 Playwright 冒烟、stack wrapper、运行说明、风险说明和交付文档。
- 验收：本地 paper 与 dummy-live 路径均有可复现验证步骤。

## 14. Open Questions

- 首版是否提供“切换 Host 地址”的 UI 输入框，还是仅依赖本地 env 配置？建议首版以 env 为主，减少误连风险。

## 15. 落地 Plan

文件变更点：

- `ui/signal-trader-web/**`：新增独立前端项目、页面结构、样式、请求层、预览代理、测试。
- `rush.json`：注册新项目。
- `common/config/rush/pnpm-lock.yaml`：同步新增依赖解析结果。
- `.legion/playbook.md`：如实现过程中沉淀新的控制面经验，再追加可复用规则。

验证步骤：

1. 启动 `apps/signal-trader/dev/run-local-paper-stack.sh`，确认页面只读与 paper 写入可用。
2. 启动 `apps/signal-trader/dev/run-local-live-dummy-stack.sh`，确认 `dummy-live` 风险提示、确认输入与 fail-close 行为。
3. 通过 `ui/signal-trader-web/playwright.config.ts` 运行 Playwright：用 stack wrapper 拉起 paper（主路径）与 dummy-live（fail-close 路径），同时启动前端 dev/serve-with-proxy。
4. 执行 Rush 构建，确认新项目被纳入仓库构建图且不影响旧 `ui/web`。
