# node-unit-deployment-metric-refactor

## 目标

[RFC] 重构 Node Unit Deployment 指标：移除高基数指标并使用 Join 模式，保留 Scheduler 现有逻辑

## 要点

- # 背景
- 当前 `node-unit` 使用 `pidusage` 主动轮询子进程资源，上报高基数指标 `node_unit_deployment_*`。
- Scheduler 目前依赖 `pidusage` 聚合的数据进行调度决策。
- 用户要求：移除高基数 Prometheus 指标，但**暂时保持 Scheduler 逻辑不变**（即不引入 Prometheus 查询，继续使用本地 `pidusage` 做调度判断）。

# 1. 指标重构方案

- **移除 Prometheus 上报**: 删除 `node_unit_deployment_cpu_seconds_total`, `node_unit_deployment_cpu_usage_ratio`, `node_unit_deployment_memory_rss_bytes` 的 Metric 定义与上报代码。
- **保留数据采集**: **必须保留** `pidusage` 相关的采集逻辑 (`startResourceCollector`)，因为 Scheduler (`InspectResourceUsage` RPC) 仍然依赖这些内存中的数据 (`currentResourceUsage`)。
- **新增 Join 指标**: 引入 `node_unit_deployment_info` (Gauge, Value=1)，Labels: `deployment_id`, `terminal_id` 等，用于外部监控系统通过 Join 语法查询。

# 2. Scheduler & 内部逻辑调整

- **Scheduler**: 保持 `scheduler.ts` 不变。它继续调用 `NodeUnit/InspectResourceUsage`。
- **Resource Collector**:
  - 之前的 `collectDeploymentMetrics` (专门用于上报 Deployment 指标的) 可以被移除或精简。
  - **关键点**: `startResourceCollector` (用于计算整机负载 `currentResourceUsage` 的) **必须保留**。它会继续使用 `pidusage` 统计子进程消耗，并更新 `currentResourceUsage` 变量，供 Scheduler RPC 使用。
- **清理**: 仅清理向 `GlobalPrometheusRegistry` 注册 Deployment 相关 Metric 的代码。

# 3. 实施步骤

1.  **Apps/Node-Unit (index.ts)**:
    - 定义 `MetricDeploymentInfo` (Gauge)。
    - 在 `runDeployment` 中维护该 Gauge (Set 1 / Remove)。
    - 删除 `MetricDeploymentCpuSecondsTotal`, `MetricDeploymentCpuUsageRatio`, `MetricDeploymentMemoryRssBytes`。
    - 删除 `startDeploymentMetricsCollector` 函数（这是专门为了打点存在的循环）。
    - **保留** `startResourceCollector`，确保 `currentResourceUsage` 依然能够统计到子进程的开销。
    - **保留** `pidusage` 依赖。

# 4. 验证

- 部署任务，确认 `node_unit_deployment_info` 存在且准确。
- 确认旧的 Deployment 指标已消失。
- **关键验证**: 确认 Scheduler 依然能正常工作（基于资源的调度策略），即 `NodeUnit/InspectResourceUsage` RPC 依然返回包含子进程消耗的正确数值。

## 范围

- apps/node-unit/src/index.ts

## 阶段概览

1. **RFC & Design** - 1 个任务
2. **Implementation** - 1 个任务
3. **Verification** - 1 个任务

---

_创建于: 2026-01-18 | 最后更新: 2026-01-18_
