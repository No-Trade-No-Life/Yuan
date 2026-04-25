# Summary

## What

- 新增独立前端包 `@yuants/ui-signal-trader-web`，在 `ui/signal-trader-web` 交付 signal-trader 单页控制台，不再继续往 `ui/web` 回接旧控制台。
- 页面覆盖 runtime 列表、环境/health/config/capability 摘要、projection/event/audit 观测面，以及 `SubmitSignal` 写入卡片。
- 同步补齐 Host `/request` 配套修补、Rush 接入与 Playwright 冒烟链路。

## Why

- 旧的 `ui/web` 集成路线已经证明过重且难收口，不适合继续承载高风险控制面。
- 这次目标是交付一个可独立运行、可本地联调、可直接 review 的 signal-trader 控制台，同时把 paper 与 dummy-live 路径的验证一起闭环。
- 对高风险写入，必须把“默认禁写、显式确认、Node 侧复核”做成工程实现，而不是只留在页面提示文案。

## How

- 前端统一通过同源 `/request` 访问 Host；`vite dev` 走 middleware，`preview`/Playwright 走 `serve-with-proxy`，浏览器不持有 `HOST_TOKEN`。
- `SubmitSignal` 前后同时做风险校验：前端 `risk.ts` 控制可视化与按钮态，Node proxy 对 mutation 开关、profile/runtime/capability、health/freshness、`x-runtime-confirmation` 再做一次 fail-close 复核。
- Host 侧补充多租户 `host_id` 修复、敏感头/签名脱敏与 1 MiB body 限制，降低联调阻塞与安全噪音。

# Testing

- 见 `test-report.md`，结论：`PASS`
- `node common/scripts/install-run-rush.js build -t @yuants/app-host -t @yuants/app-postgres-storage -t @yuants/app-signal-trader -t @yuants/tool-sql-migration -t @yuants/ui-signal-trader-web`
- `npm run test:e2e:paper`（workdir=`ui/signal-trader-web`）：验证 paper runtime 加载、health 读取、`SubmitSignal` 成功提交、Event Stream 出现 `SignalReceived`
- `npm run test:e2e:dummy-live`（workdir=`ui/signal-trader-web`）：验证 `dummy-live` 风险档位、未输入 `runtime_id` 时禁写、fail-close 原因可见

# Risk

- 这是 signal-trader 控制面，风险主要集中在高风险 runtime 的误写入；当前实现通过默认只读、双层 fail-close、运行态确认与 freshness 校验收口。
- 已知非阻塞项：前端与 proxy 仍各维护一份近似风控规则；`dummy-live` 自动化当前聚焦 fail-close fixture，而非完整真实 live 链路。

# Rollback

- 立即回到只读：关闭 `SIGNAL_TRADER_ENABLE_MUTATION`，或撤销 Host / signal-trader 的 `SubmitSignal` 写权限。
- 前端级回滚：停止交付 `@yuants/ui-signal-trader-web`，必要时从 `rush.json` 移除项目注册。
- 若仅担心高风险环境，可保留页面观测面，同时继续让 `dummy-live/live` 走默认禁写策略。

# Links

- Plan: `../plan.md`
- RFC: `./rfc.md`
- RFC Review: `./review-rfc.md`
- Code Review: `./review-code.md`
- Security Review: `./review-security.md`
- Walkthrough: `./report-walkthrough.md`
