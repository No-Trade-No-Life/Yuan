# RFC: http-services 递归栈溢出修复

## Abstract

vendor-okx/gate/huobi/bitget 等在启用 `USE_HTTP_PROXY` 后出现 `RangeError: Maximum call stack size exceeded`。本 RFC 通过引入稳定的原生 fetch 引用与 proxy fetch 标记，确保 `Terminal.fromNodeEnv()` 获取 public IP 时不会被 `@yuants/http-services` 的 `fetch` 递归调用，并在 `USE_HTTP_PROXY=true` 时跳过 public IP 获取，消除栈溢出同时保持代理能力与调用方接口兼容。

## Motivation

### 问题描述

在推广 http-services 后，多 vendor 启用 `USE_HTTP_PROXY` 覆盖了 `globalThis.fetch`。`@yuants/http-services/lib/client.js` 内部调用 `Terminal.fromNodeEnv()`，其构造函数中执行 `fetch('https://ifconfig.me/ip')` 获取 public IP，最终导致 `fetch -> Terminal.fromNodeEnv -> Terminal -> fetch` 递归。

### 影响范围

- apps/vendor-okx
- apps/vendor-gate
- apps/vendor-huobi
- apps/vendor-bitget
- 其他启用 `USE_HTTP_PROXY` 且依赖 `Terminal.fromNodeEnv()` 的模块

### 复现路径（简要）

1. 在 vendor 中启用 `USE_HTTP_PROXY=true` 覆盖 `globalThis.fetch` 为 `@yuants/http-services` 的 `fetch`。
2. 任意调用 http-services `fetch`。
3. 触发 `Terminal.fromNodeEnv()`，构造函数调用 public IP fetch，递归触发栈溢出。

### 根因分析

全局 `fetch` 被替换后，`Terminal` 内部的 public IP 获取也使用了被替换的 `fetch`，导致 http-services 的 `fetch` 再次进入 `Terminal.fromNodeEnv()`，形成无限递归。若仅在 `terminal.ts` 模块加载时缓存 `fetch`，还可能受模块加载顺序影响，导致缓存到 proxy fetch。

### public IP 用途说明

`Terminal` 会将 public IP 写入 terminal tags（`public_ip`），用于观测与排障标识；该字段不影响服务主流程，允许为空。

## Goals & Non-Goals

### Goals

- 消除递归栈溢出，同时保持 http-services 代理能力与现有调用兼容。
- 不修改调用方接口与调用点，风险尽量小。
- 保持 `Terminal.fromNodeEnv()` 的接口与主流程一致，允许 `USE_HTTP_PROXY=true` 时 public IP 不再获取。

### Non-Goals

- 不引入新的代理路由、labels、超时或重试语义。
- 不调整 vendor 业务逻辑与错误处理。
- 不改变 HTTPProxy 服务端行为。

## Definitions

- native fetch: 通过稳定引用获取的原生 `fetch`（优先 `globalThis.__yuantsNativeFetch`，否则使用 `globalThis.fetch`）。
- proxy fetch: `@yuants/http-services` 导出的 `fetch`，带有 `__isHttpServicesFetch` 标记。
- native fetch cache: `globalThis.__yuantsNativeFetch`，由 http-services 模块在覆盖前缓存，且仅首次写入。
- public IP fetch: `Terminal` 构造时对 `https://ifconfig.me/ip` 的调用。
- USE_HTTP_PROXY 判定：仅当 `process.env.USE_HTTP_PROXY === 'true'` 时视为启用代理覆盖。

## Protocol Overview

1. 当 `process.env.USE_HTTP_PROXY === 'true'` 时，覆盖 `globalThis.fetch` 为 proxy fetch。
2. http-services 模块在覆盖前缓存 `globalThis.fetch` 到 `globalThis.__yuantsNativeFetch`（仅首次写入），并为 proxy fetch 打标记。
3. 任意调用 proxy fetch 时，http-services 内部调用 `Terminal.fromNodeEnv()`。
4. `Terminal` 构造 public IP 时优先使用 `globalThis.__yuantsNativeFetch`，若 `USE_HTTP_PROXY=true` 或 native fetch 不可用/被标记，则跳过 public IP 获取并降级继续。
5. proxy fetch 继续完成 HTTP 代理请求。

