# RFC: vendor-binance 接入 @yuants/http-services

## 背景

当前 `apps/vendor-binance/src/api/client.ts` 直接使用全局 `fetch` 访问 Binance HTTP API。为统一网络路径与代理治理，需要将 HTTP 请求切换到 `@yuants/http-services` 提供的 HTTPProxy 服务。

## 目标

- 仅在 `apps/vendor-binance` 替换 HTTP 传输层，保持 `requestPublic/requestPrivate` 的接口不变。
- 通过 `@yuants/http-services` 代理完成请求，保留现有签名、日志、限流与指标语义。
- 形成可复用迁移模板，为后续 okx/gate/hyperliquid/aster/bitget/huobi 做准备。

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

- `client.ts` 内仅新增 `import { fetch } from '@yuants/http-services'`，覆盖本地 `fetch` 标识。
- 保持现有调用点不变；`fetch` 在内部使用 `Terminal.fromNodeEnv()` 的全局单例。
- 保持现有日志输出格式与限流逻辑。

## 规范条款（用于测试映射）

- R1: `apps/vendor-binance` 的 HTTP 传输层 MUST 使用 `@yuants/http-services` 的 `fetch`，且不修改 `requestPublic/requestPrivate` 调用点代码。
- R2: `requestPublic/requestPrivate` 的外部签名与语义 MUST 保持兼容，调用方无需调整参数。
- R3: `callApi` MUST 读取 `Retry-After` 与 `x-mbx-used-weight-1m` 响应头并保持现有的主动限流与指标逻辑。

## 文件变更明细

| 文件路径                                | 操作 | 说明                                           |
| --------------------------------------- | ---- | ---------------------------------------------- |
| `apps/vendor-binance/package.json`      | 修改 | 新增依赖 `@yuants/http-services`               |
| `apps/vendor-binance/src/api/client.ts` | 修改 | 替换 `fetch` 为 `proxyFetch` 并注入 `terminal` |
| `apps/vendor-binance/SESSION_NOTES.md`  | 修改 | 记录迁移决策、验证步骤、风险                   |

## 依赖与运行要求

- 运行环境需提供 HTTPProxy 服务。
- HTTPProxy 的 `allowedHosts` 需要允许 `api.binance.com`、`fapi.binance.com`、`papi.binance.com`。

## 迁移步骤（仅 binance）

1. 为 `apps/vendor-binance` 添加 `@yuants/http-services` 依赖。
2. 在 `client.ts` 中替换 `fetch` 引用并传入 `terminal`。
3. 保持 `requestPublic/requestPrivate` 调用方无需改动。
4. 记录决策与验证命令到 `apps/vendor-binance/SESSION_NOTES.md`。

## 风险与回滚

- 风险：HTTPProxy 未部署或未放行目标 host，导致请求失败。
- 回滚：恢复使用全局 `fetch` 并移除依赖。

## 未决问题

- 是否需要在后续阶段引入 labels 以区分不同代理节点。
