# Vendor 实现检查清单

为了让 `trade-copier` 与转账链路直接复用，每个 vendor 进程都必须暴露一致的服务、频道和配置。接入、巡检或扩展 vendor 时，请逐条核对本清单。

## 0. 运行期与 API 分层

- **原因：** 保证 CLI、常驻进程与多账户扩展在行为上绝对一致，避免凭证泄露或全局状态污染。
- **要求：**
  - `src/index.ts` 只负责聚合（如 `import './services/legacy'`、`import './services/order-actions-with-credential'`、`import './services/markets/quote'`），具体逻辑放在 `services/*` 模块，保证 CLI 与常驻服务一致；旧版 `account.ts` / `order-actions.ts` 等可保留为兼容层，但请逐步迁移到模块化目录。
  - 凭证通过环境变量注入（`ACCESS_KEY`、`SECRET_KEY`、`PASSPHRASE` 等），并按以下方式拆分 REST helper：
    - `src/api/public-api.ts`：纯函数、无凭证参数，处理所有公共接口。
    - `src/api/private-api.ts`：每个函数显式接收 `credential`，方便多账户/凭证轮转。
  - 使用 `@yuants/cache` 缓存 UID/母账号，统一生成 `vendor/<uid>/<scope>` 的 `account_id`，账户、转账、凭证化 RPC 等场景全部复用。
  - DEX/链上类 vendor 即使只有地址也必须沿用 `vendor/<address>/<scope>` 命名，地址或母账号都可充当 `uid`，确保 copier 能稳定路由。
  - 所有 REST helper 必须写注释说明接口路径和官方文档链接；禁止在 API 中使用 `any`，需要定义明确的请求/响应类型（或使用 `unknown` + 手工解析）。

## 1. 账户快照服务

- **接口：** `provideAccountInfoService`（`@yuants/data-account`）
- **原因：** 做市策略（`apps/trade-copier/src/BBO_MAKER.ts`）、Web UI 与 CLI 巡检都依赖统一账户流，缺失信息会导致仓位失控。
- **要求：**
  - 覆盖 copier 管控的所有账户，字段包含方向、持仓量、可平数量、均价、标记价格、浮盈、权益/可用资金等。
  - 按交易所限速自动刷新（期货建议 ≈1 秒），并处理断线重连。
  - 调用 `addAccountMarket` 注册账户归属市场。

## 2. 挂单列表服务

- **接口：** `providePendingOrdersService`（`@yuants/data-order`）
- **原因：** `trade-copier` 与人工排障都依赖 `queryPendingOrders`，错误数据会导致撤单失灵或爆仓。
- **要求：**
  - 必须调用交易所官方 “未成交订单” 接口（如 `/mix/order/orders-pending`、`/spot/trade/orders-pending`），禁止自行拼装。
  - 用 `encodePath(instType, instId)`（或 `encodePath('SPOT', symbol)`）生成 `product_id`；根据 `side + posSide/tradeSide` 映射为 `OPEN_*` / `CLOSE_*`；补充 `submit_at`、`price`、`traded_volume`。
  - 不同账户（合约/现货等）分别注册服务，刷新频率 ≤5 秒并满足限频。

## 3. 品种目录

- **接口：** `provideQueryProductsService` / SQL writer (`@yuants/data-product`)
- **原因：** copier 需依赖统一的产品元数据限制价格/数量步长、计算保证金、驱动 UI 选择器。
- **实现：** 在 `src/public-data/product.ts` 中调用公共产品接口 → 映射为 `IProduct` → 通过 `createSQLWriter` 写入 `product` 表；至少每小时刷新一次，并保证 `datasource_id` 在系统内一致。

## 4. 公共行情与 Quote 频道

- **目录：** `src/public-data/*`
- **原因：** `trade-copier`、分析作业与 SQL 表都依赖 `quote/{datasource_id}/{product_id}`；脚本散落会造成双写或遗漏。
- **要求：**
  - 将 quote、资金费率、OHLC、market-order 等脚本统一放在 `public-data`（或 `services/markets/*`），由 `index.ts` 引入。
  - Quote 服务无条件发布 `quote/{datasource_id}/{product_id}` Channel；若 `WRITE_QUOTE_TO_SQL` 设为 `1` 或 `true` 则额外写库，否则仅发送 Channel；通道需提供 `last/bid/ask/open_interest/updated_at`，并在未写 SQL 时依旧保持实时 Channel。
  - WebSocket 异常时要降级 REST 轮询并保持时间戳单调。

## 5. 交易 RPC

### 5.1 默认账户 RPC（`order-actions.ts`）

- **原因：** copier 与 CLI 通过固定账户 ID 下单，需确保行为稳定可审计。

- 基于缓存凭证注册 `SubmitOrder`、`CancelOrder`，Schema 限定 `account_id`。
- 使用 `order-utils.ts` 等工具将 `IOrder` 翻译为交易所参数，并记录原始/翻译后的日志。
- 返回 `{ res: { code: 0, message: 'OK', data?: { order_id } } }`，失败时透传交易所错误。

