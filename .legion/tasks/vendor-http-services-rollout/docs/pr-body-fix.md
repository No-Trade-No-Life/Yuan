# What

修复 http-services 在 `USE_HTTP_PROXY=true` 时触发的 `fetch -> Terminal.fromNodeEnv -> fetch` 递归栈溢出，保持调用方接口不变。

# Why

多 vendor 启用代理覆盖后出现 `RangeError: Maximum call stack size exceeded`，影响代理请求可用性与稳定性。

# How

- http-services 覆盖前缓存 `globalThis.__yuantsNativeFetch`，为 proxy fetch 打标记；
- `Terminal` 构造中优先使用稳定 native fetch，并在 `USE_HTTP_PROXY=true` 或 native fetch 不可用/被标记时跳过 public IP 获取。

# Testing

- `rush build -t @yuants/http-services -t @yuants/protocol`（PASS；Node 24.11.0，Rush 5.165.0）。
- 未新增单测/集成测试；建议在启用 `USE_HTTP_PROXY=true` 的 vendor 环境跑一次真实请求验证无栈溢出。

# Risk / Rollback

- 风险：`public_ip` tag 在代理模式下可能为空，观测性略降。
- 回滚：回退 `libraries/http-services/src/client.ts` 与 `libraries/protocol/src/terminal.ts` 变更即可。

# Links

- RFC: `/Users/c1/Work/Yuan/.legion/tasks/vendor-http-services-rollout/docs/rfc.md`
- Walkthrough: `/Users/c1/Work/Yuan/.legion/tasks/vendor-http-services-rollout/docs/report-walkthrough-fix.md`
- Review Code: `/Users/c1/Work/Yuan/.legion/tasks/vendor-http-services-rollout/docs/review-code-fix.md`
- Review Security: `/Users/c1/Work/Yuan/.legion/tasks/vendor-http-services-rollout/docs/review-security-fix.md`
