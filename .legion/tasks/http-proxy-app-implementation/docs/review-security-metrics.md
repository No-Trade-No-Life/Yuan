# Security Review Report

## 结论

FAIL

## Blocking Issues

- [ ] `libraries/http-services/src/server.ts:158` [Spoofing] - 服务处理器未做调用方身份认证或授权校验，任何可连接终端都可伪造请求并使用代理能力，存在未授权访问与资源滥用风险。
- [ ] `libraries/http-services/src/server.ts:179` [Elevation of Privilege] - 当 `allowedHosts` 未配置或为空时不做任何访问限制，服务等价开放代理，可被用于访问内网或受限资源。
- [ ] `libraries/http-services/src/server.ts:200` [Denial of Service] - `timeout` 由客户端控制且无上限，恶意设置超大值可长期占用连接与并发资源，触发资源耗尽。

## 安全建议（非阻塞）

- `libraries/http-services/src/server.ts:70` [Information Disclosure] - `target_path` 直接记录路径，若路径中包含 token/账号/PII 会被指标暴露，建议对路径进行分桶/脱敏或限制为固定前缀。
- `libraries/http-services/src/server.ts:70` [Denial of Service] - `target_path` 作为高基数字段未做限制，攻击者可构造无限路径导致指标内存与存储压力飙升。
- `libraries/http-services/src/server.ts:184` [Information Disclosure] - `newError('FORBIDDEN', { allowedHosts })` 可能将白名单回传给调用方，建议避免向客户端泄露白名单细节，仅记录服务端日志。

## 修复指导

1. 增加强制鉴权与授权：在 handler 起点验证 caller identity（例如基于 Terminal 会话/签名/ACL），并拒绝未授权请求。
2. secure-by-default：将 `allowedHosts` 设为必填或默认空即 fail-fast；若业务允许开放代理，需显式开关并在配置中强制声明。
3. 设定 `timeout` 上限与范围校验（例如 1s–60s），超限直接拒绝请求或回退至安全默认值。
4. 对 `target_path` 做脱敏或分桶（仅保留前 N 段、固定路由模板或哈希截断），并限制 label 基数。
5. 仅在服务端日志记录 `allowedHosts` 细节，对外错误信息改为通用提示。

## 无法评估

- 调用方身份认证与连接安全（传输层加密、会话鉴权、ACL）需补充系统级设计说明或上游网关策略。
- 速率限制/并发上限是否由 `IServiceOptions` 或上游网关强制，需提供对应配置与默认值。
