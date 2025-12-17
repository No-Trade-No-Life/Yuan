# task-vex-quote-upstream-refactor

## 目标

Refactor VEX quote upstream routing into layered modules (registry/router/executor) with clear interfaces, remove debug leftovers, and unify log tags.

## 要点

- 遵循 `docs/zh-Hans/code-guidelines/exchange.md` 的 L1 报价路由算法（prefix 匹配 + field 倒排 + 交集）
- 保持现有错误语义（provider not found / product unroutable / upstream error / freshness hard requirement）
- 并发策略保持：同 provider group 串行（=1），全局并发上限 32，in-flight 去重
- 纯函数尽量贴近对应 interface，返回值改为语义对象减少调用方解包
- 目录组织保持简洁、贴合 quote 模块现有结构

## 范围

- apps/virtual-exchange/src/quote/upstream/index.ts（由 upstream-routing.ts 迁移）
- apps/virtual-exchange/src/quote/upstream/registry.ts
- apps/virtual-exchange/src/quote/upstream/router.ts
- apps/virtual-exchange/src/quote/upstream/executor.ts
- apps/virtual-exchange/src/quote/types.ts
- apps/virtual-exchange/src/quote/service.ts（更新导入路径/调用编排入口）

## 阶段概览

1. **Discovery** - 1 个任务
2. **Design** - 1 个任务
3. **Refactor** - 2 个任务
4. **Validation** - 1 个任务

---

## 设计草图（待确认）

### 分层与接口

目标是把 `upstream-routing.ts` 里混在一起的“领域逻辑”与“切面能力”拆开：调用方只看到一条清晰的编排链路。

> [REVIEW]: 我认为 IQuoteProviderRegistry 应该做的更多一些，它应该能同时提供 plan 和 execute 的功能，然后 IQuoteRouter 作为 IQuoteProviderRegistry 的一个子模块，专注于路由逻辑。至于 IGetQuotesExecutor，我觉得它可以作为 IQuoteProviderRegistry 的一个内部组件，而不是一个独立的接口。同样的，做 route 的时候，trie 树实现也可以作为 Router 的一个可以替换出来的组件。
>
> [RESPONSE] 采纳你的建议：对外只暴露一个 `IQuoteProviderRegistry`（Facade），它对外同时提供 `planOrThrow/execute/fillQuoteStateFromUpstream`；`IQuoteRouter` 作为 registry 内部子模块专注路由/分批；`GetQuotesExecutor` 作为 registry 内部组件负责 LB/并发/in-flight/日志；prefix matcher（Trie/AC/排序扫描）作为 Router 的可替换组件（依赖 `IPrefixMatcher` 注入）。我已在 plan.md 的“分层与接口”部分改写设计草图。
> [STATUS:resolved]

采纳：对外只暴露一个 `IQuoteProviderRegistry`（Facade），Router/Executor 作为内部组件，减少概念暴露面。

- **`IQuoteProviderRegistry`（对外 Facade：切面 + 编排）**
  - 负责：服务发现与缓存（RxJS/TerminalInfos 内部化）、对外提供“规划 + 执行 + 应用”的一站式能力
  - API 草图：
    - `snapshot(): { groups, indices }`（诊断/日志/测试）
    - `planOrThrow(misses, updated_at): QuoteUpstreamPlan`（内部用 Router；遇到 unroutable 直接 `newError` 抛）
    - `execute(requests): Promise<IQuoteUpdateAction[]>`（内部用 Executor；LB/并发/in-flight 在内部治理）
    - `fillQuoteStateFromUpstream({ quoteState, cacheMissed, updated_at }): Promise<void>`（给 `service.ts` 的编排入口）
- **`IQuoteRouter`（领域：Registry 内部子模块）**
  - 负责：L1 路由算法与分批策略（纯逻辑）
  - 可替换点：prefix 匹配器实现（当前 `createSortedPrefixMatcher`；未来可替换 Trie/AC）
  - 依赖注入：Router 接收 `IPrefixMatcher`（见 `apps/virtual-exchange/src/quote/upstream/prefix-matcher.ts`）
