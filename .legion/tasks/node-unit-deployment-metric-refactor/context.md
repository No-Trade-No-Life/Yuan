# node-unit-deployment-metric-refactor - 上下文

## 会话进展 (2026-01-18)

### ✅ 已完成

- Code modifications: removed old metrics, added node_unit_deployment_info join metric
- Dashboard updates: all queries updated to use join pattern

### 🟡 进行中

- Test deployment and verify metrics

### ⚠️ 阻塞/待定

(暂无)

---

## 关键文件

(暂无)

---

## 关键决策

| 决策                                                                  | 原因                                                                                                                                                                                                          | 替代方案                                                                           | 日期       |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------- |
| Use `node_unit_deployment_info` as the join metric.                   | Allows joining standard `nodejs_process_resource_usage` (keyed by `terminal_id`) with deployment metadata (keyed by `deployment_id`), reducing the need for Node Unit to actively poll child process metrics. | -                                                                                  | 2026-01-18 |
| 对 node_unit_deployment_info 指标采用 set(1)/set(0) 而非 remove()。   | Prometheus Gauge 类型未暴露 remove 方法，且外部监控可通过过滤 node_unit_deployment_info > 0 忽略零值指标。                                                                                                    | 尝试调用 remove() 但会导致 TypeScript 错误；也可考虑引入其他库方法但增加复杂度。   | 2026-01-19 |
| 对 node_unit_deployment_info 指标使用 labels().delete() 而非 set(0)。 | 用户要求，且 Prometheus Gauge 接口支持 delete() 方法以完全移除标签组合。                                                                                                                                      | set(0) 会保留标签组合但值为零，可能影响 PromQL 查询。delete() 可确保指标完全移除。 | 2026-01-19 |

---

## 快速交接

**下次继续从这里开始：**

1. Test deployment: start a deployment and verify node_unit_deployment_info appears with value 1
2. Verify old metrics: ensure node*unit_deployment_cpu*_ and node*unit_deployment_memory*_ are no longer reported
3. Test dashboard: verify join queries work correctly in Grafana

**注意事项：**

- Scheduler logic remains unchanged, still uses pidusage aggregated data
- External monitoring uses PromQL join pattern: nodejs_process_resource_usage \* on(terminal_id) group_left(...) node_unit_deployment_info

---

_最后更新: 2026-01-19 10:37 by Claude_
