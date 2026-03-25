## Summary

修复 Binance OHLC 在 `USE_HTTP_PROXY=true` 场景下因缺失 `requestContext` 导致的请求失败问题。  
通过在 `public-api.ts` 中新增 `getFutureKlines` / `getSpotKlines` wrapper，统一处理 `createRequestContext`、`acquireSync` 和 `requestPublic`，并让 `ohlc-service.ts` 仅调用该封装入口。

同时补充了 Futures Kline 按 `limit` 分段权重、Spot/Margin 使用统一 spot wrapper（weight=2），并将 OHLC 的 `instType` 分支改为显式处理 `USDT-FUTURE | SPOT | MARGIN`，未知类型直接报错。

## Validation

- `./node_modules/typescript/bin/tsc --noEmit --project tsconfig.json`（workdir: `apps/vendor-binance`）✅
- `rush build --to @yuants/vendor-binance`（workdir: repo root）✅

## Risks

- 当前缺少代理场景的集成测试，真实代理链路仍建议补充端到端验证
- `public-api` 中其他 endpoint 仍有模板重复，后续可继续收敛统一

## Rollback

回滚 `apps/vendor-binance/src/api/public-api.ts` 中新增的 Kline wrapper，以及 `apps/vendor-binance/src/services/ohlc-service.ts` 对 wrapper 的调用改造即可恢复到修复前状态。
