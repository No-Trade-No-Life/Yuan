# spec-obs: vendor http-services 推广

## 目标

保持各 vendor 现有日志/指标不变，同时依赖 HTTPProxy 侧可观测性。

## 变更策略

- 不新增 vendor 侧指标。
- 维持各 vendor 现有日志与限流/指标采集逻辑。
- HTTPProxy 侧日志与指标由 `@yuants/http-services` 提供。

## 注意事项

- 代理 `allowedHosts` 需覆盖各 vendor API host。
- `vendor-aster` 需额外允许 coingecko host。

## 通过标准

- 各 vendor 侧日志/指标保持不变。
- HTTPProxy 侧日志可用于定位请求失败（由运行环境提供）。
