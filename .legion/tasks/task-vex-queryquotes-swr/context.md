# task-vex-queryquotes-swr - 上下文

## 会话进展 (2025-12-17, 2025-12-19)

### ✅ 已完成

- 已将 `VEX/QueryQuotes` 的 SWR（stale-while-revalidate）详细设计落盘到 `plan.md`（同步立即返回 + 后台 RxJS 串行补全 + 执行时重算 miss + 错误隔离）。
- 已阅读现状代码：`apps/virtual-exchange/src/quote/service.ts`（QueryQuotes 同步 await 上游 + strict freshness assert）、`apps/virtual-exchange/src/quote/upstream/registry.ts`（fillQuoteStateFromUpstream/路由/执行/回写）、`apps/virtual-exchange/src/quote/types.ts`、`apps/virtual-exchange/src/quote/implementations/v1.ts`（生产实现）等。
- 在仓库内全局搜索未发现 `VEX/QueryQuotes` 调用方（仅有服务定义与设计文档），因此调用方行为/错误码兼容性需要由你提供信息或通过运行环境观测确认。
- 已在 `apps/virtual-exchange/src/quote/service.ts` 最终收敛为：`VEX/QueryQuotes` 同步计算 miss/stale 并逐条调用 `apps/virtual-exchange/src/quote/scheduler.ts` 的 `markDirty`，然后直接返回 `quoteState.filterValues`（缺失字段返回空字符串）；不再维护 service.ts 内部更新队列与 `VEX/QuoteUpdateQueueStatus`。
- 已运行 prettier：`common/autoinstallers/rush-prettier/node_modules/.bin/prettier --write apps/virtual-exchange/src/quote/service.ts`。

### 🟡 进行中

(暂无)

### ⚠️ 阻塞/待定

(暂无)

---

## 关键文件

- `apps/virtual-exchange/src/quote/service.ts`：对外 `VEX/QueryQuotes` 服务，现已改为“同步触发 markDirty + 返回 filterValues”
- `apps/virtual-exchange/src/quote/scheduler.ts`：调度与上游补全逻辑的集中实现（对外暴露 `markDirty`）

---

## 关键决策

| 决策                                                                                                                                                                                    | 原因                                                                                                                                                                                           | 替代方案                                                                                                   | 日期       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------- |
| SWR 的 `VEX/QueryQuotes` 采用“stale-OK + miss-error”：同步返回最新缓存（含 stale），仅在完全缺失（miss）时同步抛错，同时入队触发后台补全；并新增队列状态查询服务。                      | 轮询场景下 stale 仍比缺字段更有用；把 stale 隐藏会导致调用方误判为缺失。miss 则代表缓存完全没有值，需要显式失败以提示调用方处理，同时后台补全负责收敛。队列状态服务用于排查 backlog 与稳定性。 | 纯 best-effort（stale 与 miss 都不报错、仅返回部分数据）；或保持 strict freshness（任何 stale 都抛错）。   | 2025-12-17 |
| 不提供 `VEX/QueryQuotesStrict`（仅保留 `VEX/QueryQuotes` 的 SWR 语义）。                                                                                                                | 人类确认不需要 strict 模式；保持接口面最小化，避免额外端点带来误用与维护成本。                                                                                                                 | 保留 `VEX/QueryQuotesStrict` 作为兼容端点；或保留旧 `VEX/QueryQuotes` strict 并新增 `VEX/QueryQuotesSWR`。 | 2025-12-17 |
| `VEX/QueryQuotes` 收敛为纯 best-effort：同步计算 miss/stale 并逐条调用 `scheduler.markDirty`，直接返回 `filterValues`（缺失字段返回空字符串），不再使用 service.ts 内部队列与状态服务。 | 与 scheduler.ts 的职责收敛：调度/去重/并发控制统一由 scheduler 承担；service.ts 只做“判断是否需要触发更新”与“立即返回当前缓存视图”。                                                           | 维持旧设计（入队串行 + miss-error + `VEX/QuoteUpdateQueueStatus`）；或继续同步 await 上游（高延迟）。      | 2025-12-19 |

---

## 快速交接

**下次继续从这里开始：**

1. 在运行环境用任意客户端调用 `VEX/QueryQuotes`，确认返回值总是 `filterValues` 形状；同时 miss/stale 会触发 `scheduler.markDirty` 走后台补全。
2. 若需要可观测性：优先在 scheduler.ts 侧做聚合指标/日志（避免在 service.ts 引入专用队列）。

**注意事项：**

- `updated_at` 仍是“鲜度下界（min_updated_at）”语义；若调用方传 `Date.now()`，将几乎每次触发后台更新。
- service.ts 已不再提供队列状态服务；需要排查性能/积压时，请在 scheduler.ts 侧定位。

---

_最后更新: 2025-12-19 19:12 by Codex_
