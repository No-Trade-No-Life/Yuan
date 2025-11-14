# Vendor 实现检查清单

为了让 `trade-copier` 与转账链路复用同一套能力，每个 vendor 进程都必须实现相同的服务、频道和配置。缺少其中任何一项，都会在下单、对账或资金调拨时出现缺口。请在接入、巡检或扩展 vendor 时逐条核对本清单。

## 1. 账户快照服务

- **接口：** `provideAccountInfoService`（`@yuants/data-account`）
- **原因：** `runStrategyBboMaker*`（见 `apps/trade-copier/src/BBO_MAKER.ts`）依赖 `useAccountInfo` 对比目标头寸，Web UI（`ui/web/src/modules/TradingBoard/AccountInfo.tsx`）和 `yuanctl` 查询也都订阅同一数据源。
- **依赖组件：** `trade-copier`、账户看板、CLI 巡检、所有调用 `useAccountInfo` 的策略。
- **要求：**
  - 暴露所有由 copier 驱动的账户，包含实时余额和逐品种持仓。
  - 字段需覆盖方向、手数、均价、权益、可用资金、授信等基础信息。
  - 通过轮询或推送自动刷新（期货建议 ≈1 秒）；注意断线重连。

## 2. 挂单列表服务

- **接口：** `providePendingOrdersService`（`@yuants/data-order`）
- **原因：** `queryPendingOrders` 同时驱动做市策略（`apps/trade-copier/src/BBO_MAKER_BY_DIRECTION.ts`）与人工排障，决定是否撤单或调价。
- **依赖组件：** `trade-copier`、`yuanctl query pending-orders`、Web TradingBoard 可视化。
- **要求：**
  - 返回全部在途订单，字段包含 `order_id`, `product_id`, `order_type`, `order_direction`, `volume`, `price`, `submit_at` 等。
  - 按交易所限速尽量高频刷新（优选 ≤3 秒），并保证 `order_id` 与下单 RPC 一致。
  - 对完全成交/撤销的订单及时下线，避免脏数据。

## 3. 品种目录

- **接口：** `provideQueryProductsService`（`@yuants/data-product`）
- **原因：** copier 依赖产品元数据来限制价格/数量步长、计算保证金，并驱动 UI 选择器。
- **依赖组件：** `trade-copier`、`apps/vendor-*/src/e2e/submit-order.e2e.test.ts`、GUI 产品筛选、风险监控。
- **要求：**
  - 输出 `product_id`, `datasource_id`, `volume_step`, `price_step`, `margin_rate`, 合约面值、可开方向等；可参考 `apps/vendor-okx/src/product.ts`、`apps/vendor-hyperliquid/src/product.ts`。
  - 通过 `auto_refresh_interval` 至少每小时刷新一次，保持与交易所上市变更同步。
  - `datasource_id` 在所有服务中保持一致（如 `ASTER`、`HYPERLIQUID`、`OKX`），方便 SQL 联表。

## 4. 行情频道（BBO 策略必需）

- **接口：** `terminal.channel.publishChannel('quote', { pattern: '^VENDOR/' }, …)`
- **原因：** `runStrategyBboMaker` 订阅 `quote/{datasource_id}/{product_id}` 获取买卖价，行情分析与 SQL 也沿用该通道。
- **依赖组件：** `trade-copier`、其他做市代理、监控大屏、`quote` 表。
- **要求：**
  - 推送 `last_price`, `bid_price`, `ask_price`, `open_interest`（如可用）与 `updated_at`。
  - 复用 `apps/vendor-hyperliquid/src/quote.ts` 的开关模式（`WRITE_QUOTE_TO_SQL`），避免重复写库。
  - 在 WebSocket 不可用时降级到 REST 轮询，并保持时间戳单调。

## 5. 交易 RPC

### SubmitOrder

- **接口：** `terminal.server.provideService<IOrder>('SubmitOrder', …)`
- **原因：** 所有自动化策略和运维脚本都通过该 RPC 下单，便于审计。
- **依赖组件：** `trade-copier`、`yuanctl submit-order`、如 `apps/vendor-aster/src/e2e/submit-order.e2e.test.ts` 等端到端测试。
- **要求：**
  - 支持 `OPEN_LONG` / `CLOSE_LONG` / `OPEN_SHORT` / `CLOSE_SHORT` 以及至少 `MARKET`、`LIMIT`、`MAKER`。
  - 返回 `{ res: { code: 0, message: 'OK', data?: { order_id } } }`，异常时透传交易所错误。
  - 打印原始请求与转换后的交易所参数，方便排障。
  - 若需要支持多账户/动态账户，参考 `apps/vendor-okx/src/order-actions-with-credential.ts` 提供带 `credential` 的服务版本：校验 `account_id` 正则，强制包含 `access_key` / `secret_key` / `passphrase` 等字段，避免环境变量限制账户数量；保留默认服务时确保两套接口行为一致。

