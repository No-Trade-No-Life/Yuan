# context

## Progress

### Completed

- 复盘 root cause：确认 `apps/vendor-binance/src/services/ohlc-service.ts` 直接调用底层 `requestPublic()`，在 `USE_HTTP_PROXY=true` 时绕过 `createRequestContext()`，触发 `E_PROXY_TARGET_NOT_FOUND: reason="Missing request context"`。
- 在 `apps/vendor-binance/src/api/public-api.ts` 增加 `getFutureKlines()` / `getSpotKlines()`，统一收口 `createRequestContext + tokenBucket + requestPublic`。
- 将 `apps/vendor-binance/src/services/ohlc-service.ts` 改为只消费 public-api wrapper，并显式区分 `USDT-FUTURE | SPOT | MARGIN`。
- 完成验证：`./node_modules/typescript/bin/tsc --noEmit --project tsconfig.json` PASS；`rush build --to @yuants/vendor-binance` PASS。
- 完成代码审查与报告产物更新：`review-code.md`、`review-security.md`、`report-walkthrough.md`、`pr-body.md` 已同步到当前 follow-up。

### In Progress

- 无。

### Blocked

- 无。

## Files

- `apps/vendor-binance/src/api/public-api.ts`：新增 Binance Kline wrapper，统一 requestContext 与主动限流；状态 `completed`。
- `apps/vendor-binance/src/services/ohlc-service.ts`：改为只通过 public-api 请求 OHLC，并显式处理支持的 `instType`；状态 `completed`。
- `apps/vendor-binance/SESSION_NOTES.md`：记录本轮修复与验证结果；状态 `completed`。
- `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/test-report.md`：记录最终类型检查与定向构建结果；状态 `completed`。
- `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-code.md`：记录最终代码审查结论 `PASS_WITH_NOTES`；状态 `completed`。
- `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-security.md`：记录本轮安全审查跳过原因；状态 `completed`。
- `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/report-walkthrough.md`：记录修复 walkthrough；状态 `completed`。
- `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/pr-body.md`：生成可直接用于 PR 的描述；状态 `completed`。

## Decisions

- **2026-03-25**：继续沿用 active task `vendor-tokenbucket-proxy-ip` 处理本次缺失 `requestContext` 的 follow-up 缺陷。  
  原因：问题与同一条 proxy-ip/request-context 演进链直接相关，复用既有任务上下文可避免在当前 taskCreationPolicy 下额外提案，并保持产物集中。  
  备选：新建独立 Legion task；未采用，因为会把同一问题簇拆散，增加上下文切换成本。

- **2026-03-25**：采用“在 `public-api.ts` 增加 Kline wrapper，由 service 只调 public-api”的修法，而不是在 `ohlc-service.ts` 里直接补 `createRequestContext()`。  
  原因：更符合 Binance 现有 public-api / service 分层，能把 requestContext 与限流逻辑继续收口在 API 层，减少下次遗漏。  
  备选：只在 service 层内联补 `createRequestContext()`；未采用，因为会继续允许 service 直连底层 client。

- **2026-03-25**：`ohlc-service.ts` 对市场分支显式列出 `USDT-FUTURE | SPOT | MARGIN`，未知 `instType` 直接报错。  
  原因：比“非 futures 默认走 spot”更易维护，能减少后续新增产品类型时的隐式兼容错误。  
  备选：保留旧 ternary fallback；未采用，因为表达不清晰。

## Handoff

### Next Steps

- 如需更强回归保障，补 1 条 `USE_HTTP_PROXY=true` 下的 OHLC 集成测试，断言不再触发 `Missing request context`。
- 如后续继续扩展 Binance public API，优先复用 `requestPublicWithRateLimit()` 模式，避免新的 endpoint 再次漏传 `requestContext`。

### Notes

- 本轮为 Low 风险 follow-up，因此未新增 RFC，仅在 `plan.md` 中用 design-lite 收敛方案。
- `review-code` 为 `PASS_WITH_NOTES`；剩余主要风险是缺少代理集成测试，以及 `public-api` 其他 endpoint 仍存在重复模板。