## State Machine

### 状态

- S0: ModuleLoaded（`terminal.ts` 模块加载）
- S1: TerminalInit（调用 `Terminal.fromNodeEnv()`）
- S2: FetchPublicIP（尝试获取 public IP）
- S3: Ready（Terminal 可用）

### 转移与触发条件

- S0 -> S1: 调用 `Terminal.fromNodeEnv()`。
- S1 -> S2: `Terminal` 构造开始，且 native fetch 可用且未被标记，且 `USE_HTTP_PROXY!=true`。
- S2 -> S3: public IP 获取成功，或失败但降级继续。
- S1 -> S3: public IP 获取被禁用/跳过（`USE_HTTP_PROXY=true` 或 native fetch 不可用/被标记）。

## Data Model

### Module Scope

- `nativeFetch: typeof fetch | undefined`

  - 来源优先级：`globalThis.__yuantsNativeFetch` -> `globalThis.fetch`。
  - 约束：若 `nativeFetch` 被标记为 proxy fetch，视为不可用。
  - 兼容策略：不可用时 public IP 获取必须跳过或降级，不可改用 proxy fetch。

- `proxyFetchMarker: '__isHttpServicesFetch'`

  - 约束：proxy fetch 必须设置该标记，供 `terminal.ts` 识别。

- `useHttpProxy: boolean`
  - 判定：`process.env.USE_HTTP_PROXY === 'true'`。

### Terminal

- `publicIP?: string`
  - 约束：只存储单个 IPv4/IPv6 字符串；为空表示未获取。
  - 兼容策略：空值不会影响 http-services 代理请求。

## Error Semantics

- public IP 获取失败 MUST 不影响 `Terminal` 构造与后续代理请求（降级为无 public IP）。
- public IP 获取失败 MAY 以 debug 级别记录一次日志，但 MUST NOT 泄露敏感信息。
- 若 `nativeFetch` 不存在或被标记为 proxy fetch，系统 MUST 跳过 public IP 获取并进入 Ready。
- 当 `USE_HTTP_PROXY=true` 时，系统 MUST 跳过 public IP 获取，避免直连与递归风险。

## 方案选型

### 方案 1（选择）

在 http-services 模块中缓存原生 fetch 并为 proxy fetch 打标记，`terminal.ts` 通过稳定引用获取 native fetch，并在 `USE_HTTP_PROXY=true` 或 native fetch 不可用时跳过 public IP 获取。

### 方案 2（备选）

为 `Terminal` 增加可选配置或环境变量以禁用 public IP fetch，在 http-services 内创建 Terminal 时启用。可作为兼容增强，但会引入额外配置面。

### 方案 3（不选）

放弃全局 fetch 覆盖，改为仅使用 `fetchImpl`。需要改动调用点，范围更大，不符合最小变更目标。

## 规范条款（用于测试映射）

- R1: `@yuants/http-services` 的 `fetch` MUST 设置 `__isHttpServicesFetch` 标记。
- R2: `@yuants/http-services` MUST 在覆盖前将 `globalThis.fetch` 缓存到 `globalThis.__yuantsNativeFetch`（若存在且未被标记；若已存在则不得覆盖）。
- R3: `Terminal` 的 public IP 获取 MUST 使用 `globalThis.__yuantsNativeFetch` 优先于 `globalThis.fetch`。
- R4: 若 `nativeFetch` 不可用或被标记为 proxy fetch，public IP 获取 MUST 被跳过或安全降级，且不得回退到 proxy fetch。
- R5: 当 `USE_HTTP_PROXY=true` 时，public IP 获取 MUST 被跳过。
- R6: public IP 获取失败 MUST 不阻断 `Terminal.fromNodeEnv()`，且 MUST 返回可用 `Terminal` 实例。
- R7: 本修复 MUST 不改变调用方接口与签名（所有 vendor 调用点保持不变）。

