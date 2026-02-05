# What

- Rollout vendor 侧 tokenBucket key 增加出口 IP 维度，USE_HTTP_PROXY 时通过 labels.ip 路由到对应 proxy 出口。

# Why

- 现有 key 与真实出口 IP 不一致，导致限流失真与诊断困难；需要对齐 key 与路由。

# How

- 各 vendor 的 tokenBucket key 使用 `encodePath([BaseKey, ip])`。
- USE_HTTP_PROXY 场景以 labels.ip 路由；直连场景使用 `public_ip` fallback。

# Testing

- `rush build`

# Risk / Rollback

- 风险：`public_ip` 缺失时 `public-ip-unknown` 可能造成多终端共享桶；proxy 池为空时请求失败。
- 回滚：版本回退至旧 key 逻辑。

# Links

- RFC: `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/rfc.md`
- Walkthrough: `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/walkthrough-rollout.md`
- Code Review: `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-code-rollout.md`
- Security Review: `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-security-rollout.md`
