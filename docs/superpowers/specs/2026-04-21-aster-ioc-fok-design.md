# ASTER IOC/FOK Design

## 背景

Yuan 的 `IOrder.order_type` 已定义 `IOC` 与 `FOK` 语义，但 `apps/vendor-aster` 当前下单链路只支持 `LIMIT`、`MARKET` 和 `MAKER`。虽然 Aster API 层已经接受 `timeInForce='IOC'|'FOK'`，当前 `services/orders/submitOrder.ts` 仍只把 `LIMIT` 映射为 `GTC`、把 `MAKER` 映射为 `GTX`，导致传入 `IOC/FOK` 时会在本地映射阶段直接报 `Unsupported order_type`。与此同时，`services/orders/listOrders.ts` 当前直接把交易所返回的 `order.type` 回填到 Yuan `order_type`，会把 `LIMIT + IOC/FOK/GTX` 都误判成普通 `LIMIT`，提交与查询语义不一致。

本次改动只推进 `apps/vendor-aster`，范围限定为 `SPOT + PERP` 的下单提交与订单回读语义闭环，不引入 Aster 专属扩展字段，也不顺手扩大到改单能力。

## 目标

- 在 `apps/vendor-aster` 中支持使用 `IOrder.order_type = 'IOC' | 'FOK'` 提交 `SPOT` 与 `PERP` 订单。
- 在 Aster 订单回读链路中，根据 `type + timeInForce` 将订单映射回 `IOC | FOK | MAKER | LIMIT | MARKET`。
- 保持现有 `LIMIT` / `MARKET` / `MAKER` 行为不变。
- 采用最小改动，避免扩大到跨 vendor 重构或改单增强。

## 非目标

- 不改动其他 vendor 的下单或订单查询逻辑。
- 不新增 `IOrder` 的 Aster 专属字段。
- 不扩展 `cancelOrder.ts` 或未来的改单能力。
- 不改动与 IOC/FOK 无关的订单状态、方向映射、数量换算和成交补录逻辑。

## 方案比较

### 方案 A：仅补 submitOrder 的 `timeInForce`

直接在 `submitOrder.ts` 里为 `IOC/FOK` 补 `timeInForce`，不处理订单回读。

优点：

- 改动最小。

缺点：

- 订单查询仍无法识别 `IOC/FOK`，语义不闭环。
- 不符合本次已确认的范围。

### 方案 B：补 submitOrder + 回读映射，其他链路保持不动

在 `apps/vendor-aster/src/services/orders/` 内统一补齐下单与回读映射，让 `IOrder.order_type` 与 Aster `type + timeInForce` 双向一致。

优点：

- 范围刚好覆盖本次需求。
- 改动集中，风险与验证范围清晰。
- 可直接参考 `vendor-binance` 的 IOC/FOK 语义，跨 vendor 行为更一致。

缺点：

- 若后续需要改单支持 `IOC/FOK`，还需单独补一轮。

### 方案 C：抽 Aster 专用 `order-utils.ts`

顺手把 submit/list 的映射逻辑收口到新的工具文件，再一起补 IOC/FOK。

优点：

- 结构更规整，后续如果 Aster 再补改单会更容易复用。

缺点：

- 为一个较小需求引入额外文件，收益有限。
- 会让本次 PR 讨论点从“补能力”扩大到“重组结构”。

## 最终方案

采用方案 B，只在 `apps/vendor-aster/src/services/orders/` 内补齐 `IOC/FOK` 的下单与回读语义，不新建共享工具文件，不改其他订单链路。

## 影响文件

- `apps/vendor-aster/src/services/orders/submitOrder.ts`
  - 扩展 Spot 与 Perp 的 `order_type` 映射，让 `IOC/FOK` 与现有 `LIMIT/MAKER` 一样走 Aster `type='LIMIT'`。
  - 把 `timeInForce` 映射从 `LIMIT -> GTC`、`MAKER -> GTX` 扩展为 `LIMIT -> GTC`、`MAKER -> GTX`、`IOC -> IOC`、`FOK -> FOK`。
- `apps/vendor-aster/src/services/orders/listOrders.ts`
  - 回读时不再直接把 `order.type` 填给 Yuan `order_type`，而是改为根据 `type + timeInForce` 恢复 `MAKER/IOC/FOK/LIMIT/MARKET`。
- `apps/vendor-aster/src/services/orders/*.test.ts`
  - 新增最小测试文件，覆盖纯映射与关键下单/回读链路。
