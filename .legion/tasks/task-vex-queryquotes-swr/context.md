# task-vex-queryquotes-swr - 上下文

## 会话进展 (2025-12-17)

### ✅ 已完成

- 已将 `VEX/QueryQuotes` 的 SWR（stale-while-revalidate）详细设计落盘到 `plan.md`（同步立即返回 + 后台 RxJS 串行补全 + 执行时重算 miss + 错误隔离）。
- 已阅读现状代码：`apps/virtual-exchange/src/quote/service.ts`（QueryQuotes 同步 await 上游 + strict freshness assert）、`apps/virtual-exchange/src/quote/upstream/registry.ts`（fillQuoteStateFromUpstream/路由/执行/回写）、`apps/virtual-exchange/src/quote/types.ts`、`apps/virtual-exchange/src/quote/implementations/v1.ts`（生产实现）等。
- 在仓库内全局搜索未发现 `VEX/QueryQuotes` 调用方（仅有服务定义与设计文档），因此调用方行为/错误码兼容性需要由你提供信息或通过运行环境观测确认。
- 已在 `apps/virtual-exchange/src/quote/service.ts` 实现：`VEX/QueryQuotes` 走 SWR（同步返回 filterLatest + miss 抛错 + 入队后台更新）；新增 `VEX/QuoteUpdateQueueStatus` 返回队列观测指标；并按人类反馈移除了 `VEX/QueryQuotesStrict`。
- 已运行 prettier：`common/autoinstallers/rush-prettier/node_modules/.bin/prettier --write apps/virtual-exchange/src/quote/service.ts`。

### 🟡 进行中

(暂无)

### ⚠️ 阻塞/待定

- 尝试运行 `node ../../common/scripts/install-run-rushx.js build`（apps/virtual-exchange）失败，原因是仓库现存 TypeScript 错误（`apps/virtual-exchange/src/position.ts` 与 `apps/virtual-exchange/src/quote/upstream/router.ts`），与本次改动无直接关系；因此本次无法用 build 作为验证手段。

---

## 关键文件

(暂无)

---

## 关键决策

| 决策                                                                                                                                                               | 原因                                                                                                                                                                                           | 替代方案                                                                                                   | 日期       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------- |
| SWR 的 `VEX/QueryQuotes` 采用“stale-OK + miss-error”：同步返回最新缓存（含 stale），仅在完全缺失（miss）时同步抛错，同时入队触发后台补全；并新增队列状态查询服务。 | 轮询场景下 stale 仍比缺字段更有用；把 stale 隐藏会导致调用方误判为缺失。miss 则代表缓存完全没有值，需要显式失败以提示调用方处理，同时后台补全负责收敛。队列状态服务用于排查 backlog 与稳定性。 | 纯 best-effort（stale 与 miss 都不报错、仅返回部分数据）；或保持 strict freshness（任何 stale 都抛错）。   | 2025-12-17 |
| 不提供 `VEX/QueryQuotesStrict`（仅保留 `VEX/QueryQuotes` 的 SWR 语义）。                                                                                           | 人类确认不需要 strict 模式；保持接口面最小化，避免额外端点带来误用与维护成本。                                                                                                                 | 保留 `VEX/QueryQuotesStrict` 作为兼容端点；或保留旧 `VEX/QueryQuotes` strict 并新增 `VEX/QueryQuotesSWR`。 | 2025-12-17 |

---

## 快速交接

**下次继续从这里开始：**

1. 在实际运行环境用任意客户端调用 `VEX/QueryQuotes`：首次 miss 预期抛 `VEX_QUOTE_FRESHNESS_NOT_SATISFIED`，随后轮询同参数应逐步收敛；stale 场景应直接返回旧值且后台触发更新。
2. 调用 `VEX/QuoteUpdateQueueStatus` 观察 `pending/in_flight/last_error/last_processed_at`，确认队列不会因单次上游失败停转且无长期积压。
3. 确认任务文档提到的 `.c1-cellar/vex-query-quotes.ts` 的真实位置（当前仓库未找到），或提供替代验证脚本/命令。

**注意事项：**

- 本次 build 验证受仓库现存 TS 错误影响（`apps/virtual-exchange/src/position.ts`、`apps/virtual-exchange/src/quote/upstream/router.ts`），需要先修复它们才能用 `apps/virtual-exchange` 的 `build` 作为验收手段。
- 若调用方习惯传 `updated_at = Date.now()`，SWR 将几乎每次入队触发后台更新；需要在调用侧改为 `Date.now() - 容忍延迟` 或在服务侧增加保护/报警（本次未做）。

---

_最后更新: 2025-12-17 22:53 by Codex_
