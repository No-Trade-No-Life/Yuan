# node-unit-deployment-failover-rfc - 上下文

## 会话进展 (2026-01-14)

### ✅ 已完成

- 梳理 node-unit 部署绑定：node-unit 仅拉取 `deployment` 表中 `enabled=true` 且 `address=nodeUnit public key` 的记录，通过 `listWatch` 驱动 `runDeployment` 生命周期。
- 梳理 deployment 模型与表结构：`IDeployment.address` 为空表示未指定节点；SQL schema 默认值为空字符串。
- 确认 host 发布 terminal join/exit：`apps/host/src/host-manager.ts` 通过 `HostEvent` channel 广播 `TERMINAL_CHANGE`，连接关闭或 ping 失败会发送 `payload.old`，UpdateTerminalInfo 会发送 `payload.new` 或 update。
- 确认 terminal 侧 join/exit 处理：`libraries/protocol/src/terminal.ts` 订阅 `HostEvent`，将 `TERMINAL_CHANGE` 映射为 JOIN/LEAVE/UPDATE 并更新 `terminalInfos# node-unit-deployment-failover-rfc - 上下文

## 会话进展 (2026-01-14)

。

- 当前仓库未发现“未调度 deployment”发现/抢占逻辑；需要新设计填补（可能放在 node-unit 或独立调度器）。
- 已完成 RFC 设计并更新 plan.md：覆盖失联检测、address 置空、抢占规则、最少部署优先、指标接口抽象、并发策略与候选排序。
- 已落地 node-unit 调度循环：失联地址释放、最少部署抢占、一次仅抢占一个。
- 已运行 `pnpm -C apps/node-unit build`（heft test + api-extractor + post-build）通过；仅提示 TypeScript 5.9.3 版本告警。
- 调度间隔支持通过 `NODE_UNIT_SCHEDULER_INTERVAL_MS` 覆盖。
- 已运行 `rush build --to @yuants/node-unit` 成功（警告：Node.js 24.11.0 未被 Rush 测试）。
- 已完成本地 E2E：TimescaleDB + host + postgres-storage + 两个 node-unit；插入 deployments 后，停掉 node-unit-2，address 清空后由 node-unit-1 每轮抢占一个并最终接管。
- 已按“隔离环境变量”重新执行 E2E（`env -i`），确认不会继承 shell.nix；抢占行为符合预期。
- 已按 portal 5 实例重新跑 E2E（隔离环境变量）：最终分配为 node-unit-1=2、node-unit-2=3，未抢占在线节点。
- 已实现 v2 资源调度：node-unit 上报 CPU/内存到 terminalInfo.tags，scheduler 支持 `resource_usage` policy 与权重/间隔配置。
- 已用 `NODE_UNIT_CLAIM_POLICY=resource_usage` 重新跑 E2E（隔离环境变量），生成中文报告 `reports/node-unit-portal-resource-usage-e2e-report.md`。
- 补充抢占时资源快照日志并在报告中按轮次记录 CPU/内存使用情况；重新跑资源策略 E2E。
- 按最新设计聚合 node-unit 主进程+子进程资源上报，重新跑 resource_usage E2E，并更新中文报告与资源快照表。
- 按 21 个 portal 重新跑资源策略 E2E，更新报告并记录每轮抢占资源快照。
- 实现 scheduler 单元测试，修复 TypeScript 类型错误，mock 外部依赖，所有测试通过
- 完成构建验证，测试通过，无编译错误
- 更新 tasks.md 和 context.md 反映任务完成
- 已增加 eligibility/candidate/claim 原因日志并重新跑 21 portal E2E，生成更新后的中文报告。

### 🟡 进行中

(暂无)

### ⚠️ 阻塞/待定

(暂无)

---

## 关键文件

| 文件                                                    | 用途                                              | 状态   |
| ------------------------------------------------------- | ------------------------------------------------- | ------ |
| `apps/node-unit/src/scheduler.ts`                       | 调度器核心实现（失联检测、抢占逻辑、策略接口）    | 已完成 |
| `apps/node-unit/src/scheduler.test.ts`                  | 单元测试（完成，29 个测试全部通过）               | 已完成 |
| `apps/node-unit/src/logging.test.ts`                    | 参考：现有 Jest 测试模式                          | 已完成 |
| `reports/node-unit-portal-resource-usage-e2e-report.md` | E2E 测试报告（21 portal × resource_usage policy） | 已完成 |

---

## 关键决策

| 决策                                                                                                                                          | 原因                                                                     | 替代方案                                                                              | 日期       |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ---------- |
| 确认失联/抢占策略：失联仅依赖 terminalInfos$ 缺失；抢占排序 updated_at/created_at/id 升序；抢占资格仅统计已指派 deployment；调度间隔默认 5s。 | 用户 review 明确确认，不引入缓冲时间或额外权重指标，保持策略简单可预测。 | 增加离线缓冲时间、引入 address='' 计入负载或改用自定义优先级标签、缩短/拉长调度间隔。 | 2026-01-14 |

---

## 快速交接

**任务已完成** ✅

本任务的所有目标均已实现：

1. ✅ **RFC 设计与实现**：失联检测、address 置空、抢占规则、最少部署优先、资源调度策略
2. ✅ **核心功能**：node-unit 调度器，支持 `deployment_count` 和 `resource_usage` 两种策略
3. ✅ **资源上报**：node-unit 上报聚合 CPU/内存使用率（主进程+所有子进程）
4. ✅ **端到端测试**：多个场景验证，生成中文报告
5. ✅ **单元测试**：scheduler 单元测试完成，29 个测试全部通过
6. ✅ **构建验证**：TypeScript 编译通过，无错误

**后续建议：**

- 如需长期验证，可在真实集群复现同样流程观察并发抢占
- 可考虑添加更多调度策略或扩展资源指标
- 监控生产环境中的调度行为，确保稳定运行

---

_最后更新: 2026-01-15 15:16 by Claude_
