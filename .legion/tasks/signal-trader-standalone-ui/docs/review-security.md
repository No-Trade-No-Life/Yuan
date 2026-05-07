# signal-trader-standalone-ui 安全审查

## 结论

- Verdict: `PASS-WITH-NITS`
- 审查日期：2026-03-22

## 关键结论

1. `HOST_TOKEN` 仍只停留在 Node 侧：Vite dev middleware 与 `serve-with-proxy` 代理负责注入，浏览器 bundle 不持有 token。
2. Host 侧日志已对 `authorization`、`host_token`、`signature` 做脱敏，避免把认证信息明文写进运行日志。
3. 独立前端的 `/request` 代理不再只是“转发器”，而会在 `SignalTrader/SubmitSignal` 前做 Node 侧 fail-close 复核：
   - `SIGNAL_TRADER_ENABLE_MUTATION`
   - profile/runtime 一致性
   - capability 支持
   - health/freshness
   - `x-runtime-confirmation`
4. `/request` body 大小限制已在两层补齐：Host 与 standalone proxy 都限制为 1 MiB，降低大包体 DoS 面。

## Nits

1. 真正的最终安全边界仍是 Host / signal-trader 服务端授权；standalone proxy 解决的是“本 UI 入口的 fail-close”，不是仓库内所有未来入口的统一安全壳。
2. `ui/signal-trader-web/scripts/run-dummy-live-stack.mjs` 仍保留本地开发默认 token，适合单机联调，但不应被带入共享环境或半生产环境。
