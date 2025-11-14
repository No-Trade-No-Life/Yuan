# @yuants/vendor-bitget

Bitget 交易所适配包，参考 OKX 的模块化架构：缓存账户信息、拆分 `public-data` 行情脚本、同时提供单账户 & 凭证化下单接口，并内建转账状态机。

## 亮点

- **账户核心**：`src/account.ts` 通过 `@yuants/cache` 缓存 UID/母账号信息，发布 USDT 合约和现货账户快照，并用 `/api/v2/mix/order/orders-pending` 驱动 `providePendingOrdersService`。
- **交易 RPC**：`src/order-actions.ts` 保留旧式单账号 `SubmitOrder`/`CancelOrder`；`src/order-actions-with-credential.ts` 引入 `account_id` 正则与 `credential` Schema，可让调用方在每次请求传入任意 API key。
- **行情模块**：`src/public-data/*` 负责产品、报价、资金费率等，统一写入 SQL，与实现清单中要求的目录结构保持一致。
- **转账能力**：`src/transfer.ts` 注册 TRC20 链上提现、现货 ↔USDT 合约内部划转、母子账户互转，方便 `@yuants/transfer` 控制器编排多跳资金流。

更多运行细节、目录示意见 `apps/vendor-bitget/README.md`。
