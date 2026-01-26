# node-unit-deployment-grafana-dashboard

## 目标

基于 node_unit_deployment_cpu_seconds_total 与 node_unit_deployment_memory_rss_bytes 新建 Grafana dashboard，并沿用现有 dashboard.json 的风格与变量配置。

## 要点

- 复用 `.c1-cellar/dashboard.json` 的变量、样式与全局设置，保持一致的展示语言
- 围绕 CPU/Memory 指标设计关键视图：总量、按 deployment/instance 的 TopN、趋势与分位/极值
- 明确指标标签选择（如 deployment、instance、namespace 等）并给出统一过滤变量
- 输出新的 dashboard JSON 文件，注明导入方式与依赖的数据源名

## 范围

- .c1-cellar/dashboard.json（仅参考）
- .c1-cellar/dashboard-node-unit-deployment.json（新文件）

## 阶段概览

1. **调研** - 1 个任务
2. **设计** - 1 个任务
3. **实现** - 1 个任务

---

## 面板设计（PromQL）

### 变量

- `datasource`: `prometheus`
- `node_unit_name`: `label_values(node_unit_deployment_cpu_seconds_total, node_unit_name)`
- `package_name`: `label_values(node_unit_deployment_cpu_seconds_total, package_name)`
- `package_version`: `label_values(node_unit_deployment_cpu_seconds_total, package_version)`
- `deployment_id`: `label_values(node_unit_deployment_cpu_seconds_total, deployment_id)`

查询统一过滤：

```
{node_unit_name=~"$node_unit_name",package_name=~"$package_name",package_version=~"$package_version",deployment_id=~"$deployment_id"}
```

### CPU

- CPU Rate Total（graph，unit=short）
  - `sum(rate(node_unit_deployment_cpu_seconds_total{...}[5m]))`
- CPU Rate by Deployment（graph，stack=true，unit=short）
  - `sum by (deployment_id, package_name, package_version, node_unit_name) (rate(node_unit_deployment_cpu_seconds_total{...}[5m]))`
- CPU Top 10（table，instant，unit=short）
  - `topk(10, sum by (deployment_id, package_name, package_version, node_unit_name) (rate(node_unit_deployment_cpu_seconds_total{...}[5m])))`
- CPU Peak 1h（table，instant，unit=short）
  - `topk(10, max_over_time((sum by (deployment_id, package_name, package_version, node_unit_name) (rate(node_unit_deployment_cpu_seconds_total{...}[5m])))[1h:]))`

### Memory

- Memory RSS Total（graph，unit=bytes）
  - `sum(node_unit_deployment_memory_rss_bytes{...})`
- Memory RSS by Deployment（graph，stack=true，unit=bytes）
  - `sum by (deployment_id, package_name, package_version, node_unit_name) (node_unit_deployment_memory_rss_bytes{...})`
- Memory Top 10（table，instant，unit=bytes）
  - `topk(10, sum by (deployment_id, package_name, package_version, node_unit_name) (node_unit_deployment_memory_rss_bytes{...}))`
- Memory Peak 1h（table，instant，unit=bytes）
  - `topk(10, max_over_time((sum by (deployment_id, package_name, package_version, node_unit_name) (node_unit_deployment_memory_rss_bytes{...}))[1h:]))`

_创建于: 2026-01-12 | 最后更新: 2026-01-12_
