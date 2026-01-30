# spec-obs: vendor-binance http-services 接入

## 目标

保持现有 Binance 指标与日志不变，同时享受 HTTPProxy 侧的可观测性能力。

## 现有观测

- `binance_api_request_total`
- `binance_api_used_weight`
- `callApi` 级别的请求/响应日志

## 变更策略

- 不新增 vendor 侧指标。
- 继续在 `client.ts` 读取 `Retry-After` 与 `x-mbx-used-weight-1m` 并记录。
- HTTPProxy 侧指标与日志由 `@yuants/http-services` 提供。

## 通过标准

- binance 侧指标与日志保持不变。
- HTTPProxy 侧日志可用于定位请求失败（由运行环境提供）。
