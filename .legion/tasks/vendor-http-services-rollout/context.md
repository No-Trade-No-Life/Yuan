# vendor-http-services-rollout - 上下文

## 会话进展 (2026-01-29)

### ✅ 已完成

- 完成 vendor-binance 的初步调研：唯一 fetch 使用点在 apps/vendor-binance/src/api/client.ts；requestPublic/requestPrivate 被 public-api/private-api/ohlc-service 广泛调用
- 阅读 apps/vendor-binance/SESSION_NOTES.md 并对齐当前阶段指令与风险
- 完成设计文档：RFC 与 spec-dev/spec-test/spec-bench/spec-obs
- 更新 plan.md 设计方案、文件变更明细与设计自检报告
- 修正 tasks.md 进度并增加设计审批门禁任务
- 补强 RFC：增加核心流程、接口定义、设计方案与文件变更明细，使其与 plan.md 对齐
- 按要求调整设计：不使用别名，直接覆盖 import 的 fetch 标识
- 按要求调整设计：仅新增 import 覆盖 fetch，不改动调用点代码
- 确认本阶段无需新增 benchmark，已在 docs/spec-bench.md 记录理由（无执行方式/输出格式）。
- apps/vendor-binance 侧引入 @yuants/http-services fetch 覆盖本地 fetch 标识，调用点保持不变。
- 更新 apps/vendor-binance 依赖并记录 Session Notes。
- 补充 spec-test 测试实现方案，新增 RFC 条款覆盖映射与失败场景回归用例清单。
- 在 RFC 增加 R1-R3 MUST 条款，作为测试映射依据。
- 确认本轮不执行测试，仅输出测试实现方案。
- 阶段 A 完成：impl-dev/impl-test/impl-bench 子任务已产出实现与文档更新
- 阶段 B 完成：生成 review-code 与 review-security 报告
- 修复 apps/vendor-binance/src/api/client.ts 日志脱敏：移除 API key/签名/signData/完整 query，仅保留 method/host/path/usedWeight/retryAfter
- 更新 apps/vendor-binance/SESSION_NOTES.md 记录安全修复
- 更新 WORK_ROOT/docs/spec-dev.md 增加日志脱敏实现备注
- 更新 spec-test/spec-bench 备注：本轮仅日志脱敏，无新增测试/benchmark
- 安全修复：ACTIVE_RATE_LIMIT 错误 payload 改为仅包含 host+pathname，避免签名泄露
- 完成 ACTIVE_RATE_LIMIT 错误 payload 脱敏：移除 endpoint 字段，仅保留 host+pathname（避免签名/查询泄露）
- 按指令未运行任何测试
- 复核 apps/vendor-binance/src/api/client.ts 日志与错误 payload 脱敏确认：不输出签名、API key、signData 或完整 query
- 阶段 B 复检通过：review-code PASS、review-security PASS，已更新 review 报告文件
- 执行 spec-test 最小验证：运行 `npx tsc --noEmit --project apps/vendor-binance/tsconfig.json`（失败：本地缺少 TypeScript，npx 无法找到 tsc）。
- 阶段 C 运行最小测试失败：npx tsc 未找到 TypeScript（环境依赖缺失）
- 阶段 C 运行 rush build -t @yuants/vendor-binance，TypeScript 失败：找不到 @yuants/http-services 声明
- 执行 rush update 安装依赖并更新 pnpm-lock
- 阶段 C 通过：rush build -t @yuants/vendor-binance 成功
- 阶段 D 完成：生成 report-walkthrough.md 与 pr-body.md
- 阶段 C 通过：rush build -t @yuants/vendor-binance 成功（依赖已更新）
- 设计变更：新增 USE_HTTP_PROXY 环境变量控制是否覆盖 globalThis.fetch
- 更新 WORK_ROOT/docs/spec-test.md，补充 USE_HTTP_PROXY 手工验证要点并标记测试清单待补；本轮不新增测试、不运行测试。
- 在 apps/vendor-binance/src/api/client.ts 增加 USE_HTTP_PROXY 条件：为 true 时覆盖 globalThis.fetch，调用改为 globalThis.fetch。
- 更新 apps/vendor-binance/SESSION_NOTES.md 记录 USE_HTTP_PROXY 开关，本轮未运行基准/测试。
- 本轮无需新增 benchmark，spec-bench 保持不变。
- 调整 fetch 实现：USE_HTTP_PROXY=false 时优先使用原生 fetch，不可用则回退到 http-services fetch
- 阶段 B 复检通过：review-code PASS、review-security PASS（USE_HTTP_PROXY 变更）
- 最小验证通过：`rush build -t @yuants/vendor-binance`（Node 24.11.0，Rush 5.165.0，目标包 @yuants/vendor-binance 构建成功，部分依赖命中缓存）。
- 调研 other vendors 的 fetch 使用点（okx/gate/hyperliquid/aster/bitget/huobi）并更新设计文档
- 更新 plan.md/RFC/spec-dev/spec-test/spec-obs 以覆盖阶段 4 推广
- 按指令本轮仅推广 fetch 模式，不新增测试、不运行测试；spec-test 清单保持为构建+手工验证说明。
- 补充 spec-bench 说明：本阶段无 benchmark，明确无执行命令/基线/阈值与回归判断。
- 按 spec-dev 在 okx/gate/hyperliquid/aster/bitget/huobi 的 fetch 模块引入 @yuants/http-services，添加 USE_HTTP_PROXY + fetchImpl 回退逻辑并覆盖 globalThis.fetch。
- 将各模块的 fetch 调用改为 fetchImpl（含 aster 的 coingecko 请求）。
- 为各 vendor package.json 增加 @yuants/http-services 依赖。
- 更新 gate/hyperliquid/aster/bitget 的 SESSION_NOTES 记录变更与未运行测试。
- 修复 okx/huobi/aster 私有 API 日志脱敏：移除含签名/查询的 URL 与 headers 输出
- 修复 hyperliquid 私有请求日志脱敏：移除完整 URL/params 输出，仅保留 host/path/status
- 修复 huobi 私有请求元数据脱敏：移除 access_key 字段以避免日志泄露
- 阶段 B 复检通过：review-code PASS、review-security PASS（推广阶段）
- 阶段 D 更新：walkthrough/pr-body 已覆盖多 vendor 推广
- 阶段 C 通过：rush build -t @yuants/vendor-{okx,gate,hyperliquid,aster,bitget,huobi} 成功
- 阶段 D 完成：更新 report-walkthrough.md 与 pr-body.md 覆盖全 vendor 推广
- 阶段 C 通过：rush build -t @yuants/vendor-okx/gate/hyperliquid/aster/bitget/huobi 成功
- 已创建 PR: https://github.com/No-Trade-No-Life/Yuan/pull/2547
- 生成 http-services 递归栈溢出修复 RFC（设计真源）。
- 完成 RFC 对抗审查，形成 review-rfc.md 内容草案（NEEDS_CHANGES）
- 最终对抗审查完成：结论 PASS，无 blocking；可选优化记录于 review-rfc.md
- 在 http-services client.ts 缓存 native fetch 并为 proxy fetch 打标记，避免覆盖后丢失原生 fetch。
- 在 Terminal 构造中优先使用 \_\_yuantsNativeFetch，并在 USE_HTTP_PROXY=true 或 native fetch 不可用/被标记时跳过 public IP 获取。
- 完成实现：http-services 缓存 \_\_yuantsNativeFetch/标记 proxy fetch；terminal public IP 跳过逻辑落地。
- 执行最小构建验证：`rush build -t @yuants/http-services -t @yuants/protocol`（PASS；Node 24.11.0，Rush 5.165.0；@yuants/http-services/@yuants/protocol 构建成功，部分依赖命中缓存）
- 阶段 B 完成：rush build -t @yuants/http-services -t @yuants/protocol 通过（Node 24.11.0 警告未测试但构建成功）。
- review-code 通过：/Users/c1/Work/Yuan/.legion/tasks/vendor-http-services-rollout/docs/review-code-fix.md
- review-security 通过：/Users/c1/Work/Yuan/.legion/tasks/vendor-http-services-rollout/docs/review-security-fix.md
- 生成报告：/Users/c1/Work/Yuan/.legion/tasks/vendor-http-services-rollout/docs/report-walkthrough-fix.md
- 生成 PR body：/Users/c1/Work/Yuan/.legion/tasks/vendor-http-services-rollout/docs/pr-body-fix.md
- 阶段 C 完成：生成 report-walkthrough 与 PR body（fix 版本）。

