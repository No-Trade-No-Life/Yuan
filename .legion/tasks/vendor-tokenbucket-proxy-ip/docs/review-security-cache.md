# Security Review Report

## 结论

FAIL

## Blocking Issues

- [ ] `libraries/http-services/src/proxy-ip.ts:66` [Spoofing] - 无法评估 `terminalInfo.tags.ip_source` 的可信边界：当前仅通过字符串 `http-services` 判定可信来源，若 Host 侧未校验 `UpdateTerminalInfo`/`HostEvent` 的来源与权限，任意终端可伪造 `ip_source` 注入 proxy ip，影响限流 key 与路由一致性。需要补充 Host 侧校验/签名/白名单规则的证据或实现。

## 安全建议（非阻塞）

- `libraries/http-services/src/proxy-ip.ts:191` [Denial of Service] - 订阅清理依赖 `terminal.dispose()` 触发；若调用方未执行 dispose 或出现异常退出，`terminalInfos$` 订阅与 `proxyIpCachesByTerminalId` 可能滞留。建议在 `provideHTTPProxyService` 或进程退出钩子中统一 dispose，或增加超时/弱引用清理策略。
- `libraries/http-services/src/proxy-ip.ts:64` [Information Disclosure] - fetch 失败日志直接输出 error 对象，可能包含外部 URL/栈信息；若日志对外可见，建议进行错误信息最小化或降级到 code。

## 修复指导

1. 明确 `ip_source` 信任边界：在 Host 侧实现 `UpdateTerminalInfo` 校验，仅允许 http-proxy 或 http-services 具备特定身份/权限的终端写入 `tags.ip` 与 `tags.ip_source`，并在 HostEvent 广播前二次过滤。
2. 为 `ip_source` 增加不可伪造的可信信号：例如 Host 侧签名 `tags.ip`，客户端验证签名；或以 `terminal_public_key`/service 身份绑定策略做白名单。
3. 订阅清理：在 http-proxy 进程退出（SIGINT/SIGTERM）与服务停止流程中确保 `terminal.dispose()` 被调用；若无法保证，考虑引入 watchdog 或弱引用缓存清理。
4. 日志最小化：将 fetch 错误改为结构化 code/简要信息，避免输出原始 error 对象。

## 备注（无法评估）

- 需要 Host 侧对 `UpdateTerminalInfo`/`HostEvent` 的身份校验与授权规则实现细节，以确认 `ip_source` 不可被外部终端伪造。
