# node-unit-daemon-deployment-design-refresh

TITLE: Node-Unit 调度与 Deployment/Daemon 改进设计 RFC
SLUG: node-unit-daemon-deployment-design-refresh

## 目标

审视并改进 node-unit 的 daemon 与 deployment 调度设计，结合社区最佳实践给出可实施的新方案。

## 要点

- 梳理当前 node-unit 调度与 deployment/daemon 语义、状态机、抢占与 address 绑定规则
- 对照社区最佳实践评估不足点（容错、扩缩容、幂等、租约/心跳、升级安全、观测）
- 输出改进版设计：数据模型/状态机/调度流程/失败恢复/兼容迁移
- 明确设计门禁与验证策略（最小仿真/测试）

## 设计真源

- RFC: `.legion/tasks/node-unit-daemon-deployment-design-refresh/docs/rfc.md`

## 摘要

- 核心流程：以 controller loop + lease/heartbeat 为主线，分离 deployment/daemon 调度，并引入期望副本与选择器语义
- 接口变更：扩展 deployment 数据模型（lease/heartbeat/selector/desired_replicas），node-unit API/README 文档同步说明
- 文件变更：`apps/node-unit/src/scheduler.ts`、`apps/node-unit/src/index.ts`、`apps/node-unit/src/scheduler.test.ts`、`apps/node-unit/etc/node-unit.api.md`、`apps/node-unit/README.md`、`docs/zh-Hans/packages/@yuants-node-unit.md`、`libraries/deploy/src/**`、`tools/sql-migration/sql/deployment.sql`
- 验证策略：最小回归 + 仿真（租约过期、扩缩容、混部、回滚路径）覆盖 MUST 条款

## 范围

- apps/node-unit/src/scheduler.ts
- apps/node-unit/src/index.ts
- apps/node-unit/src/scheduler.test.ts
- apps/node-unit/etc/node-unit.api.md
- apps/node-unit/README.md
- docs/zh-Hans/packages/@yuants-node-unit.md
- libraries/deploy/src/\*\*
- tools/sql-migration/sql/deployment.sql
- .legion/tasks/node-unit-claim-policy-deployment-type/docs/rfc-node-unit-claim-policy.md

## 阶段概览

1. **调研** - 1 个任务
2. **设计** - 1 个任务
3. **审查** - 1 个任务
4. **门禁** - 1 个任务
5. **实现** - 2 个任务
6. **验证** - 2 个任务
7. **Review / 报告** - 3 个任务

## 设计门禁

- RFC 生成完成
- RFC 对抗审查 PASS
- 用户批准设计（Design Approved，2026-03-23）

---

_创建于: 2026-02-06 | 最后更新: 2026-02-06_
