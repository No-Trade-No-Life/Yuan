# spec-test: vendor http-services 推广

## 目标

验证各 vendor 在 USE_HTTP_PROXY 开关下仍可构建与最小调用链不回归。

## 范围

- `apps/vendor-okx`
- `apps/vendor-gate`
- `apps/vendor-hyperliquid`
- `apps/vendor-aster`
- `apps/vendor-bitget`
- `apps/vendor-huobi`

## 测试项

1. 构建验证（推荐）

```bash
rush build -t @yuants/vendor-okx
rush build -t @yuants/vendor-gate
rush build -t @yuants/vendor-hyperliquid
rush build -t @yuants/vendor-aster
rush build -t @yuants/vendor-bitget
rush build -t @yuants/vendor-huobi
```

2. 手工验证（如有可用环境）

- 各 vendor 选择 1 个 public + 1 个 private 调用链，验证返回 JSON 正常。
- 验证 `USE_HTTP_PROXY=true` 时走代理；`USE_HTTP_PROXY=false` 时走原生 fetch（无原生则回退代理）。
- `vendor-aster` 额外验证 coingecko 请求可达。

## 通过标准

- 各 vendor 构建通过。
- 手工验证无报错（若无环境则记录未执行原因）。