## 变更点清单

- `libraries/http-services/src/client.ts`: 设置 proxy fetch 标记并缓存 `globalThis.__yuantsNativeFetch`。
- `libraries/protocol/src/terminal.ts`: 使用稳定 native fetch 引用，并在 `USE_HTTP_PROXY=true` 时跳过 public IP 获取。
- `apps/vendor-*/src/api/*` 或 `apps/vendor-*/src/services/*`: 无需改动。

## Security Considerations

- 避免递归导致的资源耗尽（栈溢出）与服务不可用。
- 当 `USE_HTTP_PROXY=true` 时跳过 public IP 获取，避免直连与代理策略冲突。
- 若未启用代理，public IP 获取使用 native fetch，失败必须降级，不得阻断主流程。
- public IP 获取的 URL 必须固定为已知可信域（`https://ifconfig.me/ip`），禁止外部输入拼接。
- 任何日志 MUST 不包含凭证、签名或完整请求 URL。

## Backward Compatibility & Rollout

- 兼容性：不修改调用方接口；`Terminal` 仍按现有方式创建，但 `USE_HTTP_PROXY=true` 时 `publicIP` 可能为空。
- 灰度：可先在单个 vendor 环境验证，确认无栈溢出后全量。
- 回滚：回退到变更前版本（同时撤回 `client.ts` 与 `terminal.ts` 调整）即可，调用方无感。

## Testability

每条 MUST 行为与测试断言对应：

- R1: 断言 proxy fetch 设置 `__isHttpServicesFetch` 标记。
- R2: 覆盖前缓存 `globalThis.__yuantsNativeFetch`，覆盖后仍保持原值且不会被重写。
- R3: `Terminal` 使用 `globalThis.__yuantsNativeFetch` 优先于 `globalThis.fetch`。
- R4: `nativeFetch` 不可用或被标记时，public IP 获取被跳过且无递归。
- R5: `USE_HTTP_PROXY=true` 时不触发 public IP 获取；`USE_HTTP_PROXY=1` 时不视为启用（仍可尝试 public IP 获取）。
- R6: 模拟 public IP 请求失败，断言 `Terminal.fromNodeEnv()` 返回实例且不抛错。
- R7: 编译/静态检查确保调用方 API 无变更。

## Open Questions

- 是否需要引入方案 2 的可选禁用开关，作为 `USE_HTTP_PROXY` 之外的显式控制面。
- public IP 获取失败时的日志策略是否需要统一到 `@yuants/http-services` 的观测体系。

## Plan

### 核心流程

1. 在 http-services 模块加载时缓存 `globalThis.__yuantsNativeFetch` 并标记 proxy fetch。
2. `Terminal` 构造时若 `USE_HTTP_PROXY!=true` 且 native fetch 可用，则使用 native fetch 请求 `https://ifconfig.me/ip`。
3. 失败时降级继续，不影响 proxy fetch。

### 接口定义

- 不新增或修改调用方接口。
- `Terminal.fromNodeEnv()` 签名与返回值保持兼容。

### 文件变更明细

- `libraries/http-services/src/client.ts`: 新增 proxy fetch 标记与 `globalThis.__yuantsNativeFetch` 缓存。
- `libraries/protocol/src/terminal.ts`: 调整 public IP 获取为稳定 native fetch，并在 `USE_HTTP_PROXY=true` 时跳过。

### 验证策略

- 运行单元测试或最小集成测试覆盖 R1-R5。
- 在启用 `USE_HTTP_PROXY` 的 vendor 环境做一次真实请求，确认无栈溢出。
- 仅需构建验证即可，不新增调用方变更。