- `apps/vendor-aster/SESSION_NOTES.md`
  - 记录本次设计、实现、测试与后续 TODO。
- `docs/zh-Hans/vendor-supporting.md`
  - 同步补充 Aster Spot/Perp 下单当前支持 `LIMIT`、`MARKET`、`MAKER`、`IOC`、`FOK`，其中 `IOC/FOK` 通过 `LIMIT + timeInForce` 实现。
- `common/changes/`
  - 为 `@yuants/vendor-aster` 生成 change file。

## 详细设计

### 1. 下单映射

Aster 的 `IOC/FOK` 不是独立的 `type`，而是 `type='LIMIT'` 配合不同 `timeInForce`。因此本次不把 `IOC/FOK` 映射成新的 Aster `type`，而是延续现有 `LIMIT` 下单路径：

- `LIMIT -> type='LIMIT', timeInForce='GTC'`
- `MAKER -> type='LIMIT', timeInForce='GTX'`
- `IOC -> type='LIMIT', timeInForce='IOC'`
- `FOK -> type='LIMIT', timeInForce='FOK'`
- `MARKET -> type='MARKET', timeInForce=undefined`

这意味着 `IOC/FOK` 与 `LIMIT/MAKER` 一样都属于“带价格的限价单”分支：

- `SPOT` 订单沿用现有 `price` 直接透传逻辑，市价买单的 `quoteOrderQty` 逻辑不变。
- `PERP` 订单沿用现有 `quantity`、`price`、`reduceOnly`、`positionSide` 分支，不新增额外字段。

本次不借机重写 Spot/Perp 的数量字段逻辑，因为 IOC/FOK 只影响成交时效，不影响数量语义。

### 2. 订单回读映射

当前 `listOrders.ts` 直接把 Aster `order.type` 回填成 Yuan `order_type`，会把 `GTX/IOC/FOK` 都误判成 `LIMIT`。本次改为统一使用 `type + timeInForce` 的组合映射：

- `MARKET -> MARKET`
- `LIMIT + GTX -> MAKER`
- `LIMIT + IOC -> IOC`
- `LIMIT + FOK -> FOK`
- `LIMIT + 其他值或缺省 -> LIMIT`
- 未知 `type` 继续保守回退为 `LIMIT`

这里保留“未知 `type` 回退为 `LIMIT`”而不是改成 `UNKNOWN`，是为了延续 `vendor-aster` 当前保守行为，避免把这次需求扩展成一次更广的回读语义调整。

### 3. 错误处理边界

`submitOrder.ts` 继续沿用现有风格：

- 若调用方传入未知 `order_type`，仍显式抛 `Unsupported order_type`。
- `IOC/FOK` 沿用限价单语义，不额外增加新的参数校验分支。
- `listOrders.ts` 遇到未知 `type/timeInForce` 组合时保守回落，优先避免误判为新的 Yuan 类型。

本次不额外改变 Aster API 层的错误处理方式，也不引入 vendor 专属异常码。

### 4. 测试策略

遵循 TDD，优先补最小失败测试，再补实现：

- 一个测试覆盖 Spot 下单时 `IOC/FOK` 的参数映射：`type='LIMIT'` 且 `timeInForce='IOC'|'FOK'`
- 一个测试覆盖 Perp 下单时 `IOC/FOK` 的参数映射：`type='LIMIT'` 且 `timeInForce='IOC'|'FOK'`
- 一个测试覆盖回读映射：`MARKET`、`LIMIT+GTC`、`LIMIT+GTX`、`LIMIT+IOC`、`LIMIT+FOK`
- 保持现有 `LIMIT/MARKET/MAKER` 行为不回归

由于 `vendor-aster` 当前订单侧测试较少，本次优先用轻量单测锁定映射和参数构造，不额外搭建新的集成测试脚手架。

## 验证策略

- 先运行新增测试，确认先失败再通过。
- 运行 `npx tsc --noEmit --project apps/vendor-aster/tsconfig.json` 做包级类型检查。
- 如本地存在与本次无关的基线失败，需在 `SESSION_NOTES.md` 中记录并在最终汇报中说明。

## 提交策略

- 提交 1：补失败测试与 IOC/FOK 映射实现。
- 提交 2：补文档、change file、验证结果。

如实现过程中发现测试拆分自然形成 3 个独立提交，也允许细分，但每个提交都必须保持自洽、可单独审阅。
