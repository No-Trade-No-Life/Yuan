# 代码审查报告

## 结论

PASS

## 阻塞问题

- [ ] 无

## 建议（非阻塞）

- `apps/http-proxy/src/index.ts:25` - 当前仍注册 `labels.hostname`。这不再是 `terminal_id` pin，但会继续保留一个非 `ip` 的路由维度；如果目标是彻底收敛到“仅按 `labels.ip` 路由”，建议移除，或至少补一条注释/测试说明 `hostname` 仅用于观测而非业务依赖。
- `apps/vendor-binance/src/api/client.ts:110` - 这里承接了本次最关键的语义切换（proxy 模式改为 helper 返回 `{ ip, bucketKey }` 且 `acquireWeight=0`），但当前 scope 内没有直接针对 `createRequestContext` 的单测；建议补充 proxy/direct 两条回归，锁定 `bucketKey`、`acquireWeight` 与 `labels.ip` 的同源关系。
- `libraries/http-services/src/__tests__/integration.test.ts:199` - 集成测试已经覆盖“仅 `labels.ip` 也能路由成功”，但还没有显式断言“移除 `terminal_id` 后不再需要任何 terminal 维度标签”；建议补一条负向/对照用例，避免未来有人把 route pin 以别的标签形式重新带回。

## 修复指导

1. 若要严格兑现“仅按 `labels.ip` 路由”，把 `apps/http-proxy/src/index.ts` 中的 `labels.hostname` 去掉，并新增一个启动层或集成层断言，检查注册 labels 仅包含 `ip`。
2. 为 `apps/vendor-binance/src/api/client.ts` 增加最小回归测试：
   - `USE_HTTP_PROXY=true` 时，`createRequestContext()` 应返回 helper 给出的 `ip`/`bucketKey`，且 `acquireWeight === 0`。
   - 非代理模式下，应使用 `public_ip`（缺失时 fallback）构造 `bucketKey`。
   - 发起代理请求时，传给 `fetch` 的 labels 只包含 `ip`。
3. 保持 `libraries/http-services/src/proxy-ip.ts` 当前共享候选逻辑不分叉：后续若新增 helper，继续复用 `listHTTPProxyCandidates` + `listTrustedHTTPProxyIpsSnapshot`，不要再单独读 env、单独做 terminal 过滤或单独做去重。

[Handoff]
summary:

- 已完成只读审查，scope 内未发现阻塞问题；`TRUSTED_HTTP_PROXY_TERMINAL_IDS` 生产代码语义已移除。
- 未发现 `terminal_id` route pin 残留；`AcquireProxyBucketResult`、`http-proxy` labels、`vendor-binance` 请求上下文已对齐为 IP 维度。
- helper 候选逻辑已统一到 `listHTTPProxyCandidates`/`listTrustedHTTPProxyIpsSnapshot`，测试已覆盖 env ignored、same-ip dedupe、labels.ip only route acceptance。
  decisions:
- 结论定为 PASS；仅保留可维护性与防回归建议。
  risks:
- `labels.hostname` 仍提供额外路由维度，若团队目标是“只允许 ip 选路”，后续可能再次引入隐式耦合。
- `apps/vendor-binance/src/api/client.ts` 缺少直接回归测试，未来重构时较难第一时间发现 request-context 语义漂移。
  files_touched:
- path: /Users/c1/Work/http-proxy-whitelist/.legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-code.md
  commands:
- (none)
  next:
- 如需更严格收敛路由维度，先处理 `labels.hostname`。
- 如需提高回归防护，补 `vendor-binance` 的 request-context 单测。
  open_questions:
- (none)
