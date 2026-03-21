# What

- 删除 `TRUSTED_HTTP_PROXY_TERMINAL_IDS`，将 HTTPProxy 信任模型收敛为“同一 host 网络内默认互信 + IP 维度候选池”。
- 删除 `terminal_id` 相关 route pin：`AcquireProxyBucketResult`、`IRequestContext`、`apps/http-proxy` 服务标签、`apps/vendor-binance` 请求标签全部收敛到只保留 `ip` / `bucketKey` 所需字段。
- 保持 IP 维度限流与路由同源：bucket 继续按 `encodePath([baseKey, ip])` 隔离，请求继续只按 `labels.ip` 路由。
- 明确类似字段的边界：`terminal_id` 本地缓存/metrics、`hostname`、`ip_source` 仍可保留，但仅限观测/缓存，不再承担 trust boundary 或 route pin 语义。

# Why

- `terminal_id` 不稳定，把它继续当成 HTTPProxy allowlist 或稳定身份会带来配置漂移、误拒绝和回滚复杂度。
- 当前实际出口与 token bucket 已经以 IP 为主维度，继续把 `terminal_id` 混入 helper 返回值和请求标签，只会制造“同一出口、不同身份”的伪差异。
- 用户已明确确认“host 内互信”前提，因此实现应与该前提对齐，而不是继续维持 terminal 级 trust boundary。

# How

- 在 `libraries/http-services/src/proxy-ip.ts` 删除 allowlist/env/cache/log 分支，并让所有 proxy IP helper 统一复用“`HTTPProxy` 服务 + 合法 `tags.ip` + `ip_source=http-services` + IP 去重”的候选构造逻辑。
- 在 `apps/http-proxy/src/index.ts` 删除 `labels.terminal_id`，仅保留 `labels.ip` 作为业务路由键；`hostname` 仅保留为观测字段。
- 在 `apps/vendor-binance/src/api/client.ts` 删除 `terminalId` 上下文与 `labels.terminal_id`，代理请求只发送 `labels.ip`。
- 在 `proxy-ip` / `client` / `integration` 测试与 `http-services.api.md` 中同步收敛，确保 env ignored、same-ip dedupe、labels.ip-only route 和 API 导出面一起通过。

# Testing

- 详情见：`.legion/tasks/vendor-tokenbucket-proxy-ip/docs/test-report.md`
- `node common/scripts/install-run-rush.js install` ✅
- `node common/scripts/install-run-rush.js build --to @yuants/app-host` ✅
- `npx @rushstack/heft test --clean` @ `libraries/http-services` ✅ (`4 suites / 38 tests / 0 failed`)
- `node common/scripts/install-run-rush.js build --to @yuants/http-services --to @yuants/vendor-binance` ✅
- `npm run build` @ `apps/vendor-binance` ✅
- 备注：曾有一次失败；首次未先构建 `@yuants/app-host`，导致 integration host 起不来。补构建后复跑通过。

# Risk / Rollback

- 风险：信任边界从 terminal allowlist 收敛为 host 内默认互信；如果该部署前提变化，当前模型会退化为前提外高风险设计。
- 风险：`terminal_id` 本地缓存/metrics、`hostname`、`ip_source` 若未来再次被升级为授权或自动路由条件，会重新引入错误 trust boundary。
- 风险：`http-proxy` 的 `allowedHosts` 等外围控制仍依赖部署约束，不是本 PR 新增问题，但仍需持续关注。
- 回滚：回退到删除 allowlist 之前的稳定 commit/版本，恢复旧的 `TRUSTED_HTTP_PROXY_TERMINAL_IDS` 与 `terminal_id` route pin 逻辑。

# Links

- Plan: `.legion/tasks/vendor-tokenbucket-proxy-ip/plan.md`
- RFC: `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/rfc.md`
- Test Report: `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/test-report.md`
- Code Review: `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-code.md`
- Security Review: `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-security.md`
- Walkthrough: `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/report-walkthrough.md`
