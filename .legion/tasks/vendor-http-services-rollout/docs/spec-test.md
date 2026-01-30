# spec-test: vendor-binance http-services 接入

## 目标

验证替换 `fetch` 后的编译与最小运行路径不回归。

## 范围

- 仅覆盖 `apps/vendor-binance` 的编译与关键路径调用。

## 测试项

1. TypeScript 类型检查

```bash
npx tsc --noEmit --project apps/vendor-binance/tsconfig.json
```

2. 手工验证（如有可用环境）

- 选择一个公共 API（如 `getSpotExchangeInfo`）调用链，确认可以通过 HTTPProxy 返回 JSON。
- 验证 `x-mbx-used-weight-1m` 与 `Retry-After` header 读取无异常。
- 验证 `USE_HTTP_PROXY=true` 时走代理：请求经 HTTPProxy，日志/指标显示代理路径。
- 验证 `USE_HTTP_PROXY=false` 时走原生 fetch：无需依赖 HTTPProxy 也能正常请求。

3. 单元测试（计划新增）

- 测试框架：Jest（通过 Heft `@rushstack/heft-jest-plugin`）。
- 目录建议：`apps/vendor-binance/src/api/__tests__/`。
- Mock 策略：使用 `jest.mock('@yuants/http-services')`，返回可控 Response；Mock 数据放在 `apps/vendor-binance/src/api/__tests__/__fixtures__/`。

## RFC 条款覆盖映射（R1..Rn）

- R1: `client.http-services.test.ts` 覆盖 `requestPublic/requestPrivate` 调用 `@yuants/http-services` 的 `fetch`。
- R2: `client.compat.test.ts` 覆盖 `requestPublic/requestPrivate` 签名与返回语义（调用方无需改动，参数保持兼容）。
- R3: `client.rate-limit.test.ts` 覆盖 `Retry-After` 与 `x-mbx-used-weight-1m` 的读取与主动限流/指标逻辑。

## 失败场景与回归用例

- `Retry-After` 生效期间再次调用同一 endpoint 必须抛出 `ACTIVE_RATE_LIMIT`（回归用例: `client.rate-limit.test.ts`）。
- `@yuants/http-services` 的 `fetch` 抛错时应透传异常（回归用例: `client.http-services.test.ts`）。
- 响应不含 `x-mbx-used-weight-1m` 时不应更新指标（回归用例: `client.rate-limit.test.ts`）。

## 计划新增测试清单（待补）

- `apps/vendor-binance/src/api/__tests__/client.http-services.test.ts`
- `apps/vendor-binance/src/api/__tests__/client.compat.test.ts`
- `apps/vendor-binance/src/api/__tests__/client.rate-limit.test.ts`
- `apps/vendor-binance/src/api/__tests__/__fixtures__/http-responses.ts`

## 通过标准

- 类型检查通过。
- 手工验证无报错（若无环境则记录未执行原因）。

## 实施备注（本轮）

- 本轮不新增测试用例，仅补充 USE_HTTP_PROXY 的手工验证要点。
- R1-R3 覆盖与失败场景回归用例保持在计划清单，待后续补齐。
