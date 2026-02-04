# Security Review Report

## 结论

PASS

## Blocking Issues

- None.

## 安全建议（非阻塞）

- `apps/http-proxy/src/index.ts:17` [Information Disclosure] - 启动日志输出 `labels.ip` 与 `hostname`，若日志对外可见会暴露代理出口 IP/主机信息；建议降级为 debug、采样或脱敏。
- `libraries/http-services/src/proxy-ip.ts:88` [Spoofing] - `listHTTPProxyIps` 信任 `terminalInfo.tags.ip` 作为代理出口 IP。**无法评估**该标签的可信来源/认证边界，需补充终端注册/鉴权或标签签名/白名单说明与校验。
- `libraries/http-services/src/proxy-ip.ts:58` [Tampering] - `PROXY_IP_FETCH_URL` 仅限制为 `https`，但未做域名 allowlist；若环境变量被篡改，可能被导向不可信 HTTPS 端点污染 IP 标签。建议限制到内网/白名单域名或仅允许固定默认。

## 修复指导

1. 日志最小化：将 `labels.ip`/`hostname` 的 info 日志降级为 debug 或进行脱敏/采样输出。
2. 可信来源闭环：为 `terminalInfo.tags.ip` 增加可验证的来源信号（签名/白名单/注册认证），并在 `listHTTPProxyIps` 中进行校验过滤。
3. 收敛 fetch URL 边界：对 `PROXY_IP_FETCH_URL` 增加域名 allowlist 或仅允许固定默认端点，避免被配置劫持。

补充确认（已满足本次重点检查项）：

- 默认 https：`libraries/http-services/src/proxy-ip.ts:5` 使用 `https://ifconfig.me/ip`，且 `normalizeHttpsUrl` 强制 `https`。
- `PROXY_IP_FETCH_URL` 限制：`libraries/http-services/src/proxy-ip.ts:38` 仅接受 `https:`。
- 空 ip 不覆盖：`libraries/http-services/src/proxy-ip.ts:74` 空值直接 `skip inject`，不会覆盖已有 `tags.ip`。