- **`GetQuotesExecutor`（切面：Registry 内部组件）**
  - 负责：网络请求执行与治理（round-robin / 同 group 串行 / 全局并发上限 / in-flight 去重 / 日志）
  - 不对外暴露独立接口（但内部仍按类/函数拆分，便于测试与维护）

### 关键返回值（减少“解包”成本，贴近 Router/Registry）

把现在 `routeMisses(...) -> productsByGroupId + unavailableAction + unroutableProducts` 与 `planRequests(...)` 的二段式返回，合并为一个语义对象：

- `QuoteUpstreamPlan`
  - `defaultAction: IQuoteUpdateAction`（字段不可用的空串补丁；也包括“命中 prefix 但找不到 field 覆盖”的情况）
  - `requests: Array<{ key, planned: IPlannedRequest }>`（已经完成分组与分批的可执行请求列表）

> [REVIEW] unavailableAction 我觉得可以改成一个更通用的名字，比如 defaultAction。然后 unroutableProducts 直接 newError 抛异常，不要返回回来，减少逻辑复杂度。
>
> [RESPONSE] 采纳：`unavailableAction` 重命名为 `defaultAction`；并把 `unroutableProducts` 从返回值移除，改为 `planOrThrow` 规划阶段直接 `newError('VEX_QUOTE_PRODUCT_UNROUTABLE', ...)` 抛出，减少调用方分支。已更新 plan.md 的“关键返回值”与编排链路描述。
> [STATUS:resolved]

采纳：

- `unavailableAction` 重命名为 `defaultAction`
- `unroutableProducts` 不作为返回值：由 `planOrThrow` 在规划阶段直接抛 `newError('VEX_QUOTE_PRODUCT_UNROUTABLE', ...)`

这样编排层（`fillQuoteStateFromUpstream`）只需要：
`planOrThrow -> applyDefault -> execute -> applyActions`。

### 目录组织（两种都可）

**推荐（更清晰）**：新增子目录，专门承载 upstream 相关切面/领域实现：

- `apps/virtual-exchange/src/quote/upstream/registry.ts`
- `apps/virtual-exchange/src/quote/upstream/router.ts`
- `apps/virtual-exchange/src/quote/upstream/executor.ts`
- `apps/virtual-exchange/src/quote/upstream/index.ts`（编排层：集中导出 `fillQuoteStateFromUpstream` / `createQuoteProviderRegistry` 等）

> [REVIEW] 这个好，不过我认为 - `apps/virtual-exchange/src/quote/upstream-routing.ts` 应该迁移为 `apps/virtual-exchange/src/quote/upstream/index.ts`，作为编排层的集中导出。
>
> [RESPONSE] 采纳：把原 `apps/virtual-exchange/src/quote/upstream-routing.ts` 迁移为 `apps/virtual-exchange/src/quote/upstream/index.ts`，作为编排层集中导出；Router/Registry/Executor 分别落到 `upstream/router.ts`、`upstream/registry.ts`、`upstream/executor.ts`。已更新 plan.md 的目录组织部分。
> [STATUS:resolved]

采纳：`upstream-routing.ts` 迁移为 `upstream/index.ts`，并将 Router/Executor/Registry 的实现分别放入对应文件。

**备选（改动更小）**：不建目录，仍放在同级：

- `apps/virtual-exchange/src/quote/upstream-registry.ts`
- `apps/virtual-exchange/src/quote/upstream-router.ts`
- `apps/virtual-exchange/src/quote/upstream-executor.ts`

我倾向“推荐方案”，因为 quote 目录里已经有 `implementations/` 与 `benchmark/`，新增 `upstream/` 的语义也很明确。

### 待确认点

1. 目录按“推荐方案”执行：新增 `upstream/`，并把 `upstream-routing.ts` 迁移为 `upstream/index.ts`。
2. `IQuoteProviderGroup.mapTerminalIdToInstance` 的 key 仍按 `terminal_id`（你确认 `terminal_id/service_id` 全局唯一且足够表达实例）；未来如需同 terminal 多实例，再切到 `encodePath(terminal_id, service_id)`。

_创建于: 2025-12-16 | 最后更新: 2025-12-16_
