# spec-dev: vendor http-services 推广

## 目标

将 USE_HTTP_PROXY + fetchImpl 模式推广到 okx/gate/hyperliquid/aster/bitget/huobi，调用点保持不变。

## 现状调研结论

- okx: `src/api/public-api.ts`, `src/api/private-api.ts`
- gate: `src/api/http-client.ts`
- hyperliquid: `src/api/client.ts`
- aster: `src/api/public-api.ts`, `src/api/private-api.ts`, `src/services/accounts/spot.ts`（coingecko）
- bitget: `src/api/client.ts`
- huobi: `src/api/public-api.ts`, `src/api/private-api.ts`

## 设计要点

- 为每个 vendor 引入 `fetchImpl` 与 `USE_HTTP_PROXY` 开关。
- `USE_HTTP_PROXY=true` 时覆盖 `globalThis.fetch`；`false` 时优先原生 fetch，不可用则回退 http-services fetch。
- 调用点保持 `fetch(url, init)` 形态，改为使用 `fetchImpl`（或 `globalThis.fetch`）作为执行入口。
- 初期不强制 labels；代理路由由部署侧配置。

## 接口与调用约定

```ts
import { fetch } from '@yuants/http-services';

const shouldUseHttpProxy = process.env.USE_HTTP_PROXY === 'true';
const fetchImpl = shouldUseHttpProxy ? fetch : globalThis.fetch ?? fetch;

if (shouldUseHttpProxy) {
  globalThis.fetch = fetch;
}
```

## 文件变更

| 文件路径                                          | 变更 | 说明                                    |
| ------------------------------------------------- | ---- | --------------------------------------- |
| `apps/vendor-okx/package.json`                    | 修改 | 添加依赖 `@yuants/http-services`        |
| `apps/vendor-okx/src/api/public-api.ts`           | 修改 | 引入 `fetchImpl` 与 USE_HTTP_PROXY 开关 |
| `apps/vendor-okx/src/api/private-api.ts`          | 修改 | 引入 `fetchImpl` 与 USE_HTTP_PROXY 开关 |
| `apps/vendor-gate/package.json`                   | 修改 | 添加依赖 `@yuants/http-services`        |
| `apps/vendor-gate/src/api/http-client.ts`         | 修改 | 引入 `fetchImpl` 与 USE_HTTP_PROXY 开关 |
| `apps/vendor-hyperliquid/package.json`            | 修改 | 添加依赖 `@yuants/http-services`        |
| `apps/vendor-hyperliquid/src/api/client.ts`       | 修改 | 引入 `fetchImpl` 与 USE_HTTP_PROXY 开关 |
| `apps/vendor-aster/package.json`                  | 修改 | 添加依赖 `@yuants/http-services`        |
| `apps/vendor-aster/src/api/public-api.ts`         | 修改 | 引入 `fetchImpl` 与 USE_HTTP_PROXY 开关 |
| `apps/vendor-aster/src/api/private-api.ts`        | 修改 | 引入 `fetchImpl` 与 USE_HTTP_PROXY 开关 |
| `apps/vendor-aster/src/services/accounts/spot.ts` | 修改 | coingecko 请求使用 `fetchImpl`          |
| `apps/vendor-bitget/package.json`                 | 修改 | 添加依赖 `@yuants/http-services`        |
| `apps/vendor-bitget/src/api/client.ts`            | 修改 | 引入 `fetchImpl` 与 USE_HTTP_PROXY 开关 |
| `apps/vendor-huobi/package.json`                  | 修改 | 添加依赖 `@yuants/http-services`        |
| `apps/vendor-huobi/src/api/public-api.ts`         | 修改 | 引入 `fetchImpl` 与 USE_HTTP_PROXY 开关 |
| `apps/vendor-huobi/src/api/private-api.ts`        | 修改 | 引入 `fetchImpl` 与 USE_HTTP_PROXY 开关 |

## 兼容性与回滚

- 业务调用签名保持不变。
- 回滚策略：移除 USE_HTTP_PROXY 覆盖逻辑与 `@yuants/http-services` 依赖。

## 开发步骤

1. 为各 vendor 添加 `@yuants/http-services` 依赖。
2. 在各 vendor API 层引入 `fetchImpl` 与 USE_HTTP_PROXY 开关。
3. `vendor-aster` 的 coingecko 请求改用 `fetchImpl`。
4. 最小验证（见 spec-test）。
5. 更新各 vendor `SESSION_NOTES.md`。
