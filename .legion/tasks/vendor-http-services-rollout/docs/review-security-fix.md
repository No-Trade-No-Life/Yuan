# Security Review Report

## 结论

PASS

## Blocking Issues

- [ ] 无

## 安全建议（非阻塞）

- `libraries/protocol/src/terminal.ts:149` [Information Disclosure] - `host_url` 在查询参数中携带 `host_token` 与 `signature`，若使用明文 `ws://` 或中间层日志记录 URL，可能泄露鉴权材料；建议强制 `wss://`，并避免在 URL 中携带敏感参数。
- `libraries/protocol/src/terminal.ts:132` [Information Disclosure] - 默认会向 `https://ifconfig.me/ip` 发起外联请求暴露公网 IP；若部署环境有合规或隐私要求，建议通过显式配置关闭或允许列表控制。
- `libraries/protocol/src/terminal.ts:132` [Denial of Service] - 公网 IP 获取未设置超时，若请求卡住将占用连接与资源，建议为 fetch 增加超时/取消机制并限制重试次数。
- `libraries/http-services/src/client.ts:60` [Tampering] - 代理请求不限制 `url` 协议与目的地；若输入可被不可信来源控制，可能导致 SSRF/内部网探测；建议在调用侧或此层增加允许列表/协议校验（`https`/`http`）。
- `libraries/protocol/src/terminal.ts:1034` [Elevation of Privilege] - `Terminate`/`Metrics` 服务的访问控制依赖外部安全层，当前文件未体现鉴权检查；需要确认 `TerminalSecurity` 或服务端对调用方进行身份/权限校验，否则存在远程终止与敏感指标泄露风险（无法评估，需补充安全边界说明）。
- `libraries/protocol/src/terminal.ts:180` [Spoofing] - 终端身份校验依赖 `host_token` 与签名，是否强制 `host_token` 存在与有效性校验取决于服务端实现；无法评估服务端是否拒绝空 `host_token` 或重放（无法评估，需补充服务端验证规则）。
- `libraries/http-services/src/client.ts:60` [Repudiation] - 代理请求缺少与审计相关的 trace/actor 绑定字段（如 terminal_id/trace_id 注入），依赖上层调用侧；若需要可追溯审计需补充关联 ID（无法评估，需补充链路追踪策略）。

## 修复指导

1. 强制 `HOST_URL` 使用 `wss://`，并将 `host_token`/`signature` 从 URL 查询参数迁移到安全头（或在连接握手层传递），同时在日志中屏蔽查询参数。
2. 为 public IP 获取增加超时与最大重试次数，或通过环境变量显式关闭；在合规环境默认关闭或使用内网服务。
3. 若 `fetch` 输入可能来自不可信来源，在 `@yuants/http-services` 内增加 URL 允许列表/协议校验，阻断 `file://`、`gopher://` 等非预期协议。
4. 明确 `TerminalSecurity`/服务端的鉴权规则：拒绝空 `host_token`、校验签名与重放、限制 `Terminate/Metrics` 访问权限，并将该规则写入文档与测试用例。
5. 如果需要审计可追溯性，统一在代理链路中注入并记录 `trace_id/terminal_id`（避免记录敏感 URL/凭证）。
