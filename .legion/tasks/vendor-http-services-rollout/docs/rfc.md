# RFC: vendor-binance 接入 @yuants/http-services

## 背景

当前 `apps/vendor-binance/src/api/client.ts` 直接使用全局 `fetch` 访问 Binance HTTP API。为统一网络路径与代理治理，需要将 HTTP 请求切换到 `@yuants/http-services` 提供的 HTTPProxy 服务。

## 目标

- 仅在 `apps/vendor-binance` 替换 HTTP 传输层，保持 `requestPublic/requestPrivate` 的接口不变。
- 通过 `@yuants/http-services` 代理完成请求，保留现有签名、日志、限流与指标语义。
- 形成可复用迁移模板，并将方案推广到 okx/gate/hyperliquid/aster/bitget/huobi。

## 非目标

- 不在本阶段调整上层业务逻辑与 API 结构。
- 不引入新的重试/限流策略。
- 不改变请求参数与返回类型。

## 核心流程

1. `requestPublic/requestPrivate` 仍作为对外入口。
2. `callApi` 继续负责 URL 组装、签名、headers、日志与限流。
3. 传输层切换为 `@yuants/http-services` 的 `fetch`，并注入 `terminal`。
4. 响应处理仍读取 `Retry-After` 与 `x-mbx-used-weight-1m`，并返回 `res.json()`。

## 接口定义（保持兼容）

```ts
export const requestPublic = <T>(method: HttpMethod, endpoint: string, params?: RequestParams) =>
  callApi<T>(method, endpoint, params);

export const requestPrivate = <T>(
  credential: ICredential,
  method: HttpMethod,
  endpoint: string,
  params?: RequestParams,
) => callApi<T>(method, endpoint, params, credential);
```

## 设计方案

- `client.ts` 内新增 `import { fetch } from '@yuants/http-services'`，由 `USE_HTTP_PROXY` 决定是否覆盖 `globalThis.fetch`。
- 保持现有调用点不变；启用时 `fetch` 内部使用 `Terminal.fromNodeEnv()`。
- 保持现有日志输出格式与限流逻辑。

## 规范条款（用于测试映射）

- R1: `apps/vendor-binance` 的 HTTP 传输层 MUST 使用 `@yuants/http-services` 的 `fetch`，且不修改 `requestPublic/requestPrivate` 调用点代码。
- R2: `requestPublic/requestPrivate` 的外部签名与语义 MUST 保持兼容，调用方无需调整参数。
- R3: `callApi` MUST 读取 `Retry-After` 与 `x-mbx-used-weight-1m` 响应头并保持现有的主动限流与指标逻辑。

## 文件变更明细

| 文件路径                                | 操作 | 说明                                              |
| --------------------------------------- | ---- | ------------------------------------------------- |
| `apps/vendor-binance/package.json`      | 修改 | 新增依赖 `@yuants/http-services`                  |
| `apps/vendor-binance/src/api/client.ts` | 修改 | 通过 `USE_HTTP_PROXY` 条件覆盖 `globalThis.fetch` |
| `apps/vendor-binance/SESSION_NOTES.md`  | 修改 | 记录迁移决策、验证步骤、风险                      |

## 依赖与运行要求

- 运行环境需提供 HTTPProxy 服务。
- HTTPProxy 的 `allowedHosts` 需要允许 `api.binance.com`、`fapi.binance.com`、`papi.binance.com`。

## 迁移步骤（推广到其他 vendor）

1. 为各 vendor 包添加 `@yuants/http-services` 依赖。
2. 在每个 vendor 的 HTTP 客户端/REST 层引入 `fetchImpl` 与 `USE_HTTP_PROXY` 开关，调用点保持不变。
3. 对于 `vendor-aster` 的 coingecko 请求，同样使用 `fetchImpl`。
4. 记录各 vendor 的验证命令与风险到对应 `SESSION_NOTES.md`。

## 风险与回滚

- 风险：HTTPProxy 未部署或未放行目标 host，导致请求失败。
- 风险：`USE_HTTP_PROXY` 覆盖 `globalThis.fetch` 具有全局副作用，可能影响同进程其它模块。
- 风险：`USE_HTTP_PROXY=false` 时若运行环境无原生 fetch，将回退到代理 fetch（行为与直连预期可能不一致）。
- 风险：覆盖 `globalThis.fetch` 具有全局副作用，可能影响同进程其它模块。
- 回滚：恢复使用全局 `fetch` 并移除依赖。

## 未决问题

- 是否需要在后续阶段引入 labels 以区分不同代理节点。
- 是否需要列出并固定各 vendor 的 allowedHosts 白名单（含 coingecko）。
- 是否需要限定覆盖范围（仅 vendor-binance）或引入更细粒度开关。
