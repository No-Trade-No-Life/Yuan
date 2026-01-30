# node-unit-claim-policy-deployment-type - 上下文

## 会话进展 (2026-01-30)

### ✅ 已完成

- 已读取 node-unit 调度逻辑与抢占实现（apps/node-unit/src/scheduler.ts）。
- 已确认 deployment 表结构与 address 字段位置（tools/sql-migration/sql/deployment.sql）。
- 已确认 IDeployment 类型定义（libraries/deploy/src/index.ts）。
- 已阅读 apps/node-unit/AGENTS.md 与 SESSION_NOTES.md 当前阶段指令。
- 已输出可评审 RFC（docs/rfc-node-unit-claim-policy.md）。
- 完成 RFC 对抗审查，发现阻塞项：none 策略边界未定义、daemon 依赖活跃列表与唯一性键不清、混合版本缺少门禁、ERR_DAEMON_MISSING 触发点不明。
- 已执行 review-rfc 对抗审查并生成审查报告（docs/review-rfc.md）。
- 已按审查意见修订 RFC：明确 policy=none 禁止任何 address 写入路径、daemon 本地唯一性规则、混部回滚约束与错误语义。
- 完成修订后 RFC 对抗审查，结论无阻塞项；可选优化聚焦于 DB 约束与 daemon 启动速率。
- 已完成修订后 RFC 的对抗审查，审查通过（docs/review-rfc.md）。
- 已完成审查阻塞项对应的 RFC 修订并在 tasks.md 标记完成。
- 用户已确认 RFC 设计，允许进入实现阶段。
- 实现 NODE_UNIT_CLAIM_POLICY=none 跳过抢占并记录可观测日志，避免写入 deployment.address。
- 调度逻辑识别 deployment.type=daemon/deployment，daemon 不参与抢占且 address 异常写入会记录错误。
- 本地执行器按 deployment.type 过滤：daemon 按 enabled 运行且忽略 address，deployment 保持 address 绑定。
- 补充 scheduler 单元测试与文档/SQL/类型定义更新。
- 已完成工程实现（apps/node-unit, libraries/deploy, sql-migration）。
- 已通过 review-code 与 review-security。
- 已通过 run-tests（单元测试与构建）。
- 已生成 docs/report-walkthrough.md 与 docs/pr-body.md。
- Executed specific test suite: apps/node-unit/src/scheduler.test.ts (via lib/scheduler.test.js) - PASS (28 tests)
- 已完成工程实现（apps/node-unit, libraries/deploy, sql-migration）。
- 已通过 review-code 与 review-security。
- 已通过 run-tests（单元测试与构建）。
- 已生成 docs/report-walkthrough.md 与 docs/pr-body.md。
- 修复 yuanctl 测试代码中的 IDeployment mock 数据，补充 type: 'deployment'
- Verified fix with rush build -t @yuants/tool-yuanctl
- 已完成工程实现（apps/node-unit, libraries/deploy, sql-migration）。
- 已通过 review-code 与 review-security。
- 已通过 run-tests（单元测试与构建）。
- 已生成 docs/report-walkthrough.md 与 docs/pr-body.md。
- 已修复 yuanctl 构建错误并更新报告。

### 🟡 进行中

(暂无)

### ⚠️ 阻塞/待定

(暂无)

---

## 关键文件

- docs/rfc-node-unit-claim-policy.md
- apps/node-unit/src/scheduler.ts
- apps/node-unit/src/index.ts
- tools/sql-migration/sql/deployment.sql
- libraries/deploy/src/index.ts

---

## 关键决策

| 决策                                                                          | 原因                                                                                                             | 替代方案                                           | 日期       |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------- |
| RFC 输出路径暂定为 docs/rfc-node-unit-claim-policy.md                         | 与 node-unit 相关需求集中且便于检索                                                                              | 放在 docs/rfc.md（通用路径）                       | 2026-01-30 |
| daemon 采用“每个启用记录在每个 node-unit 启动一个实例”，不写入 address        | 满足每节点至少一个且避免 address 绑定/抢占复杂度                                                                 | 为 daemon 新增独立表或用 address 绑定 + 标签选择器 | 2026-01-30 |
| NODE_UNIT_CLAIM_POLICY=none 时仅跳过 claim/assign，不停止调度循环             | 避免影响现有周期性指标与可观测性                                                                                 | 直接停调度或禁用整个调度模块                       | 2026-01-30 |
| 混部阶段 daemon 必须保持 enabled=false，回滚前需禁用或转换为 deployment       | 避免旧版本错误抢占 daemon 记录                                                                                   | 仅依赖流程说明而不作显式约束                       | 2026-01-30 |
| 进入实现阶段                                                                  | 用户确认 RFC 设计并要求开始实现                                                                                  | 等待进一步设计澄清                                 | 2026-01-30 |
| invalid deployment.type 与 daemon address 非空时仅记录错误并跳过/忽略 address | 符合 RFC 错误语义（ERR_INVALID_TYPE/ERR_DAEMON_ADDRESS_SET），避免错误数据影响调度                               | 对异常记录直接抛错中断调度循环                     | 2026-01-30 |
| Run tests via heft with simpler pattern                                       | heft test does not support --runTestsByPath directly, so used --test-path-pattern with filename match on lib/    | Use full path to lib file                          | 2026-01-30 |
| Regenerate Walkthrough Report and PR Body                                     | User requested update to include test passing results explicitly.                                                | -                                                  | 2026-01-30 |
| 记录 yuanctl 构建失败并阻断交付                                               | IDeployment 类型变更导致 yuanctl 测试代码 mock 数据类型不匹配，虽然 node-unit 测试通过，但破坏了仓库级构建一致性 | -                                                  | 2026-01-30 |
| 修复 yuanctl 测试代码中的 IDeployment mock 数据                               | IDeployment 类型新增 type 字段导致 yuanctl 构建失败，需补充 mock 数据以维持仓库构建一致性                        | -                                                  | 2026-01-30 |

---

## 快速交接

**下次继续从这里开始：**

1. 运行 /legion-pr 提交代码。

**注意事项：**

- 实现、测试、审查、额外修复（yuanctl）均已 PASS，报告已更新。

---

_最后更新: 2026-01-30 19:37 by Claude_