### CancelOrder

- **接口：** `terminal.server.provideService<IOrder>('CancelOrder', …)`
- **原因：** 做市循环需要稳定撤单才能收敛仓位。
- **依赖组件：** `trade-copier`、`yuanctl cancel-order`、人工 kill-switch。
- **要求：**
  - 接受 `order_id`, `product_id`, `account_id`，对未知订单给出显式失败。
  - 成功返回 `code = 0`，失败时附带交易所错误信息。

## 6. 转账接口

- **接口：** `addAccountTransferAddress` 或底层 `TransferApply` / `TransferEval`（`@yuants/transfer`）
- **原因：** `@yuants/app-transfer-controller`（`apps/transfer-controller/src/index.ts`）会规划多跳调拨路径，要求 vendor 执行并对账每一步。
- **依赖组件：** Transfer Controller、定制资金调度脚本、跨所资金机器人。
- **要求：**
  - 将所有 (`account_id`, `network_id`, `currency`, `address`) 组合注册到 `account_address_info`，供控制器路由。
  - 对长流程提现实现状态机（如 `INIT` → `AWAIT_TX_ID` → `COMPLETE`），通过 `current_tx_context` 传递上下文，参考 `docs/zh-Hans/vendor-guide/vendor-transfer.md`。
  - `onEval`/`TransferEval` 返回到账金额或链上 `transaction_id`，确保风控可追踪。

## 附加指引

### 配置要求

- 统一记录凭证/地址（`API_KEY`, `SECRET_KEY`, `PASSPHRASE`, `HOST_URL` 等），供交易与转账模块共用。
- 引入缓存与机密管理时，可仿照 `apps/vendor-okx/src/account.ts` 使用 `@yuants/cache` 做 SWR/TTL 轮询、用 `@yuants/secret` 托管敏感凭证，以减少 API 限频并确保多账户扩展不会泄露 key。
- 确保 `Terminal.fromNodeEnv()` 能获取 Host、命名空间、实例标签等元数据。
- 特性开关与现有 vendor 保持一致（如 `WRITE_QUOTE_TO_SQL`, `DISABLE_TRANSFER`），便于统一运维。
- 公共市场数据建议集中在 `public-data/*` 风格目录，向 OKX 那样通过 `index.ts` 统一入口，避免行情/利率脚本散落各处导致无法复用。

### 验收流程

`yuanctl` 的一键冒烟仍在规划中（TBD）。在此之前，请按接口逐项完成以下手动端到端验证：

1. 编译检查：`npx tsc --noEmit --project apps/vendor-<vendor>/tsconfig.json`。
2. 逐接口自测（建议在预发布或沙盒账户执行）：
   - **账户快照**：使用脚本调用 `terminal.client.requestForResponse('QueryAccountInfo', { account_id })` 或订阅 `useAccountInfo`，核对持仓/余额与交易所后台一致。
   - **挂单列表**：执行 `queryPendingOrders(terminal, account_id, true)`，比对交易所未成交订单页面。
   - **品种目录**：调用 `terminal.client.requestForResponse('QueryProducts', { datasource_id: 'VENDOR_ID', force_update: true })`，确认价格/数量步长和保证金字段与官方文档匹配。
   - **行情频道**：临时订阅 `quote/{datasource_id}/{product_id}`（如用 `terminal.channel.subscribeChannel`），确保每秒更新、时间戳单调。
   - **SubmitOrder / CancelOrder**：运行 `apps/vendor-*/src/e2e/submit-order.e2e.test.ts` 或等价脚本，下发并撤销一笔小额订单，确认 RPC 返回 `code = 0` 且挂单列表及时更新。
3. 转账路径：针对每条 (`account_id`, `network_id`, `currency`, `address`) 组合，通过 `@yuants/app-transfer-controller` 的演练模式或自研脚本触发 `TransferApply`，观察状态机从 `INIT` 走到 `COMPLETE`，并在随后调用 `TransferEval` 核对到账金额或链上 `transaction_id`。

逐项通过本清单，才能保证 vendor 同时适配交易与转账控制器，而无需额外补丁。
