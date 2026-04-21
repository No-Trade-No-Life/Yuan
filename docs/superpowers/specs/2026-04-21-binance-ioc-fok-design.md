# BINANCE IOC/FOK Design

## 背景

Yuan 的 `IOrder.order_type` 已定义 `IOC` 与 `FOK` 语义，但 `apps/vendor-binance` 当前下单链路只支持 `LIMIT`、`MARKET` 和 `MAKER`，并且订单回读只根据 Binance `type` 映射 `LIMIT|MARKET`，忽略 `timeInForce`。这会导致通过 Binance vendor 提交 `IOC` / `FOK` 订单时在本地映射阶段直接报错，同时交易所返回的 `LIMIT + IOC/FOK/GTX` 订单也会被回填成普通 `LIMIT`，提交与查询语义不一致。

本次改动只推进 `apps/vendor-binance`，范围限定为 `SPOT + USDT-FUTURE` 的下单提交与订单回读语义闭环，不引入 Binance 专属扩展字段，也不顺手扩大到改单能力。

## 目标

- 在 `apps/vendor-binance` 中支持使用 `IOrder.order_type = 'IOC' | 'FOK'` 提交 `SPOT` 与 `USDT-FUTURE` 订单。
- 在 Binance 订单回读链路中，根据 `type + timeInForce` 将订单映射回 `IOC | FOK | MAKER | LIMIT | MARKET`。
- 保持现有 `LIMIT` / `MARKET` / `MAKER` 行为不变。
- 采用最小改动，避免扩大到跨 vendor 重构或改单增强。

## 非目标

- 不改动其他 vendor 的下单或订单查询逻辑。
- 不新增 `IOrder` 的 Binance 专属字段。
- 不扩展 `modifyOrder.ts` 去支持修改为 `IOC/FOK`。
- 不改动与 IOC/FOK 无关的订单状态、方向映射、数量换算和成交补录逻辑。

## 方案比较

### 方案 A：仅补 submitOrder 的 `timeInForce`

直接在 `submitOrder.ts` 里为 `IOC/FOK` 补 `timeInForce`，不处理订单回读。

优点：

- 改动最小。

缺点：

- 订单查询仍无法识别 `IOC/FOK`，语义不闭环。
- 不符合本次已确认的范围。

### 方案 B：补 submitOrder + 回读映射，modifyOrder 保持不动

在 `apps/vendor-binance/src/services/orders/` 内统一补齐下单与回读映射，让 `IOrder.order_type` 与 Binance `type + timeInForce` 双向一致。

优点：

- 范围刚好覆盖本次需求。
- 改动集中，风险与验证范围清晰。
- 与 `vendor-okx` 的 IOC/FOK 推进方式一致，便于后续维护。

缺点：

- 若后续需要改单支持 `IOC/FOK`，还需单独补一轮。

### 方案 C：连 modifyOrder 一起补齐

把 spot cancel-replace 与 futures amend 一起补上 `IOC/FOK`。

优点：

- 能力更完整。

缺点：

- 会把边界扩大到不同接口的改单语义差异。
- 测试与回归面明显增大，不适合这次“小步提交”的目标。

## 最终方案

采用方案 B，只在 `apps/vendor-binance/src/services/orders/` 内补齐 `IOC/FOK` 的下单与回读语义，不改 `modifyOrder.ts`。

## 影响文件

- `apps/vendor-binance/src/services/orders/order-utils.ts`
  - 扩展 `mapOrderTypeToOrdType`，让 `IOC/FOK` 与现有 `LIMIT/MAKER` 一样映射到 Binance `LIMIT`。
  - 新增独立的 `mapOrderTypeToTimeInForce`，统一处理 `LIMIT -> GTC`、`MAKER -> GTX`、`IOC -> IOC`、`FOK -> FOK`。
  - 扩展回读映射函数，使其基于 `type + timeInForce` 还原 Yuan `order_type`。
- `apps/vendor-binance/src/services/orders/submitOrder.ts`
  - `SPOT` 与 `USDT-FUTURE` 下单都接入新的 `timeInForce` 映射。
  - 保持 `IOC/FOK` 继续走 Binance `type='LIMIT'` 的路径。
- `apps/vendor-binance/src/services/orders/listOrders.ts`
  - 回读时从只看 `order.type` 改为同时看 `order.type` 与 `order.timeInForce`，统一映射 `MAKER/IOC/FOK`。
- `apps/vendor-binance/src/services/orders/modifyOrder.ts`
  - 不改动逻辑，仅明确本次不处理改单。
- `apps/vendor-binance/src/services/orders/**/*.test.ts`
  - 新增最小测试文件，覆盖纯映射与关键下单/回读链路。