### 5.2 凭证化 RPC（`order-actions-with-credential.ts`）

- **原因：** 多租户/动态账户场景依赖请求级凭证，减少环境变量扩容成本。

- 提供携带 `credential` 的 `SubmitOrder` / `CancelOrder`（及可选 `ModifyOrder` / `ListOrders`），Schema 校验 `account_id` 正则（如 `^vendor/`）并要求 `access_key` / `secret_key` / `passphrase`。
- 每次请求使用调用方提供的凭证，突破环境变量限制，实现任意账户下单。
- 必须通过 `provideOrderActionsWithCredential` 注册服务，统一使用 `credential.type = '<VENDOR>'` + `credential.payload = { ... }` 的协议，以便 `trade-copier` / CLI 在不同 vendor 之间复用同一套凭证路由逻辑；handler 应使用 `@yuants/data-order` 暴露的 `IActionHandlerOfSubmitOrder` / `IActionHandlerOfCancelOrder` / `IActionHandlerOfListOrders` 类型，方便在 `services/orders/*` 中复用具体实现。

## 6. 转账接口（`src/transfer.ts`）

- **原因：** `@yuants/app-transfer-controller` 需要 vendor 执行链上/内部划转并反馈状态，否则调拨链路无法闭环。

- 用 `addAccountTransferAddress` 注册所有 (`account_id`, `network_id`, `currency`, `address`) 组合，供 `@yuants/app-transfer-controller` 规划多跳路线。
- 链上提现需实现 `INIT → PENDING → COMPLETE` 状态机，依赖 `current_tx_context` 记录上下文并在 `onEval` 中返回 `transaction_id` / `received_amount`。
- 覆盖链上提现、spot↔ 合约内部划转、母子账号互转，均复用缓存凭证。

## 7. CLI 与运维约束

- **原因：** 统一的运行方式能减少部署差异，避免调试噪音。

- `src/cli.ts` 仅 `import './index'`。
- 所有模块的 `Terminal` 均来自 `Terminal.fromNodeEnv()`，保证 host/namespace/instance 标记一致。
- 继承现有特性开关（如 `WRITE_QUOTE_TO_SQL`、`DISABLE_TRANSFER`），确保运维一致性。

## 8. 验证步骤

- **原因：** 目前没有一键冒烟，必须手动逐项验证才能保证上线质量。

1. **编译检查：** `npx tsc --noEmit --project apps/vendor-<vendor>/tsconfig.json`。
2. **接口逐项自测：**
   - `QueryAccountInfo` / `useAccountInfo` → 对照交易所后台。
   - `queryPendingOrders(terminal, account_id, true)` → 与交易所未成交列表一致。
   - `QueryProducts`（`force_update: true`）→ 核对步长/保证金等字段。
   - 订阅 `quote/{datasource_id}/{product_id}` → 确保 1Hz 更新且时间戳单调。
   - 运行 `apps/vendor-*/src/e2e/submit-order.e2e.test.ts` 或等效脚本 → 下发与撤销一笔小单，`code = 0` 且挂单列表同步更新。
3. **转账验证：** 对每条 (`account_id`, `network_id`, `currency`, `address`) 组合，借助 Transfer Controller 的演练模式执行 `TransferApply`，观察状态从 `INIT` 走到 `COMPLETE`；随后调用 `TransferEval` 核对 `received_amount` 或 `transaction_id`。

## 9. 推荐目录结构

```
src/
├── api/
│   ├── public-api.ts               # 无需认证的 REST 函数
│   └── private-api.ts              # 需认证的 REST 函数
├── services/
│   ├── legacy.ts                   # 默认账户：account/pending/Submit/Cancel
│   ├── account-actions-with-credential.ts
│   ├── order-actions-with-credential.ts
│   ├── orders/
│   │   ├── submitOrder.ts
│   │   ├── cancelOrder.ts
│   │   └── listOrders.ts
│   ├── markets/
│   │   ├── product.ts
│   │   ├── quote.ts
│   │   └── interest-rate.ts
│   └── transfer.ts
├── index.ts                        # 仅 `import './services/...';`
└── e2e/                            # Submit/Cancel 或转账验证脚本
```

> 旧项目若仍在 `account.ts` / `public-data/*` 结构，可逐步迁移到 `services/*`，降低耦合并统一与 vendor-aster 等新实现的做法。

## 10. 参考实现

- **`apps/vendor-okx`**：完整展示模块化架构、凭证化 RPC、缓存体系与 `public-data/*` 工程化写法。
- **`apps/vendor-bitget`**：近期重构版本，演示如何落地 public/private API 分层、`public-data` 目录以及多账户挂单服务。

按上述结构开发，可显著减少评审与反复沟通成本。
