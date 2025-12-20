# vendors-ingest-ohlc-interest-rate - 上下文

## 会话进展 (2025-12-20)

### ✅ 已完成

- 已对照 `yuantsexchange-ohlcinterestrate`：确认 `provideOHLCService`/`provideInterestRateService` 的 request/schema/metadata/写库语义与 `series_data_range` 记录方式
- 已盘点目标 vendors 的现状：定位可复用的 duration 映射与历史拉取实现位置，并标注主要分页形态（time-based / startTime-based / page-only / one-page）
- 已按反馈把 `plan.md` 扩写为可直接落代码的详细设计（包含接口语义回顾、每个 vendor 的能力矩阵与 fetchPage 映射、入口接线方式、以及 page-only/one-page 的三种处理方案）
- 已逐条回复并关闭你在 `plan.md` 的全部 review（共 6 条），并把决策落到正文设计里（新增 `2.4 page-only 按 time 定位页码` 适配层、固定 BITGET/HTX/GATE 策略、更新分批实现顺序）。
- 已为 7 个 vendor 新增 ingest 服务：在各自 `src/services/` 增加 `ohlc-service.ts` + `interest-rate-service.ts`，并在 `src/index.ts` 接线 import
- 已补齐/扩展缺失 API wrapper：ASTER 增加 `getFApiV1Klines`；HTX 增加 `getSwapHistoryKline`；GATE 扩展 `getFutureFundingRate` 支持 `from/to/offset` 并新增 `getFuturesCandlesticks`/`getSpotCandlesticks`
- 已落地 page-only 的 time->page 适配：BITGET/HTX 的 InterestRate ingest 在 vendor 侧用指数探测+二分查找定位页码（HTX 利用 `total_page` 直接二分）
- 已同步你对 `@yuants/exchange` 的 breaking change：`time` 改为毫秒级 `number`，并修正 `@yuants/exchange` 的 service schema（`time: { type: 'number' }`）
- 已修正所有已落盘的 vendor ingest 实现：移除 `Date.parse(req.time)`，改用 `req.time` 直接作为 ms（含 page-only 二分定位与所有 to/from 秒级参数换算）
- 已同步更新本 task `plan.md` 的接口说明与实现映射（`time` 不再是 `date-time`）
- 同步更新 `.legion/tasks/yuantsexchange-ohlcinterestrate/plan.md`：`time` 改为毫秒级 `number`，并把调度推进规则改为 `Date.parse(range.start_time/end_time)` 产出下一页的 ms。
- 补齐缺失的 SPOT OHLC ingest：ASTER/SPOT、BITGET/SPOT、HTX/SPOT、HYPERLIQUID/SPOT（Hyperliquid spot/perp 共用 candle snapshot）。
- 按 Gate 官方文档修正 candlesticks API wrapper 返回类型（futures=object，spot=tuple），并同步调整 OHLC 映射逻辑与文档。
- 修复 `apps/vendor-aster/src/api/public-api.ts` 的类型约束导致的编译错误：`createApi` 泛型约束为 `Record<string, unknown>` 并把无参请求的 `TReq` 改为 `Record<string, never>`；本地 `tsc --noEmit` 通过。

### 🟡 进行中

- 仍需你在具备工具链环境跑 build/typecheck 验证（本容器缺少 pnpm/rush）

### ⚠️ 阻塞/待定

- 当前容器无 `pnpm`/`rush`（且安装需要网络），无法在此环境完成 typecheck/build 验证

---

## 关键文件

(暂无)

---

## 关键决策

| 决策                                                                                                | 原因                                                                                                                             | 替代方案                                                        | 日期 |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---- |
| 初版能力矩阵（待 review）：按 vendor 注册 `IngestOHLC`/`IngestInterestRate` 的 prefix/方向/分页映射 | 先把“能直接按 time 翻页的部分”落到统一 ingest contract；对 page-only/one-page 的部分先做显式取舍，避免实现阶段边写边改接口语义。 | 1) 强行把 page-only/one-page 交易所桥接到 time（扫描/估算页码） |

2. 暂不接入这些 vendor 的 InterestRate ingest，等 VEX 支持 page cursor 再补
3. 在 vendor 侧额外引入自定义 cursor 字段（会破坏 `@yuants/exchange` 已收敛的 schema） | 2025-12-20 |
   | 能力矩阵草案（按 quotes 的 product_id 约定；具体实现待 review）：

