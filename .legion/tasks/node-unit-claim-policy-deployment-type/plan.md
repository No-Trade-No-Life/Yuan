# node-unit-claim-policy-deployment-type

TITLE: node-unit 调度 claim policy 与 deployment 类型
SLUG: node-unit-claim-policy-deployment-type

RFC 设计真源: docs/rfc-node-unit-claim-policy.md

## 目标

为 node-unit 增加抢占关闭策略与 deployment 类型字段，明确 daemon 与 deployment 的调度/抢占规则。

## 要点

- 新增 NODE_UNIT_CLAIM_POLICY=none，调度可完全跳过抢占逻辑
- deployment 表新增 type(TEXT) 字段，取值 daemon/deployment，并将历史记录迁移为 deployment
- daemon 类型不参与抢占且不绑定 address，但启用时每个 node-unit 至少保持一个 daemon 实例
- 明确调度/分配规则与边界条件（启用/禁用、失联、无 daemon 可用等）
- 更新类型定义/文档/测试计划，保持既有日志与指标语义一致

## 范围

- apps/node-unit/src/scheduler.ts
- apps/node-unit/src/index.ts
- libraries/deploy/src/index.ts
- tools/sql-migration/sql/deployment.sql
- apps/node-unit/etc/node-unit.api.md
- apps/node-unit/README.md
- docs/zh-Hans/packages/@yuants-node-unit.md
- docs/rfc-node-unit-claim-policy.md

## 阶段概览

1. **调研** - 1 个任务
2. **设计** - 1 个任务
3. **设计审查** - 1 个任务
4. **门禁确认** - 1 个任务

---

## 摘要

核心流程：在 `NODE_UNIT_CLAIM_POLICY=none` 时跳过 claim；`daemon` 按 enabled 在每个 node-unit 启停，`deployment` 保持地址绑定。
接口变更：`deployment.type` 新增为 `daemon`/`deployment`，`IDeployment` 增加 `type` 字段。
文件变更清单：`apps/node-unit/src/scheduler.ts`、`apps/node-unit/src/index.ts`、`libraries/deploy/src/index.ts`、`tools/sql-migration/sql/deployment.sql`、`apps/node-unit/etc/node-unit.api.md`、`apps/node-unit/README.md`、`docs/zh-Hans/packages/@yuants-node-unit.md`。
验证策略：覆盖 R1-R11 行为，校验迁移默认值与 daemon 实例数。

_创建于: 2026-01-30 | 最后更新: 2026-01-30_
