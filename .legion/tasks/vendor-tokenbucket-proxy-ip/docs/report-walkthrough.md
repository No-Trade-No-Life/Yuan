# Binance OHLC requestContext 修复 Walkthrough

## 背景

在 `USE_HTTP_PROXY=true` 场景下，Binance OHLC 拉取链路会因缺失 `requestContext` 报错：

- `E_PROXY_TARGET_NOT_FOUND: reason="Missing request context"`

根因是 OHLC 服务直接走公共接口请求链路时，没有统一补齐代理所需的 `requestContext`。

## 实现

本次修复围绕“由 public-api 统一封装代理上下文与请求入口”展开：

### 1. public-api 增加 Kline wrapper

在 `apps/vendor-binance/src/api/public-api.ts` 新增：

- `getFutureKlines`
- `getSpotKlines`

两个 wrapper 统一负责：

- 创建 `requestContext`
- `acquireSync` 限流/权重控制
- 调用 `requestPublic`

这样 OHLC 调用方不再直接拼装公共请求细节，避免再次遗漏代理上下文。

### 2. OHLC service 改为只调用 wrapper

`apps/vendor-binance/src/services/ohlc-service.ts` 调整为仅依赖 public-api 暴露的 wrapper，不再自行处理 Kline 公共请求流程。

同时补充了更明确的品类分支：

- `USDT-FUTURE`
- `SPOT`
- `MARGIN`

对未知 `instType` 显式报错，避免静默落入错误链路。

### 3. 权重与类型整理

- Futures Kline 权重按 `limit` 分段处理
- Spot / Margin 统一走 `getSpotKlines`，权重固定为 `2`
- helper 不再耦合 Kline 参数类型，降低公共辅助逻辑与具体接口参数的绑定

## 验证

已完成以下验证：

1. TypeScript 编译检查

   - 命令：`./node_modules/typescript/bin/tsc --noEmit --project tsconfig.json`
   - 工作目录：`apps/vendor-binance`
   - 结果：PASS

2. 包级构建验证
   - 命令：`rush build --to @yuants/vendor-binance`
   - 工作目录：仓库根目录
   - 结果：PASS

## 评审结论

最终 `review-code` 结论为：`PASS_WITH_NOTES`

主要结论：

- 本次缺失 `requestContext` 的问题已修复
- 当前主要剩余风险：
  - 缺少代理场景的集成测试覆盖
  - `public-api` 中其他 endpoint 仍存在相似模板重复，后续可继续收敛

## 风险与回滚

### 风险

- 当前验证以编译和构建为主，尚未覆盖真实代理链路下的集成测试
- wrapper 收口后，若未来新增公共接口未复用同一模式，仍可能再次出现类似问题

### 回滚

如需回滚，可撤销本次：

- `public-api.ts` 中新增的 Kline wrapper
- `ohlc-service.ts` 对 wrapper 的依赖改造

回滚后系统将恢复到修复前行为，但 `USE_HTTP_PROXY=true` 下的 OHLC 拉取缺陷也会随之恢复。

## 后续建议

- 增加 `USE_HTTP_PROXY=true` 场景下的 Binance 公共接口集成测试，优先覆盖 OHLC
- 继续抽象 `public-api` 中其他公共 endpoint 的统一请求模板，减少重复实现
- 如后续支持更多 `instType`，保持显式分支与显式报错策略，避免隐式兼容
