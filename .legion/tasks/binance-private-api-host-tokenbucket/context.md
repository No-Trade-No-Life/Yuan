# Binance private-api 按 host 选择 tokenBucket 并按权重限流 - 上下文

## 会话进展 (2025-12-24)

### ✅ 已完成

- 已记录前置条件：按你的说明，apps/vendor-binance/src/api/client.ts 会在模块初始化阶段创建 3 个 tokenBucket（api/fapi/papi）；private-api 仅获取既有 bucket（不再传 options）
- 已在 .legion/tasks/binance-private-api-host-tokenbucket/plan.md 补充 host->bucket 映射规则、统一封装思路与可复制示例，并附带待确认的 REVIEW（编码前置条件）
- 已按你的要求回滚我此前直接落盘的代码改动：`apps/vendor-binance/src/api/private-api.ts` 已恢复到改动前状态，且已删除我新增的测试文件
- 根据你在 plan.md 的新 review（不要抽 wrapper），已更新设计：不再引入 requestPrivateWithRateLimit；tokenBucket/acquireSync/scopeError 逻辑直接写在每个具体 API 方法内
- 更新 plan.md 示例：scopeError 仅包裹 acquireSync（避免把请求错误也包装为 BINANCE_API_RATE_LIMIT）
- 已响应你新增的 review：不再抽 wrapper；不再添加 host guard；plan.md 示例已更新
- 已在 apps/vendor-binance/src/api/client.ts 创建 3 个 tokenBucket（api/fapi/papi），确保后续 tokenBucket(host) 仅获取既有桶
- 已在 apps/vendor-binance/src/api/private-api.ts 的每个具体 API 方法中：按 endpoint host 获取 bucket 并 acquireSync(权重)，然后再调用 requestPrivate；不抽 wrapper，不加 host guard
- 已新增最小单测 apps/vendor-binance/src/api/private-api.rateLimit.test.ts（覆盖 host 路由与条件权重）
- 已运行校验：`npx prettier -w ...`（root），`npx tsc --noEmit --project tsconfig.json`（apps/vendor-binance），`npx heft test --clean`（apps/vendor-binance）
- 已实现 public-api 主动限流：apps/vendor-binance/src/api/public-api.ts 在各方法调用 requestPublic 前执行 tokenBucket(url.host).acquireSync(weight)
- 已新增 public-api 最小单测 apps/vendor-binance/src/api/public-api.rateLimit.test.ts
- 已运行校验（apps/vendor-binance）：`npx tsc --noEmit --project tsconfig.json`、`npx heft test --clean`（2 个 test suite 全部通过）

### 🟡 进行中

(暂无)

### ⚠️ 阻塞/待定

(暂无)

---

## 关键文件

- `apps/vendor-binance/src/api/client.ts`: 已定义 3 个 tokenBucket（本次实现只会“获取既有 bucket”，不会重复传 options）
- `.legion/tasks/binance-private-api-host-tokenbucket/plan.md`: host->bucket 映射规则、weight 获取方式、以及可复制示例（review 已闭环）
- `apps/vendor-binance/src/api/private-api.ts`: private REST：每个方法在请求前按 `endpoint` 的 `url.host` 取桶并 `acquireSync(weight)`
- `apps/vendor-binance/src/api/public-api.ts`: public REST：同上（在请求前 `acquireSync(weight)`）
- `apps/vendor-binance/src/api/private-api.rateLimit.test.ts`: 最小验证（host 路由 + 条件权重）
- `apps/vendor-binance/src/api/public-api.rateLimit.test.ts`: 最小验证（host 路由 + 条件权重）

---

## 关键决策

| 决策                                                                                                            | 原因                                                                                                                         | 替代方案                                                                     | 日期       |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------- |
| 任何代码改动必须在 plan.md 的 REVIEW 得到明确确认后再开始                                                       | 避免“先写代码后补设计”的协作失序，保证你先审阅映射规则与示例                                                                 | 先实现再回头调整（本次被明确禁止）                                           | 2025-12-24 |
| 严格按 URL host 选择 tokenBucket（`tokenBucket(url.host)`），不做未知 host 兜底，不加 host guard                | 用户已穷举 endpoint host；按 host 路由最直观且与“IP 限流”一致；未知 host 由 tokenBucket/调用栈自然暴露错误，便于发现漏网调用 | 增加显式映射表并对未知 host throw；或提供默认 bucket（更容错但可能掩盖遗漏） | 2025-12-24 |
| 不抽 requestPrivateWithRateLimit 等 wrapper；tokenBucket/acquireSync/scopeError 逻辑直接写在每个具体 API 方法里 | 按最新 review，避免抽象以免隐藏权重与调用点逻辑                                                                              | 抽 wrapper 统一实现（更 DRY，但不符合本次协作偏好）                          | 2025-12-24 |

---

## 快速交接

**下次继续从这里开始：**

1. 确认 futures fundingRate 的权重/限频口径（文档展示为 500/5min/IP），如需更严格可单独引入更小的 bucket 或提升 weight

**注意事项：**

- public-api 的实现同 private-api：不抽 wrapper，不加 host guard；tokenBucket 使用 url.host 直接取桶。

---

_最后更新: 2025-12-24 23:05 by Codex_
