# NodeUnit Daemon 类型 E2E 测试报告

## 概述

- **目标**：验证 `deployment.type=daemon` 类型部署能在两个 node-unit 实例上正确启动
- **测试对象**：`@yuants/app-http-proxy`
- **测试脚本**：`apps/node-unit/scripts/e2e-daemon-type.sh`
- **测试日期**：2026-01-30

## 测试环境

| 组件             | 配置                                             |
| ---------------- | ------------------------------------------------ |
| TimescaleDB      | Docker 容器（timescale/timescaledb:latest-pg15） |
| Host             | `apps/host/lib/cli.js` (ws://localhost:8888)     |
| Postgres Storage | `apps/postgres-storage/lib/cli.js`               |
| NodeUnit 1       | `node-unit-1`                                    |
| NodeUnit 2       | `node-unit-2`                                    |
| 测试 Deployment  | `@yuants/app-http-proxy@latest` (type=daemon)    |

## 测试结果

### ✅ 验证通过

1. **两个 NodeUnit 成功注册到 Host**

   - NodeUnit 1 地址：`FCpopL2vXeDkN7bbncbaDR93RqpZdyYVCuJpVZExTqfV`
   - NodeUnit 2 地址：`4Ke9E8t73UEBzxC4maZYmSvHSxGamLzsQ6fDv1CSceb5`

2. **Daemon 启动成功**

   - NodeUnit 1：`DeploymentStart` 日志确认 ✅
   - NodeUnit 2：`DeploymentStart` 日志确认 ✅
   - 运行进程数：2 个 http-proxy 进程 ✅

3. **Address 保持为空**
   - `deployment.address` = `''` (空字符串) ✅
   - 证明 scheduler 不再错误地 claim daemon 记录

### 日志摘要

```
[e2e] === Node Unit 1 Logs (looking for daemon startup) ===
2026-01-30 22:31:26.871+08:00 DeploymentStart a8376b26-cf4d-4998-a3b1-f76fdfd8c796 @yuants/app-http-proxy@latest

[e2e] === Node Unit 2 Logs (looking for daemon startup) ===
2026-01-30 22:31:26.828+08:00 DeploymentStart a8376b26-cf4d-4998-a3b1-f76fdfd8c796 @yuants/app-http-proxy@latest

[e2e] === Checking for running http-proxy processes ===
[e2e] Found running http-proxy processes:
57017
57018

[e2e] ✅ SUCCESS: Both node-units have spawned the daemon!
```

## 关键修复

本次测试发现并修复了 scheduler 中的 bug：

### 问题描述

`scheduler.ts` 中的 `claimDeployment` 函数没有检查 `type='deployment'` 条件，导致 daemon 记录的 `address` 被错误地设置。

### 修复内容

**文件**：`apps/node-unit/src/scheduler.ts`

```typescript
// 修复前
const sql = `update deployment set address = ${escapeSQL(nodeUnitAddress)} where id = ${escapeSQL(
  deployment.id,
)} and (${addressFilter}) returning id`;

// 修复后
const sql = `update deployment set address = ${escapeSQL(nodeUnitAddress)} where id = ${escapeSQL(
  deployment.id,
)} and type = 'deployment' and (${addressFilter}) returning id`;
```

同时更新了对应的单元测试 (`scheduler.test.ts`)。

## 结论

- ✅ daemon 类型 deployment 正确地在两个 node-unit 上启动
- ✅ daemon 的 address 保持为空，不参与抢占调度
- ✅ 修复了 scheduler 错误 claim daemon 记录的问题
- ✅ 符合 RFC 设计的预期行为

---

_生成于: 2026-01-30_
