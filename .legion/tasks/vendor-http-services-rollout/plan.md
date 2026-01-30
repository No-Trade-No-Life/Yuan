# vendor-http-services-rollout

SUBTREE_ROOT: apps/vendor-binance

## 目标

用新的 @yuants/http-services 替换 vendor HTTP fetch 调用，先在 vendor-binance 完成调研/文档/实现并通过验证，再按同方案推广至其他指定 vendor。

## 要点

- 先聚焦 apps/vendor-binance 完成替换与验证，形成可复用的迁移模式
- 调研现有 fetch 使用点、封装层与请求路径，明确替换边界与兼容风险
- 输出 RFC + dev/test/bench/obs specs，包含迁移步骤、接口变更点、回滚策略
- 实现阶段只改 binance；扩展到 okx/gate/hyperliquid/aster/bitget/huobi 作为后续阶段（需用户确认）
- 新增：通过环境变量 USE_HTTP_PROXY 控制是否启用代理 fetch 覆盖，全局副作用需确认

## 范围

- apps/vendor-binance
- libraries/http-services (usage only)
- docs/ (design outputs in .legion task docs)

## 阶段概览

1. **调研** - 1 个任务
2. **设计** - 1 个任务
3. **实现（仅 binance）** - 1 个任务
4. **推广（其他 vendor）** - 1 个任务

## 设计方案

### 核心流程

1. `requestPublic/requestPrivate` 保持现有签名，内部继续调用 `callApi`。
2. `callApi` 负责构建 URL、追加 query、签名与 header，并维持现有日志与限流语义。
3. 仅新增 `import { fetch } from '@yuants/http-services'`，通过环境变量 `USE_HTTP_PROXY` 决定是否覆盖 `globalThis.fetch`，调用点保持不变：
   - `USE_HTTP_PROXY=true` 时启用代理 fetch（全局副作用）
   - 未开启时使用原生 fetch
   - 传入 `terminal`（沿用当前模块的 `Terminal.fromNodeEnv()` 实例）；
   - 初期不强制 labels，避免要求代理节点额外配置；
   - 代理返回 `Response` 后继续读取 `Retry-After`、`x-mbx-used-weight-1m` 等 header。
4. 保持 `res.json()` 与错误处理逻辑不变，确保调用方输出类型与语义一致。

### 接口定义（保持兼容）

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

### 迁移策略

- 只改 `apps/vendor-binance/src/api/client.ts` 的 import 与初始化逻辑，确保上层 `public-api.ts` / `private-api.ts` 无感。
- 依赖新增 `@yuants/http-services`，由 Rush/PNPM 统一管理。
- 初期不引入 labels 与超时配置；若代理部署完成后需要分流，再增量引入 labels。

### 文件变更明细表（仅 binance）

| 文件路径                                | 操作 | 说明                                              |
| --------------------------------------- | ---- | ------------------------------------------------- |
| `apps/vendor-binance/package.json`      | 修改 | 新增依赖 `@yuants/http-services`                  |
| `apps/vendor-binance/src/api/client.ts` | 修改 | 通过 `USE_HTTP_PROXY` 条件覆盖 `globalThis.fetch` |
| `apps/vendor-binance/SESSION_NOTES.md`  | 修改 | 记录迁移决策、验证命令与风险                      |

### 风险与回滚

- 运行时需存在 HTTPProxy 服务；否则请求会失败。应确认代理部署与 `allowedHosts` 已覆盖 `api.binance.com`/`fapi.binance.com`/`papi.binance.com`。
- 回滚策略：移除覆盖逻辑并恢复使用原生 `fetch`，或设置 `USE_HTTP_PROXY` 为非 true。

---

## 设计自检报告

- [x] 核心流程清晰，调用路径仅变更传输层。
- [x] 接口定义保持兼容，不改外部调用方式。
- [x] 文件变更明细已列出且范围可控。
- [ ] 代理部署与 allowedHosts 覆盖范围需由运行环境确认（阻塞实现阶段）。

## 请求用户确认

请确认以下事项：

- 先在 `apps/vendor-binance` 完成替换并验证，通过后再扩展到其他 vendor。
- 初期不强制 labels；后续需要分流时再增量引入。
- 运行环境需提供 HTTPProxy 服务并放行 Binance 三个 host。
- 需要确认可接受全局覆盖 `globalThis.fetch` 的副作用。

确认后我将继续生成 RFC 与 spec 文档并完成设计门禁。

---

_创建于: 2026-01-29 | 最后更新: 2026-01-30_
