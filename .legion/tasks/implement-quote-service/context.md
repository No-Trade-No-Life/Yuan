# implement-quote-service - 上下文

## 当前会话的临时指令（必须遵守）

- 用户要求：先完成梳理 → 更新 LegionMind 文档 → 等用户确认后再继续写代码（后续实现阶段会以“先写文档/等确认”的节奏推进）。

---

## 会话进展 (2025-12-14)

### ✅ 已完成（事实）

- 已阅读 `provideQuoteService` / `GetQuotes` 的契约实现，确认：
  - `product_ids` 受 `product_id_prefix` 正则前缀约束；
  - `fields` 在 schema 中是 `const = metadata.fields.sort()`；
  - 返回结构为 `IQuoteUpdateAction`，字段值为 string，`updated_at` 为毫秒时间戳。
- 已对照 `apps/vendor-gate/src/services/quotes.ts` 抽取落地模板：按 prefix 拆分多个 `provideQuoteService`，`requestFunc` 内调用 public API 并按 `req.product_ids` 过滤。
- 已完成“分 vendor 方案设计”（详见 `plan.md` 的「分 vendor 设计」）。
- 已按你的建议落地实现：**每个上游 API 调用对应一个 `provideQuoteService`，不在 `requestFunc` 内做 join**。
- 已补齐所有目标 vendor 的 `GetQuotes`，并在各自 `src/index.ts` 导入 `./services/quotes` 确保注册生效。
- 已完成最小类型检查（TypeScript）并通过（详见下方“验证记录”）。

### 🟡 进行中（事实 + 状态）

(暂无)

### ⚠️ 阻塞/待定（需要你确认/或我补充验证）

(暂无)

---

## 接口契约摘要（方便你快速 review）

- 契约文件：
  - `libraries/exchange/src/quote.ts`
  - `libraries/exchange/src/types.ts`
- `provideQuoteService` 的关键约束：
  - 以 `metadata.product_id_prefix` 限定 `product_ids`；
  - `metadata.fields` 会成为请求 schema 的 `const`，因此“声明了就要能稳定提供”；
  - `requestFunc` 返回值是数组：每条必须含 `product_id` 与 `updated_at(ms)`，其余字段为 string 或 undefined。
- 对外 product_id 约定（本任务统一）：
  - `encodePath(<DATASOURCE>, <INST_TYPE>, <INST_ID>)`
  - `metadata.product_id_prefix` 需要与该路径的字符串前缀一致（末尾含 `/`）。

---

## 关键文件（实现/评审入口）

- `libraries/exchange/src/quote.ts`：`provideQuoteService` 的 schema 与 response 映射逻辑（对照“字段值只要非 undefined 就会写入 action”）
- `libraries/exchange/src/types.ts`：`IQuoteField` 排除了 `product_id/datasource_id/updated_at`（避免在 fields 里声明这些字段）
- `apps/vendor-gate/src/services/quotes.ts`：本仓库唯一现成的 `provideQuoteService` 参考实现（应作为模板对照）
- 已新增/修改（本次落地的实现入口）：
  - `apps/vendor-okx/src/services/quotes.ts` / `apps/vendor-okx/src/index.ts`
  - `apps/vendor-binance/src/services/quotes.ts` / `apps/vendor-binance/src/index.ts`
  - `apps/vendor-aster/src/services/quotes.ts` / `apps/vendor-aster/src/index.ts`
  - `apps/vendor-hyperliquid/src/services/quotes.ts` / `apps/vendor-hyperliquid/src/index.ts`
  - `apps/vendor-bitget/src/services/quotes.ts` / `apps/vendor-bitget/src/index.ts`
  - `apps/vendor-huobi/src/services/quotes.ts` / `apps/vendor-huobi/src/index.ts`

---

## 关键决策（Decision Log）

| 编号 | 决策                                                                                   | 原因                                                     | 替代方案                                               | 日期       |
| ---- | -------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ | ---------- |
| D1   | 统一对外 product_id 使用 `encodePath(<DATASOURCE>, <INST_TYPE>, <INST_ID>)`            | 与 gate 示例一致，便于上游用统一前缀路由                 | 沿用部分 vendor 内部的 `product_id`（不含 datasource） | 2025-12-14 |
| D2   | `provideQuoteService` 按 prefix 拆分多个实例（而不是一个 service 支持所有 product_id） | schema 能强约束 product_id 前缀与字段集合，review 更清晰 | 单实例 + 内部分支判断 prefix                           | 2025-12-14 |
| D3   | 字段集合按“能稳定提供”声明，缺失字段不强行补齐                                         | 避免 schema 声明后无法满足、导致上游依赖错误口径         | 声明大而全字段并用 `'0'`/空值填充                      | 2025-12-14 |
| D4   | 每个上游 API 调用对应一个 `provideQuoteService`，不做 join                             | 降低实现复杂度与时序风险；更利于 review 与回滚           | 单 service 内 join 多个 API 一次返回所有字段           | 2025-12-14 |

---

## 风险点 / 易踩坑（Gotchas）

- `fields` 是 schema const：一旦声明了某字段，上游会默认“该字段可用”。因此宁可少声明，也不要为了“看起来完整”瞎加字段。
- `updated_at` 必须是 number（ms）。部分 vendor 现有行情链路把 `updated_at` 作为 ISO string（例如 Hyperliquid 的 markets/quote.ts），但 `GetQuotes` 必须返回 ms number。
- `encodePath` 入参顺序要一致：`encodePath(DATASOURCE, INST_TYPE, INST_ID)`，同时 `product_id_prefix` 末尾必须有 `/`。

---

## 验证记录（本次会话）

- TypeScript：
  - `common/temp/node_modules/.bin/tsc --noEmit --project apps/vendor-bitget/tsconfig.json` ✅
  - `common/temp/node_modules/.bin/tsc --noEmit --project apps/vendor-hyperliquid/tsconfig.json` ✅
  - `common/temp/node_modules/.bin/tsc --noEmit --project apps/vendor-okx/tsconfig.json` ✅
  - `common/temp/node_modules/.bin/tsc --noEmit --project apps/vendor-binance/tsconfig.json` ✅
  - `common/temp/node_modules/.bin/tsc --noEmit --project apps/vendor-aster/tsconfig.json` ✅
  - `common/temp/node_modules/.bin/tsc --noEmit --project apps/vendor-huobi/tsconfig.json` ✅

---

## 快速交接（后续如果要继续）

**如果你要做上游联调/验收**：

- 通过 Terminal 调用 `GetQuotes`，分别以不同 `product_id_prefix` 测试（例如：`OKX/SWAP/`、`BINANCE/SPOT/`、`HTX/SWAP/`），确认返回 action 中只包含所请求的字段集合。
- 若需要扩展字段（例如 OKX swap 的 funding 或更多衍生字段），按 D4 规则：新增一个 `provideQuoteService`，不要在已有 service 里 join。

---

_最后更新: 2025-12-14 23:58 by Codex (GPT-5.2)_
