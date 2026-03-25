# 代码审查报告

## 结论

PASS_WITH_NOTES

## 阻塞问题

- [ ] 无

## 主要结论

- `apps/vendor-binance/src/services/ohlc-service.ts` 已不再直接调用底层 `requestPublic()`，而是统一改走 `apps/vendor-binance/src/api/public-api.ts` 的 Kline wrapper。
- `apps/vendor-binance/src/api/public-api.ts` 中新增的 `getFutureKlines` / `getSpotKlines` 会先创建 `requestContext`，再执行主动限流并调用 `requestPublic()`；从代码路径看，`USE_HTTP_PROXY=true` 时不再会命中 `Missing request context`。
- OHLC service 的市场分支已显式列出 `USDT-FUTURE | SPOT | MARGIN`，未知类型直接报错，避免隐式落入错误分支。

## 非阻塞备注

- [medium] 当前结论主要来自静态审查；尚未补一条真实代理环境下的 OHLC 集成回归，后续仍建议在 `USE_HTTP_PROXY=true` 场景增加最小验证。
- [low] `public-api.ts` 中除 Kline 外的其他 public endpoint 仍有重复的 `createRequestContext + tokenBucket + requestPublic` 模板；本次修复不受影响，但后续新增接口仍存在遗漏 `requestContext` 的回归风险。
- [low] `public-api` 仍未统一收口 Binance 错误对象（如 `{ code, msg }`）到更明确的 API 层异常；这不是本次缺陷修复的阻塞项，但属于可维护性债务。

## 建议后续

1. 为 `USE_HTTP_PROXY=true` 增加 1 条最小集成测试，确认 OHLC 不会再触发 `E_PROXY_TARGET_NOT_FOUND`。
2. 视后续改动量，把 `public-api` 里的公共请求模板进一步收敛为更通用的 helper，减少手写重复。
3. 若后续继续增强健壮性，可在 API 层统一判别 Binance 错误响应，避免 service 层在响应 shape 不匹配时才暴露失败。
