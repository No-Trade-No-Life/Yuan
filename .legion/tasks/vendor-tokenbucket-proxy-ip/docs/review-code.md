# Code Review Report

## 结论

FAIL

基于有限信息的评审；未提供完整变更摘要，仅检查以下文件：`libraries/http-services/src/proxy-ip.ts`。

## Blocking Issues

- [ ] `libraries/http-services/src/proxy-ip.ts:145` - `listHTTPProxyIps` 的缓存重建只采信 `tags.ip` 且 `ip_source=http-services`，未实现 RFC/决策中“代理场景优先 `tags.ip`、fallback 到 `tags.public_ip`”的要求。若 http-proxy 终端尚未注入 `tags.ip` 或 `ip_source` 缺失，将导致 IP 池为空，`selectHTTPProxyIpRoundRobin` 直接抛 `E_PROXY_TARGET_NOT_FOUND`，代理请求被硬失败。

## 建议（非阻塞）

- `libraries/http-services/src/proxy-ip.ts:200` - 订阅清理仅依赖 `terminal.dispose$`，若部分 `Terminal` 未提供该 hook，缓存与订阅无法释放；可考虑在 `terminal.terminalInfos$` 完成/错误时解绑，或引入显式的 `clearHTTPProxyIpCache` 工具。
- `libraries/http-services/src/proxy-ip.ts:170` - 缺失/不可信 IP 的日志已限频，但“IP 池为空”的全局症状缺少限频日志/指标，建议在 `selectHTTPProxyIpRoundRobin` 或调用侧增加一次性告警以便排障。

## 修复指导

1. 在 `rebuildProxyIpCache` 中加入 fallback：
   - 优先使用 `tags.ip` 且 `ip_source === http-services`。
   - 当 `tags.ip` 为空时，回退到 `tags.public_ip`（需 `isIP` 校验）。
   - 若引入 fallback，请同步扩展 `signature` 与 `isSameProxyTerminal`，包含 `tags.public_ip` 的变化以触发缓存刷新。
2. 若安全模型不允许 fallback 到 `public_ip`，需更新 RFC/决策并在此处增加清晰日志，说明为何 pool 为空且不降级。
