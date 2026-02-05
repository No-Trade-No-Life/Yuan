# http-services-terminalinfos-ready

TITLE: HTTP Services terminalInfos Ready RFC
SLUG: http-services-terminalinfos-ready

## 目标

为 HTTP proxy IP 选择引入 terminalInfos$ 就绪 gate，避免进程启动阶段 selectHTTPProxyIpRoundRobin 失败，并统一生命周期管理策略。

## 要点

- 梳理 terminal 加入 host 后的事件链路（GetTerminalInfos + HostEvent/TERMINAL_CHANGE）并作为就绪判断依据
- 在 @yuants/http-services 增加异步选择 helper（方案 A）并保留同步 API
- 更新各 vendor 调用点改为等待就绪后选择 proxy ip（接口无 options）
- 固定等待超时为 30 秒且不可配置，补充错误语义与观测（最小日志）

## 设计真源

- RFC: `.legion/tasks/http-services-terminalinfos-ready/docs/rfc.md`

## 摘要

- 核心流程：等待 terminalInfos$ 首发并重算 ip 列表，非空后返回或 30 秒超时失败。
- 接口变更：新增 waitForHTTPProxyIps / selectHTTPProxyIpRoundRobinAsync，无 options 参数，保留同步 API。
- 文件变更清单：proxy-ip.ts、index.ts、vendor HTTP 调用点（移除 timeout 传参）。
- 验证策略：单测覆盖 R1-R4；超时日志限频；vendor 冒烟验证。

## 范围

- libraries/http-services/src/proxy-ip.ts
- libraries/http-services/src/index.ts
- apps/vendor-binance/src/api/client.ts
- apps/vendor-aster/src/api/public-api.ts
- apps/vendor-aster/src/api/private-api.ts
- apps/vendor-bitget/src/api/client.ts
- apps/vendor-gate/src/api/http-client.ts
- apps/vendor-huobi/src/api/public-api.ts
- apps/vendor-huobi/src/api/private-api.ts
- apps/vendor-hyperliquid/src/api/client.ts
- apps/vendor-okx/src/api/public-api.ts
- apps/vendor-okx/src/api/private-api.ts

## 阶段概览

1. **调研** - 1 个任务
2. **设计** - 1 个任务
3. **实现** - 1 个任务
4. **验证** - 1 个任务

---

_创建于: 2026-02-05 | 最后更新: 2026-02-05_
