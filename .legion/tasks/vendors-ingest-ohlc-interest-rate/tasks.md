# vendors-ingest-ohlc-interest-rate - 任务清单

## 快速恢复

**当前阶段**: 阶段 4 - 验证
**当前任务**: 本地做最小验证：TypeScript typecheck/build；并用脚本/小段调用验证服务注册的 schema 可被 `parseOHLCServiceMetadataFromSchema`/`parseInterestRateServiceMetadataFromSchema` 正确解析（至少覆盖一个 vendor 的典型 schema）。
**进度**: 5/6 任务完成

---

## 阶段 1: 调研 🟡 IN PROGRESS

- [x] 阅读并总结 `yuantsexchange-ohlcinterestrate` 的接口约定，并对照代码确认 `provideOHLCService` / `provideInterestRateService` 的 request/metadata/schema 细节（time+direction、duration enum、product_id_prefix pattern、range 计算与写库表）。 | 验收: 在 task `context.md` 写清：两个 service 的 schema/metadata 字段含义、series_id 编码规则、以及 vendor 实现时需要满足的输入输出约束。
- [x] 逐个 vendor（ASTER/BINANCE/BITGET/GATE/HTX/HYPERLIQUID/OKX）盘点现有历史数据实现与可复用函数：已存在的 duration 映射、分页方式（time/endTime/startTime/page/one-page）、以及当前 product_id 编码约定。 | 验收: 在 `context.md` 记录每个 vendor：OHLC/InterestRate 是否已有 API wrapper、可复用的映射表、推荐的 direction（forward/backward）、以及需要补齐的缺口。

---

## 阶段 2: 设计 🟡 IN PROGRESS

- [x] 为每个 vendor 输出一份“能力矩阵”：要注册哪些 `provideOHLCService`/`provideInterestRateService`（按 product_id_prefix 划分），各自 `direction` 选择、OHLC 的 `duration_list`、以及 `fetchPage` 如何把 `time` 映射到交易所参数（after/endTime/startTime/cursor）。 | 验收: 在 `context.md` 给出最终矩阵与关键决策（包含 page-only/one-page 的处理策略），并列出每个 vendor 预计新增/修改的文件清单。

---

## 阶段 3: 实现 🟡 IN PROGRESS

- [x] 在各 vendor 的 `src/services/` 新增 `ohlc-service.ts` 与 `interest-rate-service.ts`，参考 `quotes.ts` 的结构注册服务，并用 vendor API 实现 `fetchPage`（含 duration 映射、decodePath(product_id) 路由、limit/time/direction 参数处理）。 | 验收: 每个 vendor 启动后能注册对应的 `IngestOHLC`/`IngestInterestRate` 服务；schema 的 `product_id` pattern、OHLC `duration` enum、`direction const` 与设计一致。
- [x] 对缺失的交易所接口 wrapper（如 ASTER/GATE/HTX 的 OHLC 端点或缺少的参数）补齐 `src/api/*`，并复用仓库现有 http-client/rate-limiter 模式。 | 验收: `fetchPage` 不再包含临时代码/硬编码 URL；API wrapper 有类型定义且可复用。

---

## 阶段 4: 验证 🟡 IN PROGRESS

- [ ] 本地做最小验证：TypeScript typecheck/build；并用脚本/小段调用验证服务注册的 schema 可被 `parseOHLCServiceMetadataFromSchema`/`parseInterestRateServiceMetadataFromSchema` 正确解析（至少覆盖一个 vendor 的典型 schema）。 | 验收: `pnpm/rush` 的 typecheck/build 通过；记录一份“如何手工验证服务注册”的步骤到 `context.md` 快速交接。 ← CURRENT

---

## 发现的新任务

(暂无)

- [ ] 补齐缺失/不正确的 OHLC ingest：ASTER/Bitget/HTX/Hyperliquid 增加 SPOT OHLC；修正 Gate candlesticks API 返回类型与解析，确保与官方文档一致。 | 来源: 用户 review（2025-12-20）

---

_最后更新: 2025-12-20 15:01_
