# node-unit-daemon-deployment-design-refresh - 上下文

## 会话进展 (2026-02-06)

### ✅ 已完成

- 阅读 `apps/node-unit/AGENTS.md` 与 `apps/node-unit/SESSION_NOTES.md`，确认当前约束（稳定性优先、信任包、指标标签、子进程管理）。
- 阅读既有 RFC `.legion/tasks/node-unit-claim-policy-deployment-type/docs/rfc-node-unit-claim-policy.md`，梳理 daemon/deployment 语义与迁移策略。
- 阅读 `apps/node-unit/src/scheduler.ts` / `apps/node-unit/src/index.ts` / `apps/node-unit/src/scheduler.test.ts`，确认当前实现：daemon 不参与 claim、每节点拉起、SQL 查询规则与 address 绑定逻辑。
- 阅读 `tools/sql-migration/sql/deployment.sql` 与 node-unit 文档（`apps/node-unit/README.md`、`docs/zh-Hans/packages/@yuants-node-unit.md`），确认表结构与对外说明保持一致。
- 生成改进设计 RFC：`.legion/tasks/node-unit-daemon-deployment-design-refresh/docs/rfc.md`。
- 完成 RFC 对抗审查并生成 `.legion/tasks/node-unit-daemon-deployment-design-refresh/docs/review-rfc.md`，结论不可通过（需修订后再审）。
- 再次对抗审查更新版 RFC，结论仍不可通过（must-fix：lease/heartbeat 写路径职责冲突、Draining 下续租控制缺失）。
- 按审查意见修订 RFC：明确 lease/heartbeat 唯一写路径、续租前置条件与 `Paused/Draining` 行为，更新职责边界与幂等规则。
- 再审修订版 RFC，结论不通过（must-fix：state 写入责任与触发条件、feature flag 覆盖执行器路径、执行器 state 校验规则）。
- 修订 RFC：明确 state 迁移的调度器 CAS 规则、feature flag 覆盖执行器路径，以及执行器对 `state` 的过滤与续租前置条件。
- 完成最新 RFC 对抗审查（结论不通过），阻塞项集中在 daemon selector 回滚语义、唯一索引类型限定与 upsert 条件的“当前节点”语义。
- 修订 RFC：移除 `Pending`、明确 assignment 创建为 `Assigned`，增加 `desired_replicas=1` gate，补齐 `exit_reason` 写入与回滚/执行器过滤规则。
- 完成最新 RFC 对抗审查（结论仍不通过），新增 must-fix：daemon selector 回滚语义、索引约束类型限定、调度器 upsert 条件明确
- 修订 RFC：补充 daemon selector 回滚 gate、唯一索引部分索引约束、调度器 upsert 目标 node_id 语义与 CAS 条件。
- 完成最新版本 RFC 对抗审查，结论不通过（新增 must-fix：节点标签来源/一致性定义、lease 续租职责冲突）。
- 修订 RFC：定义 selector 的节点标签权威来源/更新语义，并移除调度器续租路径（daemon 调度仅校验、不续租）。
- 对最新修订 RFC 进行对抗审查，结论不通过（must-fix：deployment selector 语义缺失、节点活跃/标签 TTL 未定义、clock_skew_seconds 未定义、回滚收敛判定不可验证）。
- 对最新修订 RFC 进行对抗审查，结论不通过（must-fix：lease/heartbeat 时间源未定义、daemon paused 语义缺失、replica_index 复用规则缺失）。
- 修订 RFC：明确 deployment selector 语义（仅 daemon）、补充节点活跃 TTL 与 `NODE_UNIT_ACTIVE_TTL_SECONDS`、定义 `clock_skew_seconds` 配置来源，并给出回滚收敛判定条件。
- 对最新修订 RFC 进行对抗审查，结论不通过（must-fix：时间源未定义、daemon 的 paused 语义缺失、replica_index 与 Draining 复用规则冲突）。
- 修订 RFC：统一时间源为数据库 `db_now`，定义 daemon `paused` 行为，并补充 `replica_index` 复用规则。
- 对最新版 RFC 完成对抗审查并覆盖输出 `.legion/tasks/node-unit-daemon-deployment-design-refresh/docs/review-rfc.md`，结论 FAIL（不通过）。
- 按审查意见修订 RFC：回滚语义收敛为 flag-off 单步回滚并定义兼容降级告警；收敛 R32 租约规则为“Draining 仅在 lease 过期后复用”；将指标契约分层为实例级/控制器级并修正 R56 与测试断言。
- 对最新 RFC 进行新一轮对抗审查并覆盖输出 `.legion/tasks/node-unit-daemon-deployment-design-refresh/docs/review-rfc.md`，结论 FAIL（不通过）；新增 must-fix 聚焦于 deployment selector 目标冲突、迁移写路径冲突、R44 晚到 heartbeat 判定不可执行。
- 修订 RFC：收敛目标边界（deployment 仅 `desired_replicas`，selector 仅 daemon）、收敛迁移写路径为新表主写+address 异步派生、将 R44 改为基于更新前记录的可执行 CAS 条件。
- 再次完成 RFC 对抗审查并覆盖 `.legion/tasks/node-unit-daemon-deployment-design-refresh/docs/review-rfc.md`，结论 FAIL（不通过）；新增 must-fix：回滚等价性缺失、新旧路径 fencing 缺失、多副本目标与 gate 未分阶段。
- 修订 RFC：将多副本能力拆分为 Phase A/B，新增 Phase B 解锁条件；补充共存期 fencing 规则（assignment/address 单一生效源）；将 R55 回滚收敛为硬门禁（selector 非空拒绝回滚）。
- 对最新版 RFC 再次完成对抗审查并覆盖输出 `.legion/tasks/node-unit-daemon-deployment-design-refresh/docs/review-rfc.md`，结论 FAIL（不通过）；新增 must-fix 聚焦于 Phase B 多副本回滚等价性与共存期开关切换的全局收敛判定。
- 修订 RFC：新增 Phase B 回滚阻断（`E_ROLLBACK_BLOCKED_REPLICAS`）与开关切换全局收敛门禁（`scheduler_mode_generation` + `E_MODE_SWITCH_NOT_CONVERGED`）。
- 对最新 RFC 再做一轮对抗审查并覆盖输出 `.legion/tasks/node-unit-daemon-deployment-design-refresh/docs/review-rfc.md`，结论 FAIL；新增 must-fix 聚焦于 R29 旧表兜底与 fencing 冲突、R59 代际上报协议缺口、`E_ROLLBACK_BLOCKED_SELECTOR` 错误语义缺失。
- 修订 RFC：收敛 R29 读取策略（`flag=off` 才读旧表，`flag=on` 禁止旧表兜底启动）；补齐 R59 代际上报协议（载体/频率/失联摘除）；在错误语义中注册 `E_ROLLBACK_BLOCKED_SELECTOR`。
- 对最新 RFC 再次进行对抗审查并覆盖输出 `.legion/tasks/node-unit-daemon-deployment-design-refresh/docs/review-rfc.md`，结论 FAIL；新增 must-fix 聚焦于回滚前 `address` 派生收敛门禁缺失、R59 代际上报通道与“无 assignment 活跃节点”边界冲突。
- 修订 RFC：新增回滚前 `address` 派生收敛门禁与错误码 `E_ROLLBACK_NOT_CONVERGED_ADDRESS`；将 `scheduler_mode_generation` 上报解耦为 node 级心跳并覆盖“活跃但无 assignment 节点”场景。
- 对最新 RFC 完成对抗审查并覆盖 `.legion/tasks/node-unit-daemon-deployment-design-refresh/docs/review-rfc.md`，结论 FAIL；新增 must-fix：R55 回滚收敛判定不可验证、R59 全活跃节点门禁为滑动集合、过期判定双真值源导致重调度语义不唯一。
- 修订 RFC：回滚门禁新增机器可执行收敛判定（含派生函数与 SQL 语义）；R59 改为冻结 `switch_cohort` 门禁；过期判定收敛为仅 `lease_expire_at` 真值，`heartbeat_at` 仅用于观测。
- 对最新 `.legion/tasks/node-unit-daemon-deployment-design-refresh/docs/rfc.md` 完成再次对抗审查，并覆盖输出 `.legion/tasks/node-unit-daemon-deployment-design-refresh/docs/review-rfc.md`（结论 FAIL）。
- 修订 RFC：R44 续租放行边界与 R14 统一为 `lease_expire_at >= db_now`；R55 收敛判定仅统计有效 assignment（含 `lease_expire_at >= db_now`）；R59 新增 `switch_state` 持久化与重启恢复语义。
- 对最新 `.legion/tasks/node-unit-daemon-deployment-design-refresh/docs/rfc.md` 完成对抗审查并覆盖输出 `.legion/tasks/node-unit-daemon-deployment-design-refresh/docs/review-rfc.md`，结论 FAIL。
- 修订 RFC：新增 Phase A 运行期硬门禁 `E_PHASE_B_REQUIRED`；R55 回滚收敛判定改为“恰好 1 条有效 assignment”可执行规则；R59 增加 `switch_state` pending 全局唯一与 `E_MODE_SWITCH_IN_PROGRESS` 并发互斥语义。
- 对最新 `.legion/tasks/node-unit-daemon-deployment-design-refresh/docs/rfc.md` 完成再一轮对抗审查并覆盖 `review-rfc.md`，结论 FAIL；新增 must-fix：R59 代际切换闭环缺口、R55 回滚遗漏 paused 语义。
- 修订 RFC：R59 明确“target_generation 下发 + node 侧 applied_generation 回传 + cohort 确认”闭环；R55 增加 `enabled=true && paused=true` 回滚阻断（`E_ROLLBACK_BLOCKED_PAUSED`）。
- 对最新 `.legion/tasks/node-unit-daemon-deployment-design-refresh/docs/rfc.md` 完成新一轮对抗审查并覆盖输出 `.legion/tasks/node-unit-daemon-deployment-design-refresh/docs/review-rfc.md`，结论 FAIL；新增 must-fix 聚焦于 R59 代际字段与下发/回传链路未收敛为单一真值。
- 修订 RFC：R59 语义减法完成，统一代际字段为 `applied_generation`，移除 `scheduler_mode_generation` 残留，并补充 node 读取 `switch_state.target_generation` 的唯一下发路径。
- 对最新版 `.legion/tasks/node-unit-daemon-deployment-design-refresh/docs/rfc.md` 完成对抗审查并覆盖 `.legion/tasks/node-unit-daemon-deployment-design-refresh/docs/review-rfc.md`，结论 PASS（可进入门禁）。
- 对当前最新 RFC 完成对抗审查并覆盖 `.legion/tasks/node-unit-daemon-deployment-design-refresh/docs/review-rfc.md`，结论 PASS（可进入门禁）。
- RFC 对抗审查最新结论为 PASS（可进入门禁），设计已收敛。
- 用户明确要求“接着 RFC 完成实现和端到端测试”，视为已批准设计并进入实现阶段。

