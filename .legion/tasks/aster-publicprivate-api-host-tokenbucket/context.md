# Aster public/private API 按 host 选择 tokenBucket 并主动限流 - 上下文

## 会话进展 (2025-12-24)

### ✅ 已完成

- 已调研 Aster 官方文档：Futures `fapi.asterdex.com` REQUEST_WEIGHT=2400/min；Spot `sapi.asterdex.com` REQUEST_WEIGHT=6000/min；并整理当前 vendor-aster 使用到的 endpoint 权重（含 openOrders/tickerPrice/klines 的条件权重）
- 已补齐 `plan.md`：host->bucket 规则、bucket 参数来源（exchangeInfo.rateLimits）、weight 规则与可复制示例
- 已新增 `apps/vendor-aster/src/api/client.ts`：模块初始化创建两个 tokenBucket（fapi/sapi），后续调用点仅 `tokenBucket(url.host)` 获取既有桶
- 已在 `apps/vendor-aster/src/api/private-api.ts` / `apps/vendor-aster/src/api/public-api.ts` 的每个具体 API 方法中：请求前 `scopeError(..., () => tokenBucket(url.host).acquireSync(weight))`（不抽 wrapper，不捕获 token 不足异常）
- 已新增最小单测：`apps/vendor-aster/src/api/private-api.rateLimit.test.ts`、`apps/vendor-aster/src/api/public-api.rateLimit.test.ts`
- 已验证：`npx tsc --noEmit --project tsconfig.json`、`npx heft test --clean`（workdir: `apps/vendor-aster`）
- 已更新 `apps/vendor-aster/SESSION_NOTES.md`：记录本轮摘要、改动文件、验证命令

### 🟡 进行中

- (暂无)

### ⚠️ 阻塞/待定

(暂无)

---

## 关键文件

- `apps/vendor-aster/src/api/client.ts`: 初始化 tokenBucket（fapi/sapi）——首次 create
- `apps/vendor-aster/src/api/private-api.ts`: 私有 REST helper（签名请求）+ 在每个具体 API 调用点 acquireSync(weight)
- `apps/vendor-aster/src/api/public-api.ts`: 公共 REST helper + 在每个具体 API 调用点 acquireSync(weight)
- `apps/vendor-aster/src/api/private-api.rateLimit.test.ts`: 最小验证（host 路由 + 条件权重）
- `apps/vendor-aster/src/api/public-api.rateLimit.test.ts`: 最小验证（host 路由 + 条件权重）
- `apps/vendor-aster/SESSION_NOTES.md`: 记录本轮变更与验证命令

---

## 关键决策

| 决策                                                                                                                                                                                         | 原因                                                                                                   | 替代方案                                                                                    | 日期       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ---------- |
| 为保证“tokenBucket/acquireSync 在具体 API 调用点可见”，不改造 createApi 工厂为隐式 wrapper，而是将 public-api/private-api 的导出 API 改为显式函数，在函数体内先 acquireSync(weight) 再发请求 | 用户偏好与 Binance 侧一致：权重只在具体接口调用点最明确；把限流隐藏在工厂里会让调用点不可见且难 review | 在 createApi/request 里根据 endpoint 自动计算 weight 并限流（更 DRY，但不符合本次协作偏好） | 2025-12-24 |
| 对文档未明确的权重口径：`getFApiV1OpenInterest` 暂定 `weight=1`；`getApiV1Klines` 暂按 futures 的 limit->weight 表计算                                                                       | 优先保证“不会因为缺失权重信息而完全绕过限流”；同时将不确定性显式记录，便于后续校准                     | 统一都设 `weight=1`（可能低估）；或保守取更大 weight（可能导致自限流过严、频繁抛错）        | 2025-12-24 |

---

## 快速交接

**下次继续从这里开始：**

1. 校验 `getFApiV1OpenInterest` 的真实权重/限频口径（文档缺失）：必要时调整 weight 或拆分单独 bucket
2. 校验 `getApiV1Klines` 的真实权重口径（spot 文档未标注）：如与 futures 不同，更新 `public-api.ts` 的 weight 计算
3. 评估是否需要引入 `ORDERS` 类限频的独立 bucket（尤其 futures `1200/min`、spot `300/10s`）

**注意事项：**

- 该实现使用 `acquireSync`：token 不足会直接 throw；调用方不要吞异常，否则可能导致 silent drop
- `apps/vendor-aster/src/api/client.ts` 是首次 create 的唯一位置：调用点不要再传 options（避免“重复 create”语义混乱）

---

_最后更新: 2025-12-24 23:45 by Codex_
