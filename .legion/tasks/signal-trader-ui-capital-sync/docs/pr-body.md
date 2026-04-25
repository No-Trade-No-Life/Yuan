# What

- 本 PR 将独立前端 `ui/signal-trader-web` 同步到最新 capital 能力，新增可直接阅读的 capital / investor / signal / reconciliation 视图，以及 formal quote / internal netting / advisory 证据卡片。
- 页面仍保留 raw projection、event stream、audit log 下钻能力，但默认阅读路径不再依赖“翻 JSON 才看得懂状态”。
- 写区 `SubmitSignal` 继续保持 fail-close，前端没有新增或透传 `reference_price*`，正式价格证据仍由后端 worker 注入。

# Why

- 后端资本系统能力这几轮已经补齐，但独立前端仍停留在早期控制台形态，导致用户要通过事件流和审计日志自行拼装 capital 语义。
- 这让“能力已存在、产品读面却缺席”的问题持续存在，尤其在 capital posture、formal quote、internal netting、profit target advisory 与 reconciliation explanation 上最明显。
- 本 PR 的目标是把这些后端能力收敛成默认可读的控制台，同时不放松高风险写入边界。

# How

- 在 `src/types.ts` / `src/api.ts` 同步 `subscription`、`investor`、`signal`、`reconciliation` 的最新字段，并将 projection 读取扩为五类并发、逐项容错。
- 在 `src/insights.ts` / `src/app.tsx` 中集中提炼并展示 formal quote、internal netting、profit target、quote fail-close 诊断，新增 `Capital Ledger` 与 `Formal Price Evidence` 卡片。
- raw 证据面继续保留，但事件、审计、projection 展示统一走 `sanitize*` 过滤，避免整对象裸透传到浏览器。

# Testing

- `./test-report.md`
- `npm run build`（workdir=`ui/signal-trader-web`）: PASS
- `npm run test:e2e:paper`（workdir=`ui/signal-trader-web`）: PASS
- 备注：当前自动化仍偏 smoke test，后续可继续补 capital / investor / signal / quote / reconciliation 字段值断言。

# Risk / Rollback

- 风险主要在于 evidence 摘要对 event / audit 结构演进较敏感，以及前端展示面扩大后需要持续维持 `sanitize*` allowlist 收口。
- 若发现卡片口径有误，可先回滚 `Capital Ledger` / `Formal Price Evidence` 这类派生展示，保留 raw projection / event / audit 与写入护栏不变。
- 本轮不改后端协议，回滚只需撤回前端同步改动即可。

# Links

- Plan: `../plan.md`
- RFC: `./rfc.md`
- RFC Review: `./review-rfc.md`
- Code Review: `./review-code.md`
- Security Review: `./review-security.md`
- Walkthrough: `./report-walkthrough.md`
