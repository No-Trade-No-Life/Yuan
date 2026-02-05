# http-services-terminalinfos-ready - 上下文

## 会话进展 (2026-02-05)

### ✅ 已完成

- 梳理 terminalInfos$ 生命周期：Terminal 在 \_setupTerminalInfoStuff() 先 GetTerminalInfos，确认 @host 后写入 terminalInfos 与 \_terminalInfos$；随后订阅 HostEvent(TERMINAL_CHANGE) 增量更新；首次 next 发生在 GetTerminalInfos 成功之后。
- 确认空池路径：selectHTTPProxyIpRoundRobin 同步读取 listHTTPProxyIps，依赖 terminal.terminalInfos；在 terminalInfos$ 首发前列表为空，直接抛 E_PROXY_TARGET_NOT_FOUND。
- 修订 RFC：补齐 terminalInfos$ 可用判定、空池/timeout 语义、错误结构、日志限频细节与调用点清单。
- 完成 RFC 对抗审查并形成必须修正/可选优化清单（见 review-rfc.md）。
- 完成本次对抗审查（聚焦空池/timeout、terminalInfos$ 判定、错误结构一致性、限频来源、调用点清单），更新 review-rfc.md。
- 按二次审查意见调整 RFC：移除 proxyCandidates 立即失败分支，空池统一等待到 timeout，并补齐限频常量来源与 benchmarks 调用点说明。
- 按三次审查意见修订 RFC：明确 timeout 覆盖语义、terminalInfos$ 判定条件、错误结构一致性与清单生成方法。
- 完成最新 RFC 对抗审查，阻塞项聚焦 timeout 成本说明、terminalInfos$ 判定统一、错误 payload 同构、限频常量来源、调用点清单生成方法。
- 补充 RFC：明确 timeout 语义成本说明（允许 timeoutMs=0/更短以快速失败），统一终端判定与错误 payload 约束。
- 完成本次对抗审查，聚焦空池/timeout 成本、terminalInfos$判定一致性、错误 payload 同构、限频常量来源、调用点清单方法。
- 补充 RFC：新增错误契约与运行策略段落，统一 terminalInfos$ 可用性定义，完善清单生成方法。
- 完成最新 RFC 对抗审查并输出 review-rfc.md（覆盖旧内容），逐条质疑必要性/假设/边界/复杂度/替代方案。
- 按最新审查补齐 timeoutMs 规范化规则与测试断言，修复 Observability 编号。
- 完成最新 RFC 对抗审查（.legion/tasks/http-services-terminalinfos-ready/docs/rfc.md），未发现必须修正项；仅给出可选优化建议。
- 记录审查结论：无必须修正项，允许通过；争议点仅为可选优化方向。
- 准备写入 review-rfc.md 覆盖旧内容。
- 尝试使用写入工具更新 review-rfc.md。
- 若写入工具可用，将覆盖 review-rfc.md。
- 准备直接使用 write 工具覆盖 review-rfc.md。
- 准备覆盖 review-rfc.md 内容以反映最新审查结论。
- 准备调用 write 工具（若可用）覆盖 review-rfc.md。
- 开始写入 review-rfc.md 新内容。
- RFC 对抗审查通过，未发现必须修正项。
- 设计阶段完成：RFC 与对抗审查已通过，等待用户确认进入实现。
- 按用户要求调整 RFC：等待超时固定 30 秒且接口无 options，调用点不传参。
- 完成本次对抗审查（聚焦固定 30 秒、错误语义、日志与迁移闭环），新增必须修正：补迁移验收闭环（rg/清单验证）；可选优化：调用点 guard 说明、empty_pool 日志策略。
- 修订 RFC：补充迁移验收闭环（rg 校验与调用点无参数约束）。
- 完成本轮 RFC 对抗审查：确认迁移验收闭环可执行且无必须修正项；仅保留可选优化建议。
- 对抗审查通过（固定 30 秒版本），无必须修正项。
- 最小验证：在 libraries/http-services 运行 `rushx build`（heft build+jest）。构建与测试通过；API Extractor 提示签名变更并更新 etc/http-services.api.md；有 TS/Node 版本兼容性警告但不影响本次通过。
- 实现：新增 http-services 异步 proxy ip 选择（固定 30s），并将 vendor 调用点改为 await 版本。
- 生成 code/security review 报告与 walkthrough/PR body。
- 已推送分支 `legion/http-services-terminalinfos-ready` 并创建 PR：https://github.com/No-Trade-No-Life/Yuan/pull/2565。

### ⚠️ 阻塞/待定

(暂无)

---

## 关键文件

- `.legion/tasks/http-services-terminalinfos-ready/docs/rfc.md`

---

## 关键决策

