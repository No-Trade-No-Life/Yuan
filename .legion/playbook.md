# Playbook

## [Convention] HTTPProxy trust model follows host trust domain

- 来源任务：`vendor-tokenbucket-proxy-ip`
- 日期：2026-03-21
- 结论：在当前部署模型下，同一 host 网络中的 terminal 默认互信；不要再用 `terminal_id` 做 HTTPProxy allowlist 或 route pin。
- 边界：`terminal_id`、`hostname`、`ip_source` 只适合观测、缓存、诊断上下文；不要把它们重新升级为 trust boundary。
- 若部署前提变化：需要在 host 接入层补身份校验/隔离，不要回退到 `terminal_id` 白名单补丁。

## [Convention] vendor-binance public-api must own requestContext

- 来源任务：`vendor-tokenbucket-proxy-ip`
- 日期：2026-03-25
- 结论：在 `apps/vendor-binance` 中，凡是走 `requestPublic()` 的公共 REST 链路，都应优先封装在 `src/api/public-api.ts`，由 API wrapper 统一负责 `createRequestContext`、主动限流和 `requestPublic`。
- 边界：service 层只负责业务参数与响应映射，不应直接触碰底层 `requestPublic()`；否则在 `USE_HTTP_PROXY=true` 场景极易再次遗漏 `requestContext`。
