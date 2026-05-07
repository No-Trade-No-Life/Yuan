# signal-trader-standalone-ui

## 目标

新建一个独立于 `ui/web` 的 signal-trader 前端项目，交付可直接运行的产品化控制台，支持本地 paper / dummy 环境联调、Playwright 冒烟验证，以及完整的 Legion 交付文档。

## 问题定义

- 之前把 signal-trader 控制台塞进 `ui/web` 的路线已经失败：宿主过重、依赖链过深、构建噪音大，也不符合这次“少打断、直接交付”的目标。
- 当前 signal-trader 后端已经具备一组稳定的 `SignalTrader/*` 服务与本地启动脚本，但缺少一个轻量、独立、可单独启动的前端控制台来消费这些接口。
- 用户希望醒来后直接看到成果，因此本次需要把设计、实现、测试、评审、PR 文案一次性闭环，避免再回到“大宿主集成未收口”的状态。

## 验收标准

- 新增独立前端项目，目录位于 `ui/signal-trader-web`，不修改或依赖 `ui/web` 的 signal-trader 页面集成逻辑。
- 前端至少提供以下能力：
  - 连接本地 signal-trader Host（优先通过同源 `/api/request` 代理到 Host `/request`）
  - 展示 runtime 列表与当前连接环境摘要
  - 查看 runtime health、runtime config、product/subscription/reconciliation projection
  - 查看 event stream 与 runtime audit log
  - 提交 `-1 / 0 / 1` 信号，并在 paper / dummy 场景下观察状态变化
- 前端具备明确的控制面护栏：
  - `paper` 环境可直接提交
  - `live`/`dummy-live` 环境必须有显式风险提示与 runtime 级确认输入
  - `stopped` / `degraded` / `audit_only` 默认禁用信号提交
- 提供本地联调脚本或封装命令，至少能拉起：
  - signal-trader 本地 paper 栈
  - 前端开发/预览服务
  - Playwright 端到端测试
- 生成并落盘：
  - `docs/rfc.md`
  - `docs/review-rfc.md`
  - `docs/test-report.md`
  - `docs/review-code.md`
  - `docs/review-security.md`
  - `docs/report-walkthrough.md`
  - `docs/pr-body.md`

## 假设

- signal-trader 现有服务契约可直接复用，不需要为这次前端重写新增新的业务接口。
- 本次优先保证本地 paper 闭环与 dummy/live 接入路径清晰；不把真实 live 凭证或生产部署作为首版必需条件。
- 浏览器对 Host 的调用通过前端项目自带代理层解决，避免把 `host_token` 或跨域细节暴露给页面代码。
- 参考对象是“独立产品化前端”的交互与质感，而不是继续复用 `ui/web` 的页面壳与状态体系。

## 约束

- 严格不把新的 signal-trader UI 回接到 `ui/web/**`；旧实现保持原样，不在本任务内修补。
- Scope 限制在：
  - `.legion/tasks/signal-trader-standalone-ui/**`
  - `ui/signal-trader-web/**`
  - `apps/host/src/host-manager.ts`（仅在修复 Host `/request` 流式错误导致的本地联调阻塞时允许）
  - `apps/host/src/utils/parseBodyText.ts`（仅在补 `/request` body 上限时允许）
  - `rush.json`
  - `common/config/rush/pnpm-lock.yaml`
  - `.legion/playbook.md`
- 文档语言使用中文；代码与配置继续遵循仓库现有 TypeScript / Rush / Vite 约定。
- 尽量复用仓库已存在依赖版本，避免为视觉糖衣引入新的重依赖。
- 首版不覆盖 operator 类高危动作（`UnlockRuntime` / `BackfillOrderBinding`），只做读面 + `SubmitSignal`。

## 风险分级

- **等级**：High
- **标签**：`continue` `risk:high` `ui` `standalone`
- **理由**：虽然前端改为独立项目，但它仍是 signal-trader 控制面，能够触发 `SubmitSignal` 并连接 live/dummy-live Host；若代理、风险提示、环境区分或交互护栏设计不当，仍可能放大误操作风险，因此必须走 task-local RFC + 设计审查 + 安全审查。

## 要点

- 以 `ui/webpilot` 的轻量 Vite + React 结构为工程模板，但产出全新的 signal-trader 独立项目
- 数据面全部走 Host `/request` + `SignalTrader/*` 服务，不复用 `ui/web` 的 Terminal 状态模型
- 视觉上做成独立产品化控制台：强环境感、明确分区、实时状态可扫读，不走旧桌面壳样式
- 验证优先选本地 paper 栈做确定性 Playwright 冒烟，同时保留 dummy/live 连接入口

## 范围

- `.legion/tasks/signal-trader-standalone-ui/**`
- `ui/signal-trader-web/**`
- `apps/host/src/host-manager.ts`
- `apps/host/src/utils/parseBodyText.ts`
- `rush.json`
- `common/config/rush/pnpm-lock.yaml`
- `.legion/playbook.md`

## Design Index

- 任务 RFC：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-standalone-ui/docs/rfc.md`
- RFC 审查：`/Users/c1/Work/signal-trader/.legion/tasks/signal-trader-standalone-ui/docs/review-rfc.md`
- 运行接口参考：`/Users/c1/Work/signal-trader/apps/signal-trader/src/services/signal-trader-services.ts`
- 本地 paper 启动脚本：`/Users/c1/Work/signal-trader/apps/signal-trader/dev/run-local-paper-stack.sh`
- 本地 dummy/live 启动脚本：`/Users/c1/Work/signal-trader/apps/signal-trader/dev/run-local-live-dummy-stack.sh`

## 最小实现边界

- 包含：独立项目骨架、Host 代理、runtime 列表、health/config/projection/event/audit 读取、SubmitSignal 表单、paper Playwright 冒烟、最小运行文档。
- 暂不包含：真实部署脚手架、多页面路由系统、复杂图表库、operator 动作、用户体系、生产鉴权闭环。

## 阶段概览

1. **调研与设计** - 2 个任务
2. **实现** - 2 个任务
3. **验证与交付** - 2 个任务

---

_创建于: 2026-03-22 | 最后更新: 2026-03-22 11:12_
