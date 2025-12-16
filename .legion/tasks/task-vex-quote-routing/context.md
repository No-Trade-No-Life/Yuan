# task-vex-quote-routing - 上下文

## 会话进展 (2025-12-15)

### ✅ 已完成

- 定位 `VEX/QueryQuotes` TODO 与现有 cacheMissed 计算逻辑
- 确认上游 quote provider 使用 `GetQuotes`（`provideQuoteService`）并通过 schema 承载能力声明
- 梳理 Terminal service discovery：从 `ITerminalInfo.serviceInfo[].schema` 构建 provider registry
- 复盘 `.legion/tasks/implement-quote-service` 的 upstream 实现约束（prefix/fields const/不 join）
- 识别重大风险：quoteState v1/v2 读路径会创建 product，存在内存 DoS
- 你已确认：fields 使用字典序排序；多实例负载均衡；in-flight key 不包含 updated_at；可对 product_ids 做 fnv1a64 hash；freshness 不满足则直接抛异常；同 provider 并发限制为 1；类型可用 `as`。
- 实现 `apps/virtual-exchange/src/quote/service.ts` 的 TODO：基于 cacheMissed + 上游 GetQuotes schema metadata 做路由/批量/并发(in-flight)复用，并在补全后进行 strict freshness 校验
- 新增 `apps/virtual-exchange/src/quote/prefix-matcher.ts`：抽象 prefix 匹配接口（后续可替换为 AC 自动机实现）
- 新增 `apps/virtual-exchange/src/quote/request-key.ts`：FNV-1a 64-bit(无 BigInt) request key hash，用于 in-flight 去重
- 按人类指令记录：暂不处理 quoteState 读导致写 DoS 风险（见 `apps/virtual-exchange/SESSION_NOTES.md`）
- 变更请求：按 `docs/zh-Hans/code-guidelines/exchange.md` 的 L1 报价路由算法重写路由设计（交集过滤，不做 set cover）
- 已参考 `docs/zh-Hans/code-guidelines/exchange.md` 的「L1 报价数据」匹配算法，并将路由设计从 set cover 调整为 Trie(prefix)+field index+交集过滤（`S_product_id ∩ S_field`）。
- 已重构 `apps/virtual-exchange/src/quote/service.ts`：路由使用交集过滤替代 set cover；当字段不可用时写入空字符串 `""`
- 按 `docs/zh-Hans/code-guidelines/exchange.md` L1 报价算法重构路由：prefix 匹配 + field 倒排索引 + 交集过滤（不做 set cover）
- 实现字段不可用语义：当 `(product_id, field)` 无接口覆盖时写入 `""` 并用 `updated_at=req.updated_at` 满足 freshness
- in-flight 去重改为 `Map<key, Promise>`（请求完成后清理），并保持同 provider 串行、跨 provider 并行

### 🟡 进行中

(暂无)

### ⚠️ 阻塞/待定

(暂无)

---

## 关键文件

- `apps/virtual-exchange/src/quote/service.ts`：`VEX/QueryQuotes` 的 TODO 所在；需要补全 miss 并回写 `quoteState`
- `apps/virtual-exchange/src/quote/DESIGN.md`：既有路由/聚合建议（10.5~10.7）与风险提示（8.1）
- `docs/zh-Hans/code-guidelines/exchange.md`：L1 报价数据路由算法建议（Trie(prefix) + field index + 交集），明确“不需要 set cover”
- `libraries/exchange/src/quote.ts`：`provideQuoteService`（GetQuotes schema）与 `parseQuoteServiceMetadataFromSchema`
- `libraries/protocol/src/model.ts`：`ITerminalInfo.serviceInfo[].schema` 的结构来源
- `libraries/protocol/src/client.ts`：schema-based 服务发现与定向请求（`request(method, terminal_id, req, service_id)`）
- `.legion/tasks/implement-quote-service/plan.md`：vendor 侧 GetQuotes 的实现约束与实践（prefix/fields const/不 join）
- `apps/virtual-exchange/src/quote/prefix-matcher.ts`：prefix 匹配接口（当前实现为排序扫描；后续可替换 Trie/AC）
- `apps/virtual-exchange/src/quote/request-key.ts`：FNV-1a 64-bit hash（用于 request key）
- `apps/virtual-exchange/src/quote/implementations/v1.ts`：读路径创建 product 的实现细节（DoS 风险来源）

---

## 关键决策