- OKX
  - OHLC: prefix `OKX/SWAP/` + `OKX/SPOT/` (+ `OKX/MARGIN/` 可选)，direction=backward，time=>`after/endTime`，duration_list=OKX bar 映射 keys
  - InterestRate: prefix `OKX/SWAP/` + `OKX/MARGIN/`，direction=backward，time=>`after`
- BINANCE
  - OHLC: prefix `BINANCE/USDT-FUTURE/` + `BINANCE/SPOT/` + `BINANCE/MARGIN/`，direction=backward，time=>`endTime`，duration_list=BINANCE interval keys（实现时需统一 instType 大小写）
  - InterestRate: prefix `BINANCE/USDT-FUTURE/` + `BINANCE/MARGIN/`，倾向 direction=forward（time=>`startTime`；现实现也是从 startTime 推进）
- BITGET
  - OHLC: prefix `BITGET/USDT-FUTURES/` + `BITGET/COIN-FUTURES/`，direction=backward，time=>`endTime`，duration_list=Bitget granularity 映射 keys
  - InterestRate: USDT-FUTURES/HTX 类似为 page-only（需决策：桥接 or 暂不接入）；SPOT 仅当前借贷利率（非历史）
- HYPERLIQUID
  - OHLC: prefix `HYPERLIQUID/PERPETUAL/`，direction=backward，time=>`endTime`，通过 `startTime = endTime - window` 控制一页大小，duration_list=HYPERLIQUID interval keys
  - InterestRate: prefix `HYPERLIQUID/PERPETUAL/`，可做 direction=backward 或 forward（均为 time-range 调用）
- ASTER
  - InterestRate: prefix `ASTER/PERP/`，direction=forward，time=>`startTime`
  - OHLC: 目前未发现 wrapper（需补齐端点与 duration 映射）
- GATE
  - InterestRate: prefix `GATE/FUTURE/` 当前为 one-page（需确认是否支持按 time 翻页参数）
  - OHLC: 目前未发现 wrapper
- HTX
  - InterestRate: prefix `HTX/SWAP/` 为 page-only
  - OHLC: 目前未发现 wrapper | 把“无需改动 contract 就能接入”的范围先列出来，review 后再决定缺口（page-only/one-page/缺 OHLC 端点）怎么补。 | 把缺口延后：先只接 OKX/BINANCE/BITGET-OHLC/HYPERLIQUID，等后续再扩展到 GATE/ASTER/HTX | 2025-12-20 |
    | 已按 review 固化实现策略：page-only/one-page 全部接入 ingest contract；page-only（BITGET/HTX 等）用指数探测+二分查找按 `time` 定位页码；direction 不统一；保留旧链路且暂不处理旧 `createSeriesProvider` 的 series_id 编码差异。 | 满足你对“必须接入 + 可调度 + 可逐步切换”的要求，同时不在 vendor 侧引入对 VEX 切换进度的强依赖。 | 1) page-only 暂不接入或只抓最新页（会卡住 backfill）

2. 强制统一 direction（会增加部分交易所实现不确定性）
3. 同步改旧链路 series_id（切换成本高且易引入误判） | 2025-12-20 |

---

## 快速交接

**下次继续从这里开始：**

1. 在具备工具链环境执行（任选其一）：`pnpm -w --filter @yuants/vendor-bitget build` / `pnpm -w --filter @yuants/vendor-okx build` / `pnpm -w --filter @yuants/vendor-binance build` / `pnpm -w --filter @yuants/vendor-huobi build` / `pnpm -w --filter @yuants/vendor-gate build` / `pnpm -w --filter @yuants/vendor-aster build` / `pnpm -w --filter @yuants/vendor-hyperliquid build`（或 rush/heft 等价命令）
2. 若 build 通过，再分别 `pnpm -w --filter @yuants/vendor-xxx dev` 启动并确认服务注册（`IngestOHLC`/`IngestInterestRate`）
3. 确认无误后我再继续：补充一个最小“schema 解析自检”脚本（调用 `parseOHLCServiceMetadataFromSchema`/`parseInterestRateServiceMetadataFromSchema`）或按你现有验证方式接入 CI

**注意事项：**

- 主要新增文件：各 vendor 的 `src/services/ohlc-service.ts`、`src/services/interest-rate-service.ts`，以及对应 `src/index.ts` 的 import 接线。
- 新增/扩展 API：`apps/vendor-aster/src/api/public-api.ts`（klines）、`apps/vendor-huobi/src/api/public-api.ts`（swap kline）、`apps/vendor-gate/src/api/public-api.ts`（funding from/to + candlesticks）。

---

_最后更新: 2025-12-20 15:02 by Claude_