### 🟡 进行中

- 实现 `deployment_assignment` + lease/heartbeat 调度与执行器读取路径。
- 规划并执行单测、E2E 与后续 review/report 闭环。
- 已落地第一轮代码骨架：`libraries/deploy/src/index.ts` 扩展 deployment/assignment 类型，`tools/sql-migration/sql/deployment.sql` 增加 assignment 表与索引，`apps/node-unit/src/scheduler.ts` 切到 assignment/selector/rollback gate/Phase A gate 主流程，`apps/node-unit/src/scheduler.test.ts` 改写为覆盖 selector/fencing/gate/lease 关键语义。
- 当前正在收敛 `apps/node-unit/src/index.ts` 执行器路径：flag on/off、assignment fencing、heartbeat 续租、node 级 `applied_generation` 上报。
- `apps/node-unit/src/index.ts` 已接入双路径执行：flag on 走 assignment 查询与 lease CAS 续租，flag off 保留旧 address/daemon 路径并对有效 assignment 做 fencing；同时增加 `node_unit_assignment_running` 指标与 node 级 `applied_generation` tags 心跳。
- 已执行 `rush build --to @yuants/node-unit`，结果通过；期间 `libraries/deploy/etc/deploy.api.md` 被 API Extractor 自动改写为 scope 外产物，已恢复到仓库版本，保持本轮仅提交 scope 内代码与文档。