| 决策                                                                                                                                                                   | 原因                                                                                                                               | 替代方案                                                      | 日期       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------- |
| 就绪判断以 terminalInfos$ 首发为准，空池发生在 GetTerminalInfos 尚未返回时。                                                                                           | terminalInfos$ 是 ReplaySubject，只有 GetTerminalInfos 成功后才首发；此前 terminal.terminalInfos 为空，导致同步 round-robin 失败。 | 仅依赖 terminal.terminalInfos 当前值（会出现空池）            | 2026-02-05 |
| 方案 A 在 http-services 提供异步选择 helper；调用点改为 await 等待就绪后再选 ip。                                                                                      | 同步 API 无法等待 terminalInfos$ 首发，导致启动阶段失败；异步 helper 可统一等待逻辑并复用 servicesReady 语义。                     | 在各 app 入口统一等待 terminalInfos$ 首发（容易遗漏、耦合强） | 2026-02-05 |
| timeoutMs 默认 10_000，超时统一抛 E_PROXY_TARGET_NOT_FOUND（reason=timeout）并记录最小日志。                                                                           | 启动阶段偶发延迟可被容忍；统一错误便于调用方处理。                                                                                 | 细分新错误码或返回空值                                        | 2026-02-05 |
| 空池与超时统一错误码，但通过 reason 区分 empty_pool/timeout。                                                                                                          | 兼容现有处理逻辑，同时保留定位信息。                                                                                               | 维持无 reason 字段                                            | 2026-02-05 |
| 超时日志限频复用现有 log interval 机制。                                                                                                                               | 避免高频噪音并保持可观测性。                                                                                                       | 每次超时都记录                                                | 2026-02-05 |
| timeoutMs <= 0 视为立即超时；超时错误使用 newError('E_PROXY_TARGET_NOT_FOUND', { reason, terminal_id, timeoutMs }) 并按 terminal_id 限频日志（interval=3_600_000ms）。 | 统一错误结构便于调用侧区分 reason，并控制高频日志噪音。                                                                            | 不记录 reason 或每次超时都记录日志                            | 2026-02-05 |
| 空池语义定义为 terminalInfos$ 不可用或 proxyCandidates 为空；proxyCandidates 非空但 ip pool 为空则进入等待并可能超时。                                                 | 区分“无代理终端配置”与“代理已存在但 ip 尚未就绪”的场景，避免误判。                                                                 | 首发后 ip 仍为空立即 empty_pool                               | 2026-02-05 |
| 完成 RFC 对抗审查并输出 review-rfc.md                                                                                                                                  | 依据奥卡姆剃刀逐条质疑空池/timeout 语义、terminalInfos$ 可用性、错误结构与日志限频、调用点清单完整性；形成必须修正与可选优化清单。 | 无                                                            | 2026-02-05 |
| 空池语义收敛：仅在 terminalInfos$ 不可用时返回 empty_pool，其余空池一律等待至 timeout。                                                                                | 避免假设 proxyCandidates 稳定性，统一等待语义与可验证性。                                                                          | 首发后 proxyCandidates 为空立即 empty_pool                    | 2026-02-05 |
| timeout 语义明确为“等待窗口内未出现任何可用 ip（含未就绪与无代理）”，empty_pool 仅用于 terminalInfos$ 不可用的防御分支。                                               | 避免对“无代理”与“未就绪”做不可验证假设，减少语义歧义。                                                                             | 空池单独立即失败或引入更细 reason                             | 2026-02-05 |
| 允许调用点通过 timeoutMs 控制等待成本，含 timeoutMs=0 快速失败策略。                                                                                                   | 在无代理配置场景下避免每次等待到默认超时，降低启动成本。                                                                           | 维持固定默认超时                                              | 2026-02-05 |
| terminalInfos$ 可用性判定统一为 `terminal.terminalInfos$ != null` 且 `typeof terminal.terminalInfos$?.subscribe === 'function'`。                                      | 提供唯一实现与可测试判断，避免 pipe/subscribe 口径不一致。                                                                         | 删除该分支并将空池归入 timeout                                | 2026-02-05 |
| 所有失败路径统一错误契约 `newError('E_PROXY_TARGET_NOT_FOUND', { reason, terminal_id, timeoutMs })`，terminal_id 缺失统一写入 'unknown'。                              | 保证错误 payload 同构、测试断言稳定。                                                                                              | 各分支使用不同字段或消息字符串                                | 2026-02-05 |
| 运行策略：USE_HTTP_PROXY=true 默认等待 10s；无代理配置时允许调用点传 timeoutMs=0/更短以快速失败。                                                                      | 控制无代理环境下的等待成本。                                                                                                       | 固定等待默认超时                                              | 2026-02-05 |
| 等待超时固定 30_000ms 且不可配置，异步接口无 options 参数，错误 payload 中 timeoutMs 固定为 30_000。                                                                   | 避免调用点配置漂移与不一致等待成本，保证协议简单可审。                                                                             | 保留 timeoutMs 参数或改为环境配置                             | 2026-02-05 |
| 对抗审查结论：历史必修项已在 RFC 中覆盖，但新增阻塞项为 timeoutMs 合理性校验缺乏可执行边界，需修订后方可闭环。                                                         | RFC 出现 MUST 校验 timeoutMs 合理性但未给出数值范围/处理策略，导致不可实现与不可验证。                                             | 删除该 MUST 条款或将其降级为可选指导。                        | 2026-02-05 |
| timeoutMs 在内部规范化为有限非负值（NaN/Infinity/负数 -> 0），并在错误 payload 中使用规范化值。                                                                        | 提供可执行边界，避免实现分歧。                                                                                                     | 删除 timeoutMs 合理性校验条款                                 | 2026-02-05 |
| 完成最新 RFC 对抗审查（基于 .legion/tasks/http-services-terminalinfos-ready/docs/rfc.md），结论无必须修正项，允许推进。                                                | timeoutMs 规范化规则已补齐，错误契约、terminalInfos$ 判定与限频细节可实现且可验证。                                                | 继续保留阻塞并要求新增上限策略                                | 2026-02-05 |
| 用户已确认进入实现阶段（并要求 timeout 固定 30 秒）。                                                                                                                  | 用户明确指令“动手实现”，视为设计批准。                                                                                             | 等待显式文字确认                                              | 2026-02-05 |

---

## 快速交接

**下次继续从这里开始：**

1. 如需纳入非 Scope 文件（.legion 任务文档、SESSION_NOTES 等），请明确确认是否纳入 PR。

**注意事项：**

- 当前 PR 仅包含 Scope 内代码与 http-services API Extractor 输出。

---

_最后更新: 2026-02-05 21:24 by Claude_
