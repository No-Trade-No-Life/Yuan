# 监控报警

我们使用 Prometheus 作为系统监控与报警的基础设施。关于报警，我们直接轮询 Prometheus 数据库的 Alerts 接口，获取当前的报警状态，然后将报警发送给人。我们不使用 Alertmanager，您无需在系统中部署 Alertmanager。

## 核心组件

### [@yuants/prometheus](libraries/prometheus)

高性能 Prometheus 埋点客户端库。支持所有 JS 运行时下使用。支持 currying 风格的指标定义和使用。性能优异，适合高频调用场景。

### [@yuants/app-metrics-collector](apps/metrics-collector)

这将部署一个终端作为指标收集服务。指标收集器持续从终端收集指标。它与 Prometheus 配合工作。

### [@yuants/app-prometheus-client](apps/prometheus-client)

这将部署一个终端作为 Prometheus 客户端。它提供了从 Prometheus 数据库查询数据的服务。适合于构建监控面板。

### [@yuants/app-alert-receiver](apps/alert-receiver)

这将部署一个终端作为警报接收服务。它从警报终端接收警报并发送给通知终端。

## 监控架构

1. **指标收集**: 各终端通过埋点库收集指标
2. **数据聚合**: 指标收集器汇总所有终端数据
3. **存储查询**: Prometheus 客户端提供查询接口
4. **报警处理**: 报警接收器处理报警通知

## 特点

- 高性能指标收集
- 支持所有 JS 运行时
- 无需 Alertmanager 部署
- 直接轮询 Prometheus 报警接口
- 灵活的报警通知机制

## 使用场景

- 系统性能监控
- 交易策略监控
- 服务质量监控
- 异常检测和报警

<p align="right">(<a href="../README.zh-Hans.md">返回 README</a>) | <a href="architecture-overview.md">架构概述</a></p>
