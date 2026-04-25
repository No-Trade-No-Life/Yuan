# signal-trader-standalone-ui 代码审查

## 结论

- Verdict: `PASS-WITH-NITS`
- 审查日期：2026-03-22

## 关键结论

1. `apps/host/src/host-manager.ts` 的多租户 `host_id` 覆盖问题已修复；`ED25519` 模式下不再无条件回落到 `main`。
2. 独立前端的代理链路已统一收敛到 `ui/signal-trader-web/scripts/request-proxy.mjs`，`serve-with-proxy` 与 Vite dev middleware 不再硬编码 `http.request`，`https` Host 可正常工作。
3. `ui/signal-trader-web/scripts/run-playwright.mjs` 已显式检查运行所需构建产物，缺失时会补构建依赖包；paper / dummy-live Playwright 路径可复现。
4. `tsBuildInfoFile` 已移到 `dist/.cache/*`，不会再把 `tsconfig*.tsbuildinfo` 泄漏到项目根目录，Rush 输出边界更干净。

## Nits

1. `ui/signal-trader-web/src/risk.ts` 与 `ui/signal-trader-web/scripts/request-proxy.mjs` 目前维护了两份近似的风控判定逻辑；后续如果继续演进，建议抽成单一规则源，避免阈值漂移。
2. `dummy-live` 目前的自动化路径偏向 fail-close fixture，而非真实 live 观测链路；如果后续要把它升级成更强的联调入口，建议单独开后续任务收口真实 dummy stack 的 runbook。
