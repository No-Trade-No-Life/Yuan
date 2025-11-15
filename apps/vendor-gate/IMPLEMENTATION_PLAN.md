## Stage 1: API 分层与凭证缓存
**Goal**: 拆解 Gate REST 客户端（public/private）并缓存 UID/凭证，暴露 `Terminal.fromNodeEnv()` 的统一入口。
**Success Criteria**: 1) `src/api` 分层，2) 默认凭证 helper 可复用，3) `index.ts` 仅聚合模块。
**Tests**: `npx tsc --noEmit --project apps/vendor-gate/tsconfig.json`。
**Status**: Complete

## Stage 2: 账户/订单/转账能力
**Goal**: 对齐 vendor-bitget 的账户快照、挂单、默认与凭证化下单 RPC 以及内外转账状态机。
**Success Criteria**: 1) `provideAccountInfoService` 覆盖期货/统一/现货，2) `providePendingOrdersService` 驱动期货未成交，3) 默认/凭证化 `SubmitOrder`/`CancelOrder` 生效并沿用 `order-utils.ts`，4) `transfer.ts` 支持内部划转+TRC20 提现。
**Tests**: `npx tsc --noEmit --project apps/vendor-gate/tsconfig.json`、人工下/撤单冒烟。
**Status**: Complete

## Stage 3: 公共行情与文档固化
**Goal**: 搭建 `public-data/{product,interest_rate,quote}` + SQL 写入链路，并把要求补充到 checklist，最后完成 Rush 版本记录。
**Success Criteria**: 1) SQL/Channel 同步行情，2) Checklist 明确 quote/SQL 要求，3) 生成 `rush change`（minor）。
**Tests**: `npx tsc --noEmit --project apps/vendor-gate/tsconfig.json`、`rush change -b work`。
**Status**: In Progress
