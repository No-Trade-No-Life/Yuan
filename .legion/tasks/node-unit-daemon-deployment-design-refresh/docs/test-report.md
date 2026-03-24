# Test Report

## 结论

部分通过，E2E 未完全通过。

## 已通过

- `npm run build`（`apps/node-unit`）✅
- `rush build --to @yuants/node-unit` ✅
- `apps/node-unit` 内置 jest（25 tests）✅

## E2E 尝试

### 1. pg17 daemon assignment E2E

- 镜像：`timescale/timescaledb:latest-pg17`
- 结果：**部分成功**
  - 成功创建 `deployment_assignment`
  - 两个 node-unit 都能分配 daemon assignment
  - 但运行环境中的 `prepareWorkspace` / child spawn 不稳定，导致 `heartbeat_at` 未稳定写入

### 2. custom-command pg17 daemon assignment E2E

- 配置：`ENABLE_CUSTOM_COMMAND=true`，daemon 使用 `/bin/sh -lc 'sleep 1000'`
- 结果：**失败**
  - assignment 创建成功
  - 但 `prepareWorkspace` 与 `/bin/sh`/symlink 环境问题导致进程反复重启，`heartbeat_at` 仍为 null

## 关键观测

- 修复后 `deployment.address` 不再每轮无差别更新，避免了 `updated_at` 抖动导致的无意义重启。
- assignment upsert 已改为 `on conflict do nothing`，避免双 scheduler 并发插入时直接报主键冲突。
- 当前 E2E 失败主因不是 assignment 建模本身，而是运行环境中 `prepareWorkspace` 与 child process 启动链路不稳定，阻塞了 heartbeat 成功写入验证。

## 后续建议

1. 为 `runDeployment` / `prepareWorkspace` 增加更可控的测试替身或 fake package。
2. 单独补一套 executor 续租集成测试，避免完全依赖真实包安装。
3. 完成 `switch_state` 后，再做一次完整 rollout/rollback E2E。
