# Playbook

## [Convention] HTTPProxy trust model follows host trust domain

- 来源任务：`vendor-tokenbucket-proxy-ip`
- 日期：2026-03-21
- 结论：在当前部署模型下，同一 host 网络中的 terminal 默认互信；不要再用 `terminal_id` 做 HTTPProxy allowlist 或 route pin。
- 边界：`terminal_id`、`hostname`、`ip_source` 只适合观测、缓存、诊断上下文；不要把它们重新升级为 trust boundary。
- 若部署前提变化：需要在 host 接入层补身份校验/隔离，不要回退到 `terminal_id` 白名单补丁。
