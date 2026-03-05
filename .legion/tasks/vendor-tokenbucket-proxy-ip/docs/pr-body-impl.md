# Summary

- 在 `http-services` 落地 `acquireProxyBucket`，实现“可承载组优先 + 候选失败切换”的主动限流选择逻辑，统一 options 来源并新增冲突保护。
- 在 `client.fetch` 明确 route/request 阶段错误边界：route 统一 `E_PROXY_TARGET_NOT_FOUND`，request 统一 `E_PROXY_REQUEST_FAILED`。
- 在 `vendor-binance` 接入统一 request context：代理模式使用 helper 返回的 `{ip, terminalId, bucketKey}`，直连模式使用 `public_ip` 维度；确保限流 key 与 `labels.ip` 路由一致。
- 在 `http-proxy` 仅接受 `ip_source=http-services` 的标签注入，收敛 proxy 路由信任边界。

# Testing

- `cd libraries/http-services && npx heft test --clean` ✅ (4 suites, 35 total, 0 failed)
- `rush build --to @yuants/vendor-binance --to @yuants/app-http-proxy` ✅
- review 结果：`review-code PASS`，`review-security PASS`

# Risks

- `TRUSTED_HTTP_PROXY_TERMINAL_IDS` 配置缺失/错误会触发 fail-closed（`E_PROXY_TARGET_NOT_FOUND`）。
- 直连场景 `public_ip` 缺失会降级到 `public-ip-unknown`，存在跨终端共享桶风险。
- 同 `bucketKey` options 来源不一致时会触发 `E_BUCKET_OPTIONS_CONFLICT` 并中断请求。

# Rollback

- 回滚到上一稳定版本，恢复旧版 proxy 选择/限流路径。
- 如需快速止血，优先切回旧代理调用逻辑并持续观察 `E_PROXY_TARGET_NOT_FOUND`、`E_PROXY_BUCKET_EXHAUSTED`、请求成功率。

# Links

- RFC: `/Users/c1/Work/Yuan/.legion/tasks/vendor-tokenbucket-proxy-ip/docs/rfc.md`
- Review RFC: `/Users/c1/Work/Yuan/.legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-rfc.md`
- Walkthrough: `/Users/c1/Work/Yuan/.legion/tasks/vendor-tokenbucket-proxy-ip/docs/report-walkthrough-impl.md`
