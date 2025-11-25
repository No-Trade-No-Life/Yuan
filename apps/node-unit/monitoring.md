# Node Unit Deployment 监控说明（Prometheus & Grafana）

## 可用指标

- `node_unit_deployment_cpu_seconds_total{deployment_id,package_name,package_version,node_unit_name,node_unit_address,pid}`
  - 由 `pidusage` 采样的子进程 CPU 累计秒数（采样间隔累加），单调递增。
- `node_unit_deployment_cpu_usage_ratio{...}`
  - 采样周期内 CPU 使用率（0~1）。
- `node_unit_deployment_memory_rss_bytes{...}`
  - 子进程 RSS 字节。
- **网络指标暂未启用**（socket/连接数相关采集已禁用）。

## PrometheusRule 示例

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: node-unit-deployment-rules
  namespace: monitoring
spec:
  groups:
    - name: node-unit-deployment
      rules:
        - alert: NodeUnitDeploymentHighCPU
          expr: avg_over_time(node_unit_deployment_cpu_usage_ratio[5m]) > 0.85
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: High CPU usage
            description: 'deployment {{ $labels.deployment_id }} ({{ $labels.package_name }}@{{ $labels.package_version }}) on node {{ $labels.node_unit_name }} CPU usage >85% over 5m.'

        - alert: NodeUnitDeploymentSaturatedCPU
          expr: avg_over_time(node_unit_deployment_cpu_usage_ratio[5m]) > 0.95
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: CPU saturated
            description: 'deployment {{ $labels.deployment_id }} CPU usage >95% over 5m (node {{ $labels.node_unit_name }}).'

        - alert: NodeUnitDeploymentHighMemory
          expr: node_unit_deployment_memory_rss_bytes > 1e9
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: High memory usage
            description: 'deployment {{ $labels.deployment_id }} RSS exceeds 1GB (node {{ $labels.node_unit_name }}).'

        - alert: NodeUnitDeploymentCriticalMemory
          expr: node_unit_deployment_memory_rss_bytes > 2e9
          for: 5m
          labels:
            severity: critical
          annotations:
            summary: Memory near limit
            description: 'deployment {{ $labels.deployment_id }} RSS exceeds 2GB (node {{ $labels.node_unit_name }}).'
```

> 可按节点/部署资源规格调整阈值；若有更精确的配额，可替换为相对阈值表达式。

## Grafana 面板建议（查询示例）

- **CPU 使用率（折线，按部署聚合）**
  - Query：`avg by (deployment_id,package_name,package_version,node_unit_name) (node_unit_deployment_cpu_usage_ratio)`
- **CPU TopN（表格）**
  - Query：`topk(5, node_unit_deployment_cpu_usage_ratio)`
  - Columns：deployment_id, package_name@version, node_unit_name, cpu_usage_ratio
- **CPU 累计（导出/排查）**
  - Query：`rate(node_unit_deployment_cpu_seconds_total[5m])`
- **内存 RSS（折线，按部署）**
  - Query：`avg by (deployment_id,package_name,package_version,node_unit_name) (node_unit_deployment_memory_rss_bytes)`
- **内存 TopN（表格）**
  - Query：`topk(5, node_unit_deployment_memory_rss_bytes)`

### 推荐变量

- `node_unit_name`: `label_values(node_unit_deployment_cpu_usage_ratio, node_unit_name)`
- `package`: `label_values(node_unit_deployment_cpu_usage_ratio, package_name)`
- 在查询中增加筛选：`...{node_unit_name=~"$node_unit_name",package_name=~"$package"}` 便于多集群/多节点分片。

### 注意事项

- 网络相关指标暂未启用；如需网络面板，请先恢复采集后再补充查询。
- CPU 阈值示例为固定比例，若部署配额明确，可改为对比请求值或节点核数的表达式。

## Recording Rule 建议

当面板/告警频繁使用同类表达式时，可预先录制以降低查询负载、统一口径：

- 平滑 CPU 占比（5m 均值）  
  `record: node_unit_deployment_cpu_usage_ratio:5m`  
  `expr: avg_over_time(node_unit_deployment_cpu_usage_ratio[5m])`

- CPU 增量速率（秒）  
  `record: node_unit_deployment_cpu_seconds_total:rate5m`  
  `expr: rate(node_unit_deployment_cpu_seconds_total[5m])`

- 内存换算 MB（便于展示）  
  `record: node_unit_deployment_memory_rss_bytes:mb`  
  `expr: node_unit_deployment_memory_rss_bytes / 1e6`

- CPU TopK（按 5m 均值）  
  `record: node_unit_deployment_cpu_usage_ratio:5m:topk`  
  `expr: topk(5, avg_over_time(node_unit_deployment_cpu_usage_ratio[5m]))`

- 按节点/包聚合示例  
  `record: node_unit_deployment_cpu_usage_ratio:5m:by_node`  
  `expr: sum by (node_unit_name) (avg_over_time(node_unit_deployment_cpu_usage_ratio[5m]))`
  `record: node_unit_deployment_memory_rss_bytes:by_package`  
  `expr: sum by (package_name, package_version) (node_unit_deployment_memory_rss_bytes)`

> 可根据面板/告警的实际使用频率挑选需要的规则；查询量小则可以暂不录制。
