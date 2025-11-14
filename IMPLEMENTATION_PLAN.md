## Stage 1: Restructure API 层与凭证注入
**Goal**: 拆分 vendor-aster API 层为 public/private/client，与缓存 UID 的 credential helper 一致，消除全局状态。
**Success Criteria**: `src/index.ts` 只聚合模块；API 调用全部走 `src/api/*.ts`；默认凭证从环境变量读取并缓存 UID。
**Tests**: `npx tsc --noEmit --project apps/vendor-aster/tsconfig.json`
**Status**: Complete

## Stage 2: 账户与委托服务对齐
**Goal**: 对齐 `provideAccountInfoService` 与 `providePendingOrdersService`，使用缓存账户 ID 并注册市场。
**Success Criteria**: `account.ts`/`account-spot.ts` 使用新的 cache；`pending-orders.ts` 拆分账户；`addAccountMarket` 与服务注册与 OKX/Bitget 一致。
**Tests**: `npx tsc --noEmit --project apps/vendor-aster/tsconfig.json`
**Status**: Complete

## Stage 3: Public Data 目录与 writer
**Goal**: 将 product/quote/interest_rate 重构至 `src/public-data` 并统一 SQL/channel 行为。
**Success Criteria**: `src/public-data/*.ts` 存在并被 `src/index.ts` 导入；quote writer 支持 `WRITE_QUOTE_TO_SQL`；product writer 使用 `createSQLWriter`。
**Tests**: `npx tsc --noEmit --project apps/vendor-aster/tsconfig.json`
**Status**: Complete

## Stage 4: 交易 RPC（默认与凭证版）
**Goal**: 引入 `order-actions.ts` 与 `order-actions-with-credential.ts`，共享 `order-utils.ts`，并实现统一日志与响应结构。
**Success Criteria**: 默认 RPC 固定 account_id；凭证版支持动态 `credential`；日志包含原始与翻译请求；返回 `{ code:0 }` 结构。
**Tests**: `npx tsc --noEmit --project apps/vendor-aster/tsconfig.json`
**Status**: Complete

## Stage 5: Checklist 文档补充
**Goal**: 更新 `docs/en/vendor-guide/implementation-checklist.md`，补充 API 分层与账户注册细节以指导实现。
**Success Criteria**: 文档新增凭证/API 层指引、账户注册注意事项、公共数据布局细节。
**Tests**: Not Applicable
**Status**: Complete
