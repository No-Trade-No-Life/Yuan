## Stage 1: 文档与实施计划
**Goal**: 创建实施计划并修订 vendor checklist，使其完整覆盖 Hyperliquid 所需要求。
**Success Criteria**:
- `IMPLEMENTATION_PLAN.md` 按阶段列出目标、标准与测试。
- `docs/zh-Hans/vendor-guide/implementation-checklist.md` 与 `docs/en/vendor-guide/implementation-checklist.md` 都补充 DEX 命名与 Quote publish 规则。
**Tests**:
- 人工检查两份文档内容一致且信息完整。
**Status**: Complete

## Stage 2: API 分层与凭证抽象
**Goal**: 将 Hyperliquid API 拆分成 client/public/private 模块，并引入可扩展的 credential 获取方式。
**Success Criteria**:
- 存在 `src/api/client.ts`, `src/api/public-api.ts`, `src/api/private-api.ts`, `src/api/types.ts`。
- 私有 API 调用都显式依赖 `ICredential`，并提供 `getDefaultCredential()`。
**Tests**:
- `npx tsc --noEmit --project apps/vendor-hyperliquid/tsconfig.json`。
**Status**: Complete

## Stage 3: 账户与挂单服务模块化
**Goal**: 抽离账户、挂单服务逻辑，复用新的 API 层并注册 account market。
**Success Criteria**:
- 新建 `src/account.ts`，提供账户信息与未成交订单服务。
- 生成正确的 `account_id` 并与 market 绑定。
**Tests**:
- `npx tsc --noEmit --project apps/vendor-hyperliquid/tsconfig.json`。
**Status**: Complete

## Stage 4: 交易 RPC 对齐
**Goal**: 使用统一工具构建下单/撤单 RPC，支持默认与请求级凭证。
**Success Criteria**:
- `src/order-utils.ts`、`src/order-actions.ts`、`src/order-actions-with-credential.ts` 实现请求。
- Submit/Cancel 返回 `{ code: 0, message: 'OK', data: { order_id } }`。
**Tests**:
- `npx tsc --noEmit --project apps/vendor-hyperliquid/tsconfig.json`。
**Status**: Complete

## Stage 5: 公共数据目录整理与测试
**Goal**: 重构 public data（product/quote/interest_rate/ohlc），统一导出并按 checklist 要求发布。
**Success Criteria**:
- `src/public-data/` 下包含对应模块与 `index.ts`。
- Quote 服务无条件 publish channel，并在需要时写 SQL。
- 通过 TypeScript 编译检查。
**Tests**:
- `npx tsc --noEmit --project apps/vendor-hyperliquid/tsconfig.json`。
**Status**: Complete
