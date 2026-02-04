## What

- 在 USE_HTTP_PROXY 场景为 tokenBucket key 增加 proxy 出口 ip 维度，确保限流按真实出口 IP 统计。
- 在 http-services 统一 proxy ip 计算/枚举/round robin 选择，并通过 `labels.ip` 路由请求。

## Why

- 现有 key 与实际代理出口 IP 不一致，导致限流失真与诊断困难。

## How

- `@yuants/http-services` 计算并注入 `tags.ip`，仅采信 `ip_source=http-services` 的候选，round robin 选择 ip。
- tokenBucket key 使用 `encodePath([BaseKey, ip])`；直连场景用 `public_ip`，缺失则 `public-ip-unknown`。
- `fetch` 通过 `labels.ip` 路由，保持 key 与路由一致。

## Testing

- `(cd libraries/http-services && npx heft test --clean)` PASS（Jest 3 suites）。
- `npx tsc --noEmit --project apps/vendor-binance/tsconfig.json` FAIL（本地未解析到 TypeScript，工具链问题）。

## Risk / Rollback

- 风险：key cardinality 增加；proxy ip 池为空会阻断代理请求；proxy ip 来源/配置错误导致标签污染。
- 回滚：版本回退到旧 key 逻辑（无功能开关）。

## Links

- RFC: `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/rfc.md`
- Walkthrough: `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/walkthrough.md`
- Code Review: `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-code.md`
- Security Review: `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-security.md`
