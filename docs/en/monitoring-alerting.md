# Monitoring and Alerting

We use Prometheus as the infrastructure for system monitoring and alerting. For alerts, we directly poll the Prometheus database's Alerts interface to get the current alert status, then send alerts to people. We don't use Alertmanager, so you don't need to deploy Alertmanager in the system.

## Core Components

### [@yuants/prometheus](libraries/prometheus)

High-performance Prometheus instrumentation client library. Supports use in all JS runtimes. Supports currying-style metric definition and usage. Excellent performance, suitable for high-frequency calling scenarios.

### [@yuants/app-metrics-collector](apps/metrics-collector)

This deploys a terminal as a metrics collection service. The metrics collector continuously collects metrics from terminals. It works with Prometheus.

### [@yuants/app-prometheus-client](apps/prometheus-client)

This deploys a terminal as a Prometheus client. It provides services for querying data from the Prometheus database. Suitable for building monitoring dashboards.

### [@yuants/app-alert-receiver](apps/alert-receiver)

This deploys a terminal as an alert receiving service. It receives alerts from alert terminals and sends them to notification terminals.

## Monitoring Architecture

1. **Metrics Collection**: Each terminal collects metrics through instrumentation libraries
2. **Data Aggregation**: Metrics collector aggregates data from all terminals
3. **Storage Query**: Prometheus client provides query interface
4. **Alert Processing**: Alert receiver handles alert notifications

## Features

- High-performance metrics collection
- Supports all JS runtimes
- No Alertmanager deployment required
- Direct polling of Prometheus alert interface
- Flexible alert notification mechanism

## Use Cases

- System performance monitoring
- Trading strategy monitoring
- Service quality monitoring
- Anomaly detection and alerting

<p align="right">(<a href="../../README.md">Back to README</a>) | <a href="architecture-overview.md">Architecture Overview</a></p>
