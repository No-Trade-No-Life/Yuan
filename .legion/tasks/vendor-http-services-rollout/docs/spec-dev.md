# spec-dev: vendor-binance http-services 接入

## 目标

在不改变 `requestPublic/requestPrivate` 外部调用方式的前提下，将 Binance HTTP 访问改为通过 `@yuants/http-services` 代理执行。

## 现状调研结论

- `fetch` 仅出现在 `apps/vendor-binance/src/api/client.ts`。
- 所有 HTTP 请求均通过 `requestPublic/requestPrivate` 调用链触达 `callApi`。

## 设计要点

- 只改传输层：`callApi` 内的 `fetch` 替换为 `@yuants/http-services` 的 `fetch`。
- 保持签名、headers、限流与指标逻辑不变。
- 初期不强制 labels；代理路由交由部署侧配置。

## 接口与调用约定

```ts
import { fetch } from '@yuants/http-services';
```

- 不改动调用点，保持现有 `fetch(url.href, { method, headers })` 形态。
- `fetch` 内部使用 `Terminal.fromNodeEnv()`；不传 `labels` 与 `timeout`。

## 文件变更

| 文件路径                                | 变更 | 说明                                                                       |
| --------------------------------------- | ---- | -------------------------------------------------------------------------- |
| `apps/vendor-binance/package.json`      | 修改 | 添加依赖 `@yuants/http-services`                                           |
| `apps/vendor-binance/src/api/client.ts` | 修改 | 新增 `import { fetch } from '@yuants/http-services'` 覆盖本地 `fetch` 标识 |
| `apps/vendor-binance/SESSION_NOTES.md`  | 修改 | 记录迁移决策、验证步骤、风险                                               |

## 兼容性与回滚

- `requestPublic/requestPrivate` 签名保持不变。
- 回滚策略：恢复原 `fetch` 调用并移除依赖。

## 实现备注

- `apps/vendor-binance/src/api/client.ts` 日志需避免输出 API key、signature/signData 与完整 query，仅保留 method/host/path/usedWeight/retryAfter。

## 开发步骤

1. 更新 `apps/vendor-binance/package.json` 依赖。
2. 修改 `apps/vendor-binance/src/api/client.ts` 替换 `fetch`。
3. 最小验证（见 spec-test）。
4. 更新 `apps/vendor-binance/SESSION_NOTES.md`。
