# RFC: HTTP Proxy Application

## 1. 摘要

开发一个轻量级应用程序 `@yuants/app-http-proxy`，旨在封装 `@yuants/http-services` 库的能力。该应用将作为一个独立的终端节点（Terminal）加入 Yuan 网络，并注册提供 HTTP 代理服务。

## 2. 动机

目前 `http-services` 作为一个库存在，需要被集成到其他应用中才能工作。为了方便部署和使用 HTTP 代理功能，需要一个开箱即用的独立应用。

## 3. 设计目标

- **简单性**：代码量少，逻辑清晰，仅作为库的胶水层。
- **配置化**：通过环境变量配置并发与限流参数。
- **标准化**：遵循 Yuan 应用的标准启动流程和生命周期。

## 4. 架构

- **入口**：`src/index.ts`
- **核心依赖**：
  - `@yuants/protocol`: 用于创建 Terminal 实例。
  - `@yuants/http-services`: 提供 `provideHTTPProxyService` 核心功能。

## 5. 接口

- 输入：环境变量（配置）。
- 输出：向 Host 注册的 Service 消息；日志输出。

## 6. 安全与边界

- 不引入应用层鉴权，依赖 Host 接入控制与网络隔离。
- 默认会调用 `http://ifconfig.me/ip` 获取 `PROXY_IP`（如未显式配置）。
