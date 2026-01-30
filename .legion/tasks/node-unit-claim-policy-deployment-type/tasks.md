# node-unit-claim-policy-deployment-type - 任务清单

## 快速恢复

**当前阶段**: (unknown)
**当前任务**: (none)
**进度**: 7/7 任务完成

---

## 阶段 1: 调研 🟡 IN PROGRESS

- [x] 阅读 node-unit 调度与 deployment 表结构，梳理当前抢占/地址绑定/失联处理的关键路径与边界。 | 验收: context.md 记录现状流程、关键 SQL 与调度决策点。

---

## 阶段 2: 设计 🟡 IN PROGRESS

- [x] 输出 RFC：新增 claim policy=none 的行为、deployment.type 语义、daemon 与 deployment 的调度/抢占/地址绑定规则、迁移策略与回滚。 | 验收: docs/rfc-node-unit-claim-policy.md 完成并可评审。

---

## 阶段 3: 设计审查 🟡 IN PROGRESS

- [x] 对 RFC 做对抗审查并收敛问题。 | 验收: review-rfc 通过或给出修订点并迭代。

---

## 阶段 4: 门禁确认 🟡 IN PROGRESS

- [x] 将 RFC 链接写入 plan.md 并请求用户确认设计。 | 验收: 用户确认后进入实现阶段。

---

## 阶段 5: 实现 🟢 DONE

- [x] 实现 NODE_UNIT_CLAIM_POLICY=none 与 deployment.type/daemon 调度/执行逻辑，并同步 SQL/类型定义/文档。 | 验收: none 不写入 address，daemon 按 enabled 在每节点启动，SQL/类型/文档一致。

---

## 阶段 6: 测试 🟢 DONE

- [x] 补充 scheduler 单元测试覆盖 deployment.type/claim policy none 关键路径。 | 验收: scheduler.test.ts 覆盖 daemon 忽略与 SQL 过滤/大小写策略。

---

## 阶段 7: Reporting 🟢 DONE

- [x] Generate Walkthrough Report and PR Body | 验收: Generate docs/report-walkthrough.md and docs/pr-body.md

---

## 发现的新任务

(暂无)

- [x] 修订 RFC：明确 NODE_UNIT_CLAIM_POLICY=none 下所有 address 写路径均禁止（含回收/重分配/清理）与未绑定行为 | 来源: RFC 对抗审查阻塞项
- [x] 修订 RFC：将 daemon 调度改为本地启停并明确唯一性键（建议 deployment.id），取消对活跃列表的依赖 | 来源: RFC 对抗审查阻塞项
- [x] 修订 RFC：增加混合版本门禁/校验方案，避免旧版本误抢占 daemon | 来源: RFC 对抗审查阻塞项
- [x] 修订 RFC：明确 ERR_DAEMON_MISSING 的触发点（本地检测）或删除该错误码 | 来源: RFC 对抗审查阻塞项
- [x] 修复 yuanctl 测试代码：在 cli-commands.test.ts 的 IDeployment mock 数据中补充 type 字段 | 来源: Integration Test (rush build @yuants/tool-yuanctl)

---

_最后更新: 2026-01-30 19:37_