- `apps/vendor-binance/docs/context/SESSION_NOTES.md`
  - 记录本次设计、实现、测试与后续 TODO。
- `docs/zh-Hans/vendor-supporting.md`
  - 若能力表已有下单模式条目，则同步补充 Binance IOC/FOK 支持说明。

## 详细设计

### 1. 下单映射

Binance 的 `IOC/FOK` 不是独立的 `type`，而是 `type='LIMIT'` 配合不同 `timeInForce`。因此本次不把 `IOC/FOK` 映射成新的 Binance `type`，而是延续 `LIMIT` 下单路径：

- `LIMIT -> type='LIMIT', timeInForce='GTC'`
- `MAKER -> type='LIMIT', timeInForce='GTX'`
- `IOC -> type='LIMIT', timeInForce='IOC'`
- `FOK -> type='LIMIT', timeInForce='FOK'`
- `MARKET -> type='MARKET', timeInForce=undefined`

这意味着 `IOC/FOK` 与 `LIMIT/MAKER` 一样都属于“带价格的限价单”分支：

- `SPOT` 订单在 `type === 'LIMIT'` 时继续要求 `price`
- `USDT-FUTURE` 订单沿用现有 `price` 直接透传逻辑，不新增数量或 reduceOnly 分支

本次不借机重写 spot/futures 的数量字段逻辑，因为 IOC/FOK 只影响成交时效，不影响数量语义。

### 2. 订单回读映射

当前 `listOrders.ts` 只根据 Binance `order.type` 判断 `LIMIT|MARKET`，会把 `GTX/IOC/FOK` 都误判成 `LIMIT`。本次改为统一使用 `type + timeInForce` 的组合映射：

- `MARKET -> MARKET`
- `LIMIT + GTX -> MAKER`
- `LIMIT + IOC -> IOC`
- `LIMIT + FOK -> FOK`
- `LIMIT + 其他值或缺省 -> LIMIT`
- 未知 `type` 继续保守回退为 `LIMIT`

这里保留“未知 `type` 回退为 `LIMIT`”而不是改成 `UNKNOWN`，是为了延续 `vendor-binance` 当前行为，避免把这次需求扩展成一次更广的回读语义调整。

### 3. 改单边界

`modifyOrder.ts` 当前 spot 通过 cancel-replace、futures 通过 amend 修改价格或数量，但没有处理“改单切换成交时效”的明确语义。Binance 不同产品的改单接口约束也不完全一致。本次明确不扩展 `modifyOrder.ts`，避免把需求从“支持 IOC/FOK 下单与回读”膨胀成“支持 IOC/FOK 改单”。

### 4. 测试策略

遵循 TDD，优先补最小失败测试，再补实现：

- 一个测试覆盖 `IOC/FOK` 的下单类型映射：`mapOrderTypeToOrdType('IOC'|'FOK') -> 'LIMIT'`
- 一个测试覆盖 `mapOrderTypeToTimeInForce` 的四种限价语义：`GTC/GTX/IOC/FOK`
- 一个测试覆盖 `type + timeInForce` 的回读映射：`MARKET`、`LIMIT+GTC`、`LIMIT+GTX`、`LIMIT+IOC`、`LIMIT+FOK`
- 一个最小下单链路测试，验证 `submitOrder` 对 `SPOT` 与 `USDT-FUTURE` 提交 `IOC/FOK` 时会带上正确的 `timeInForce`
- 一个最小回读测试，验证 `listOrders` 在收到不同 `timeInForce` 时会映射出正确的 `order_type`

由于 `vendor-binance` 当前没有成体系测试基建，本次优先用轻量单测锁定映射和参数构造，不搭建额外集成测试脚手架。

## 错误处理

- 若调用方传入未知 `order_type`，仍保持显式抛错，避免错误地下发成 Binance `LIMIT`。
- 若 Binance 返回未知 `timeInForce`，在 `type='LIMIT'` 场景下仍保守映射为 `LIMIT`。
- 若 Binance 返回未知 `type`，继续维持现有保守回退行为，不在本次引入新的兼容策略变化。

## 验证策略

- 先运行新增测试，确认先失败再通过。
- 运行 `npx tsc --noEmit --project apps/vendor-binance/tsconfig.json` 做包级类型检查。
- 如仓库已有与本次无关的基线失败，需在 `SESSION_NOTES.md` 中记录并在最终汇报中说明。

## 提交策略

- 提交 1：补失败测试与 `order-utils` 共享映射。
- 提交 2：接入 `submitOrder` 的 `SPOT + USDT-FUTURE` IOC/FOK 下单。
- 提交 3：接入 `listOrders` 回读映射，补文档、change file、验证结果。

每个提交都保持自洽，可单独审阅。