### ⚠️ 阻塞/待定

- (暂无)

---

## 关键文件

- `.legion/tasks/node-unit-daemon-deployment-design-refresh/docs/rfc.md`：改进设计主文档。
- `.legion/tasks/node-unit-daemon-deployment-design-refresh/docs/review-rfc.md`：对抗审查报告。

---

## 关键决策

| 决策                                                                                                                                                                                      | 原因                                                                                                                                                   | 替代方案                                                                                           | 日期       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ---------- |
| RFC 输出路径固定为 `.legion/tasks/node-unit-daemon-deployment-design-refresh/docs/rfc.md`，对抗审查输出为 `.legion/tasks/node-unit-daemon-deployment-design-refresh/docs/review-rfc.md`。 | 遵循任务目录统一归档，便于设计门禁与后续审查引用。                                                                                                     | 放在仓库 `docs/` 根目录下单独命名的 RFC 文件。                                                     | 2026-02-06 |
| 引入 lease/heartbeat 作为调度主约束，deployment 与 daemon 分离调度策略。                                                                                                                  | 提升容错与幂等性，降低 address 绑定带来的悬挂与误重启风险。                                                                                            | 继续沿用 address claim + 仅靠 enabled 查询的方案。                                                 | 2026-02-06 |
| 增加 desired_replicas/selector 语义并保持 trust package 机制不变。                                                                                                                        | 支持扩缩容与安全升级的可审查路径，同时维持既有信任边界。                                                                                               | 直接将 daemon 视作 deployment 的特例，不新增字段。                                                 | 2026-02-06 |
| 对更新后的 RFC 进行再审，结论不通过（不可进入门禁）。                                                                                                                                     | Assignment 状态迁移写入责任不一致、回滚开关未覆盖执行器路径、Draining 处理规则缺少执行入口，导致不可验证/不可回滚。                                    | 在明确单一写入责任、回滚开关范围与执行器 state 校验规则后再复审。                                  | 2026-02-06 |
| 当前 RFC 仍不可进入门禁，需修订后再审。                                                                                                                                                   | 存在状态机与数据模型语义冲突、回滚与多副本不兼容、Draining 退出路径不清晰、执行器 state 校验缺口。                                                     | 明确 Pending/NULL 语义或移除 Pending；限制新调度启用条件；补齐 exit_reason 写入与 state 过滤规则。 | 2026-02-06 |
| 本轮 RFC 审查结论维持不通过，先收敛回滚一步化、租约单一规则、指标分层契约三项再复审。                                                                                                     | 三项冲突均属于规范内互斥，若不先收敛将导致实现分叉、测试不可判定或回滚不可演练。                                                                       | 继续带冲突进入实现后再靠代码约定收敛，但会把设计问题后移为线上风险。                               | 2026-02-06 |
| 本轮审查维持不通过，必须先消除目标/模型冲突、迁移写路径冲突与 R44 判定空缺。                                                                                                              | 三项问题均直接影响可实现/可验证/可回滚门槛，继续进入实现会把设计分歧转化为线上行为不一致风险。                                                         | 带着歧义进入实现后再在代码中约定，但会导致测试标准不统一和回滚演练不可重复。                       | 2026-02-06 |
| 本轮 RFC 审查维持不通过，必须先补齐回滚等价性、新旧路径防重入 fencing、以及多副本能力分阶段验收。                                                                                         | 三项问题分别对应可回滚/可实现/可验证门槛，任何一项缺失都会导致实现行为不可控或验收口径分裂。                                                           | 带着歧义直接进入实现，再通过代码约定兜底；但会把设计问题后移为线上风险并增加回滚成本。             | 2026-02-06 |
| 本轮 RFC 审查维持不通过，必须先补齐 Phase B 多副本回滚阻断规则与开关切换全局收敛判定。                                                                                                    | 两项问题分别对应可回滚与可验证门槛；若不先收敛，会在开关切换窗口产生语义降级或双来源判定风险。                                                         | 带着歧义进入实现并依赖运行时兜底，但会导致回滚演练不可重复且测试口径不一致。                       | 2026-02-06 |
| 本轮 RFC 审查继续维持不通过，先做语义减法与协议补齐再进入下一轮。                                                                                                                         | 当前仍存在单一真值源冲突（R29 vs R58）、代际门禁不可执行（R59 缺少上报协议）和错误语义不完整（R55 引用未注册错误码），不满足可实现/可验证/可回滚门槛。 | 带着缺口进入实现，后续通过代码约定兜底；但会导致切换与回滚路径不可重复验证，线上风险上移。         | 2026-02-06 |
| 本轮 RFC 审查维持不通过，必须先补齐回滚可用性门禁与代际上报通道边界。                                                                                                                     | 当前规范在回滚切换与代际确认两处仍存在可实现/可验证/可回滚缺口，直接进入实现会导致切换窗口行为不可预测。                                               | 保持现状并在实现中临时兜底；但会将设计歧义转移到运行时并抬高回滚风险。                             | 2026-02-06 |
| 本轮 RFC 审查维持不通过，先将回滚/切换/过期三类门禁收敛为单一可执行判定再进入下一轮。                                                                                                     | 当前三类门禁均存在实现口径分叉或集合漂移问题，不满足可实现/可验证/可回滚门槛。                                                                         | 带着歧义进入实现后在代码中约定；但会造成测试与回滚演练不可重复。                                   | 2026-02-06 |
| 本轮 RFC 评审结论继续不通过，优先以最小复杂度收敛时间边界、回滚判定与切换门禁持久化。                                                                                                     | 三项问题分别对应可实现/可验证/可回滚硬门槛，若不先收敛会导致续租/回收竞态、回滚误放行与切换不可复现。                                                  | 带着当前歧义进入实现并依赖运行时兜底，但会抬升线上分叉风险并降低回滚演练可重复性。                 | 2026-02-06 |
| 本轮 RFC 审查继续不通过，先以最小复杂度补齐 Phase A 持续 gate、R55 异常唯一性判定与 R59 并发切换互斥。                                                                                    | 三项分别对应可实现、可回滚/可验证、可回滚门槛；任一缺失都会导致运行时语义漂移或门禁不可复现。                                                          | 带着当前缺口进入实现并依赖操作约束串行化，但会导致测试不可稳定复现且切换风险上移。                 | 2026-02-06 |
| 本轮 RFC 审查继续不通过，优先以最小复杂度补齐 R59 下发-确认-切换闭环与 R55 paused 回滚等价性。                                                                                            | 两项分别对应可实现/可验证与可回滚硬门槛；缺失会导致切换门禁不可落地或回滚触发隐式重启。                                                                | 带着缺口进入实现并依赖操作规程兜底；但会造成切换行为不可复现并放大回滚风险。                       | 2026-02-06 |
| 本轮 RFC 审查维持不通过，先以最小复杂度收敛 R59 代际字段与传输链路，再进入下一轮。                                                                                                        | 当前 `applied_generation` 与 `scheduler_mode_generation` 并存且下发路径未单一化，不满足可实现/可验证门槛。                                             | 带着字段与链路歧义进入实现并在代码约定收敛；但会导致联调分叉与门禁判定不稳定。                     | 2026-02-06 |
| 本轮 RFC 对抗审查通过，设计满足可实现/可验证/可回滚门槛，可进入实现门禁。                                                                                                                 | 此前 R59 代际单一真值与下发/回传闭环缺口已收敛；当前协议已具备可执行判定与回滚阻断门禁。                                                               | 继续追加非阻塞优化后再进入实现；但这些项不影响门禁通过。                                           | 2026-02-06 |
| 本轮 RFC 审查通过，进入设计门禁；仅保留低风险可选优化（clock_skew 语义收敛、selector 输入预处理、R55 失败分类映射）。                                                                     | 当前协议已满足可实现/可验证/可回滚三项硬门槛，继续阻塞将引入无必要等待成本。                                                                           | 继续要求新增 must-fix 后再进入实现；但本轮未发现阻断级缺口，收益低于延迟成本。                     | 2026-02-06 |

---

## 快速交接

**下次继续从这里开始：**

1. 如需继续推进，可补端到端脚本验证真实 assignment 表切换与回滚门禁。
2. 若要对外发布，再单独处理 `libraries/deploy/etc/deploy.api.md` 等自动生成产物与变更流程。
3. review/report 暂不生成（本轮用户已明确不要）。

**注意事项：**

- 用户已批准设计，本任务已进入实现阶段。

---

_最后更新: 2026-03-23 00:00 by OpenCode_
