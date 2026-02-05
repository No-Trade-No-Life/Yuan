# Security Review Report

## 结论

PASS

## Blocking Issues

- 无

## 安全建议（非阻塞）

- `apps/vendor-bitget/src/api/client.ts:44` [Denial of Service] - public_ip 缺失时使用固定值 `public-ip-unknown` 作为维度，多个终端会共享同一桶导致跨终端互相限流。建议改为稳定且隔离的 fallback（例如 `terminal_id` + 缺省标记）。
- `apps/vendor-huobi/src/api/public-api.ts:30` [Denial of Service] - public_ip 缺失时 fallback 到固定值会让公共接口限速在多终端间耦合，存在跨租户干扰风险。建议同上处理。
- `apps/vendor-huobi/src/api/private-api.ts:34` [Denial of Service] - 私有接口的 bucket 维度依赖 requestContext.ip，缺失时同样会合并到共享桶。建议同上处理。
- `apps/vendor-hyperliquid/src/api/rate-limit.ts:203` [Denial of Service] - IP 维度来自上游传入，若缺失或统一为固定值会导致全局共享桶。建议确保调用方提供稳定且可区分的终端维度，或在函数内部引入终端维度兜底。
- `apps/vendor-okx/src/api/public-api.ts:30` [Repudiation] - proxy 路由场景日志未记录选中的 proxy ip，排障时缺少审计证据。建议在 DEBUG 级别记录脱敏 ip（或 hash）与是否使用代理。
- `apps/vendor-gate/src/api/http-client.ts:60` [Information Disclosure] - DEBUG 日志会打印完整响应和 headers（可能包含账户信息），建议仅在受控环境启用并在文档注明风险。
- 无法评估 [Spoofing/Tampering] - `selectHTTPProxyIpRoundRobin` 的 ip 池来源与信任边界不在本次变更中，无法确认 labels.ip 是否可被非预期路径影响。

## 修复指导

1. 缺失 public_ip 的 fallback 改为稳定且隔离的维度（推荐 `terminal.terminal_id` + 缺省标记），避免多终端共享同一 tokenBucket。
2. 若不允许 public_ip 缺失，启动时明确告警并拒绝启用 USE_HTTP_PROXY/限速逻辑，防止静默退化。
3. 在 proxy 路由场景添加 DEBUG 级可审计日志，记录 proxy 选择来源与脱敏 ip/terminal_id。
4. 补充文档或单测，明确 ip 池来源与异常处理路径，闭环可信边界。
