# signal-trader-standalone-ui - 上下文

## 会话进展 (2026-03-22)

### ✅ 已完成

- 已盘点 signal-trader 相关旧任务：确认 `signal-trader-ui-console` 的 `ui/web` 集成路线不再继续，本次改为新建独立前端项目。
- 已完成初步调研：确认 `ui/webpilot` 是仓库内最轻量的 Vite + React 模板，signal-trader 现有服务可直接通过 Host `/request` 消费。
- 已完成 task-local RFC 与对抗性审查，blocker 已收敛为 PASS-WITH-NITS。
- 已交付独立前端项目 `ui/signal-trader-web`：单页控制台覆盖 runtime rail、环境摘要、health/config/capability、projection/event/audit 与 SubmitSignal 写区。
- 已完成 Host `/request` 配套修补：修复多租户 `host_id` 覆盖、敏感日志脱敏、Host/proxy 双层 body limit。
- 已完成验证：Rush 目标构建通过，Playwright `paper` happy path 与 `dummy-live` fail-close path 通过。

### 🟡 进行中

(暂无)

### ⚠️ 阻塞/待定

(暂无)

---

## 关键文件

(暂无)

---

## 关键决策

| 决策                                                                                                                    | 原因                                                                                                                                                       | 替代方案                                                                                                                           | 日期       |
| ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 新前端项目独立落在 `ui/signal-trader-web`，不再触碰 `ui/web` 的 signal-trader 页面。                                    | 旧方案已经失败，继续往 `ui/web` 集成只会继承其构建噪音、依赖复杂度与宿主耦合；新项目更符合“少打断、可独立启动、可直接交付”的目标。                         | 继续修补 `ui/web/src/modules/SignalTrader/SignalTraderConsole.tsx`；缺点是继续受旧宿主限制，且会把本次交付与之前失败尝试混在一起。 | 2026-03-22 |
| 前端统一调用同源 `/request`，开发态用 Vite proxy，构建后用 Node `serve-with-proxy` 托管静态文件并转发 Host 请求。       | 这样可以同时满足本地联调、Playwright、`HOST_TOKEN` 不进浏览器以及 `build + preview` 可运行四个要求。                                                       | 只依赖 Vite dev proxy；缺点是 `build/preview` 无法落地，也无法形成稳定的 Playwright 运行链路。                                     | 2026-03-22 |
| 风险层级硬规则采用 `env profile + runtime config + capability summary` 交叉校验，任一缺失或冲突都按 `live` 且默认禁写。 | 控制面必须 fail-close；前端不能因为 profile 推断失真而把高风险 runtime 误降级成低风险。                                                                    | 仅根据前端环境变量或 `execution_mode` 单点判断；缺点是边界模糊，容易在 dummy/live 混淆时放松护栏。                                 | 2026-03-22 |
| 独立前端的 Node proxy 在转发 `SignalTrader/SubmitSignal` 前重复做 fail-close 校验，而不是只依赖浏览器按钮禁用。         | 仅靠前端态容易被 devtools 或未来同源脚本绕过；把 mutation/profile/runtime/capability/health/freshness/confirmation 复核前移到 proxy 层，能显著缩小误用面。 | 只在 React 页面内判断 `canSubmit`；缺点是任何同源直通 `/request` 的请求都能绕过 UI 护栏。                                          | 2026-03-22 |
| `dummy-live` 的自动化验证采用 task-local fixture server，而 paper 仍使用真实本地 signal-trader 栈。                     | 本次交付重点是稳定验证高风险 fail-close 与独立前端读写闭环；paper 更适合真实 happy path，dummy-live fixture 更适合稳定验证禁写与确认门禁。                 | 把真实 docker dummy-live 也纳入通过标准；缺点是 scope 会被真实 live 观测链路 runbook 拖大，难在本轮收口。                          | 2026-03-22 |

---

## 快速交接

**下次继续从这里开始：**

1. 直接使用 `.legion/tasks/signal-trader-standalone-ui/docs/pr-body.md` 作为 PR 描述发起 review。
2. 如果后续要强化 live 联调，可单独开任务把真实 docker dummy-live runbook 收口为稳定脚本。

**注意事项：**

- 关键产物已齐：`rfc.md`、`review-rfc.md`、`test-report.md`、`review-code.md`、`review-security.md`、`report-walkthrough.md`、`pr-body.md`。
- 当前 `dummy-live` 自动化以 fixture fail-close 为主，真实 live 观测链路未在本任务内继续扩大。

---

_最后更新: 2026-03-22 03:09 by Claude_
