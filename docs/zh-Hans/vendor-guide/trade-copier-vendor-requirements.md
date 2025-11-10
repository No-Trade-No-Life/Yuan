# Trade-Copier 适配清单

为了让 `trade-copier` 策略开箱即用，所有 vendor 都必须在 Host 上提供同一组服务和频道。缺任何一项都会导致 copier 无法对账或下单。以下是检查清单：

## 1. 账户快照服务

- **接口：** `provideAccountInfoService`（`@yuants/data-account`）
- **原因：** `runStrategyBboMaker*` 通过 `useAccountInfo` 比较实际账户与预期账户。
- **要求：**
  - 暴露所有需要被 copier 驱动的实盘账户；
  - 包含每个品种的持仓信息（方向、手数、均价等）以及权益/可用资金；
  - 自动刷新（期货建议 1 秒左右）。

## 2. 挂单列表服务

- **接口：** `providePendingOrdersService`（`@yuants/data-order`）
- **原因：** 策略依赖 `queryPendingOrders` 判断是否需要撤单/改价。
- **要求：**
  - 返回账户所有在途订单；
  - 填写 `order_id`, `product_id`, `order_type`, `order_direction`, `volume`, `price`, `submit_at` 等字段；
  - 至少每几秒刷新一次，越快越好（需遵守交易所限流）。

## 3. 品种目录

- **接口：** `provideQueryProductsService`（`@yuants/data-product`）
- **原因：** copier 需要产品的步长、保证金率等信息。
- **要求：**
  - 提供完整的 `product_id`, `datasource_id`, `volume_step`, `price_step`, 保证金等；
  - 定期刷新（可按小时/天）；
  - `datasource_id` 与其他模块使用的命名空间一致（如 `ASTER`、`HYPERLIQUID`）。

## 4. 行情频道（BBO 策略必需）

- **接口：** 发布 `quote` 频道（`terminal.channel.publishChannel('quote', { pattern: '^VENDOR/' }, …)`）
- **原因：** `runStrategyBboMaker` 订阅 `quote/{datasource_id}/{product_id}` 获取买卖价。
- **要求：**
  - 使用交易所提供的 REST 轮询或 WebSocket 数据源；
  - 输出 `last_price`, `bid_price`, `ask_price`, `updated_at`；
  - 推荐使用 `WRITE_QUOTE_TO_SQL` 等环境变量控制是否写库/发布，避免不必要的负载。

## 5. 下单 / 撤单 RPC

### SubmitOrder

- **接口：** `terminal.server.provideService<IOrder>('SubmitOrder', …)`
- **使用：** Copier 对每一笔操作都调用 `terminal.client.requestForResponse('SubmitOrder', order)`。
- **要求：**
  - 支持四种方向：`OPEN_LONG` / `CLOSE_LONG` / `OPEN_SHORT` / `CLOSE_SHORT`；
  - 至少支持 `MARKET`、`LIMIT`、`MAKER`；
  - 返回 `{ res: { code: 0, message: 'OK', data?: { order_id } } }`，便于后续撤单。

### CancelOrder

- **接口：** `terminal.server.provideService<IOrder>('CancelOrder', …)`
- **使用：** Copier 清理旧的 maker 单或改价。
- **要求：**
  - 接受 `order_id`, `product_id`, `account_id`；
  - 成功返回 `code = 0`，失败时把交易所错误透传回去。

## 6. 配置要求

- **环境变量：** vendor 进程需提供所有必要的凭证/地址（如 `API_KEY`, `SECRET_KEY`, `PRIVATE_KEY`, `HOST_URL` 等）；
- **Terminal 元数据：** 文档中写清楚需要的 Host 环境参数，保证 `Terminal.fromNodeEnv()` 能正常连上；
- **特性开关：** 与现有 vendor 保持一致（例如 `WRITE_QUOTE_TO_SQL`），便于统一控制。

## 7. 验收流程

在生产启用前，建议按以下步骤自测：

1. `npx tsc --noEmit --project apps/vendor-<vendor>/tsconfig.json` —— 编译通过；
2. 用 `yuanctl` 手动调用 `QueryAccountInfo`、`QueryPendingOrders`、`SubmitOrder`、`CancelOrder` 做冒烟测试；
3. 在沙盒或小额账户启动 `trade-copier`，确认日志里出现：
   - 每个产品的 `StrategyStart` / `StrategyEnd`；
   - `SubmitOrder` / `CancelOrder` 成功响应；
   - 没有因服务缺失导致的 `RunStrategyError`。

按照本清单逐项检查，就能保证 vendor 与稳定版 trade-copier 兼容，避免后续反复补坑。