| 决策                                                                                                                                         | 原因                                                                                                                         | 替代方案                                                                                                      | 日期       |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------- |
| 本轮不处理 quoteState 的“读导致写”风险，先完成路由闭环（已在 `apps/virtual-exchange/SESSION_NOTES.md` 记录覆盖关系）。                       | 人类指令要求先实现功能；风险处置留待后续单独修复，避免阻塞当前联调。                                                         | 修复 quoteState：读不创建 product；并在服务层加输入上限兜底（更安全）。                                       | 2025-12-15 |
| 路由算法按 L1 报价“交集过滤”实现：Trie(prefix) + field index + `S_product_id ∩ S_field`，不使用 set cover。                                  | 文档明确上游接口重叠很少，“这不是最小覆盖问题”；交集过滤更简单且复杂度更可控。                                               | 为每个 product 做贪心 set cover（当前实现），复杂且与文档建议不一致。                                         | 2025-12-15 |
| 通过 terminal 的 `serviceInfo.schema` 发现并解析上游 `GetQuotes` provider 的 metadata（prefix/fields/maxItems）。                            | `@yuants/exchange` 已将 provider 能力编码在 JSON Schema，并提供 `parseQuoteServiceMetadataFromSchema`；符合零配置发现目标。  | 硬编码 vendor/prefix/字段映射；或仅依赖 `TerminalClient.resolveTargetServices` 做黑盒路由（无法按字段规划）。 | 2025-12-15 |
| in-flight 复用使用 in-memory `Map<key, Promise>`（请求完成后立即清理），同 provider 并发限制为 1，且全局并发限制为 32。                      | 仅做“在途去重”避免内存泄漏与跨调用缓存污染；同时满足“同 provider 串行 + 全局限流”的过载保护。                                | 使用 `@yuants/cache`（实现更像短期缓存而非纯 in-flight）；或引入第三方并发库。                                | 2025-12-15 |
| 当某个 `(product_id, field)` 无任何可用接口时，返回空字符串 `""`（并写入 `updated_at=req.updated_at` 以满足 freshness）。                    | `exchange.md` 明确“字段不可用返回空字符串不报错”；同时本任务要求 `updated_at` 绝对鲜度，因此用空值+阈值时间戳避免重复 miss。 | 直接抛异常（会让“本来就没有接口提供该字段”的场景不可用）；或返回缺失字段（会触发 freshness 校验失败）。       | 2025-12-15 |
| 同一个 provider（建议按“schema 能力签名”定义）并发限制为 1；不同 provider 允许并发。                                                         | 避免单 provider 被并发打爆，同时保留跨 provider 并行补全能力。                                                               | 全局统一并发池；或按实例（terminal_id+service_id）做并发控制。                                                | 2025-12-15 |
| GetQuotes 多实例做负载均衡；in-flight key 对 product_ids 做 FNV-1a 64 hex hash（参考 alert fingerprint 实现）。                              | 多实例可扩展吞吐并提升可用性；对 product_ids 哈希避免超长 key 占用内存，且保持 key 稳定。                                    | 固定指定 terminal_id/service_id；或直接拼接长字符串 key。                                                     | 2025-12-15 |
| freshness 是硬约束：若补全后仍有任一 requested 字段 `updated_at < req.updated_at`（或缺失），则 `VEX/QueryQuotes` 直接抛异常退出，不做重试。 | 调用方把 `updated_at` 作为绝对鲜度要求；返回不满足鲜度的数据会产生更隐蔽的错误。                                             | best-effort 返回部分数据；或失败后重试/降级。                                                                 | 2025-12-15 |
| `fields` 一律按字典序；VEX 构造请求时直接 `sort()`（必要时抽工具）。                                                                         | provider schema 对 `fields` 用 `const` 约束，数组值需要一致；统一字典序可避免顺序不稳定导致的“无可用服务”。                  | 保留原始顺序；或改 schema 为 `items.enum`（但与当前 provideQuoteService 不一致）。                            | 2025-12-15 |

---

## 快速交接

**下次继续从这里开始：**

1. 联调：启动 vendor GetQuotes providers 与 virtual-exchange，调用 `VEX/QueryQuotes` 验证路由/批量/负载均衡
2. 关注两类异常：`VEX_QUOTE_PRODUCT_UNROUTABLE`（product 无任何 prefix 命中）与 `VEX_QUOTE_FRESHNESS_NOT_SATISFIED`（理论可用但仍过旧/缺失）

**注意事项：**

- 按你的指令，DoS 风险仍未修；字段不可用不报错而返回空字符串。

---

_最后更新: 2025-12-15 16:37 by Claude_