### 🟡 进行中

- (暂无)

### ⚠️ 阻塞/待定

(暂无)

---

## 关键文件

- `/Users/c1/Work/Yuan/.legion/tasks/vendor-http-services-rollout/docs/rfc.md`
- `/Users/c1/Work/Yuan/.legion/tasks/vendor-http-services-rollout/docs/review-rfc.md`

---

## 关键决策

| 决策                                                                                                                 | 原因                                                                                                    | 替代方案                                                                     | 日期       |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------- |
| SUBTREE_ROOT 设为 apps/vendor-binance，用于本阶段仅改动 Binance 并形成迁移模板                                       | 用户要求先从 binance 验证通过再推广到其他 vendor，且主要变更集中在 Binance vendor 下的 HTTP client 封装 | 将 SUBTREE_ROOT 设为 apps/ 或 apps/vendor-\*（过大，易混入其他 vendor 修改） | 2026-01-29 |
| 初期不强制 labels，先完成 binance 迁移再评估分流需求                                                                 | 降低对代理节点配置的依赖，保证最小改动验证链路可用                                                      | 在第一阶段就强制 labels（需要运行环境同步改造）                              | 2026-01-29 |
| 在 client.ts 中直接 import { fetch } 覆盖本地 fetch 标识，不使用别名                                                 | 用户明确要求避免 alias，保持调用点语义直观                                                              | 使用 import { fetch as proxyFetch } 并替换调用                               | 2026-01-29 |
| client.ts 仅新增 `import { fetch } from '@yuants/http-services'`，不修改任何调用点                                   | 用户要求调用点不改，且 http-services fetch 内部可使用 Terminal.fromNodeEnv()                            | 显式替换调用点并传入 terminal 或 timeout                                     | 2026-01-29 |
| 进入阶段 B 后发现阻塞问题，暂停进入测试阶段                                                                          | 流程要求 blocking review 必须先修复并重跑 A+B                                                           | 忽略 blocking 直接进入测试（不符合门禁要求）                                 | 2026-01-30 |
| 测试与基准不新增用例，仅记录说明                                                                                     | 本轮变更仅涉及日志脱敏，不影响执行路径                                                                  | 新增日志相关单测/基准（非必须）                                              | 2026-01-30 |
| 暂停进入阶段 D，等待测试环境修复后重跑 B+C                                                                           | 流程要求测试通过才能进入报告阶段                                                                        | 跳过测试直接生成报告（不符合门禁）                                           | 2026-01-30 |
| 阶段 C 失败后回到阶段 A 修复依赖解析问题                                                                             | TypeScript 无法解析 @yuants/http-services，测试无法通过                                                 | 跳过测试继续报告（不符合流程）                                               | 2026-01-30 |
| 选择方案 1：http-services 缓存 `__yuantsNativeFetch` 并标记 proxy fetch；`USE_HTTP_PROXY=true` 时跳过 public IP 获取 | 修复递归同时明确代理边界；接口不变且可回滚                                                              | 方案 2：新增禁用 public IP 获取配置；方案 3：放弃全局 fetch 覆盖             | 2026-02-03 |

---

## 快速交接

**下次继续从这里开始：**

1. 运行 /legion-pr 创建 PR

**注意事项：**

- 可选：在 USE_HTTP_PROXY=true 的环境触发一次真实请求，确认无递归栈溢出。

---

_最后更新: 2026-02-03 by OpenCode_
