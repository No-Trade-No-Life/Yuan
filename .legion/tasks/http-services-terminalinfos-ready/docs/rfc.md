# RFC: http-services terminalInfos$ 就绪等待与异步 proxy IP 选择

## Abstract

本文定义 @yuants/http-services 中 HTTP proxy IP 选择的“就绪等待”协议与异步 API，解决 terminalInfos$ 首发前 ip 池为空导致的启动失败。设计保留同步 API，通过新增异步 helper 和调用点改造实现无侵入迁移，并将等待超时固定为 30 秒且不可配置，提供可观测、可回滚、可测试的行为规范。

## Motivation / 背景

terminalInfos$ 的首次发射发生在 GetTerminalInfos 成功后；在启动阶段，terminal.terminalInfos 为空时同步选择逻辑会抛出 E_PROXY_TARGET_NOT_FOUND，导致请求上下文初始化失败。需要提供一种在 terminalInfos$ 首发并且 ip 池非空之后再返回的机制，同时不破坏已有同步 API。为避免调用点配置漂移，等待超时固定为 30 秒且无可覆盖参数。

## Goals & Non-Goals / 目标与非目标

**Goals**

- 在 terminalInfos$ 首发前通过等待机制避免误判“无代理 ip”。
- 保留同步 API，新增异步 API 并改造需要 proxy 的调用点。
- 明确固定 30_000ms 超时、空池与日志语义，并提供可测试断言。

**Non-Goals**

- 不改变 terminalInfos$ 的生命周期管理与 HostEvent 订阅逻辑。
- 不引入新的依赖或跨包基础设施。
- 不统一改造所有 HTTP 客户端，仅修改需要 proxy ip 的 vendor 调用点。

## Definitions / 术语

- terminalInfos$: Terminal 内部 ReplaySubject，首次 next 在 GetTerminalInfos 成功后。
- ip pool: listHTTPProxyIps(terminal) 过滤可信 ip 后的可用列表。
- terminalInfos$ 可用性：`terminal.terminalInfos$ != null` 且 `typeof terminal.terminalInfos$?.subscribe === 'function'`。
- selectHTTPProxyIpRoundRobin(terminal): 同步选择 ip，空池抛 E_PROXY_TARGET_NOT_FOUND。
- waitForHTTPProxyIps(terminal): 新增异步等待 helper。

## 现状问题

- 启动阶段 terminalInfos$ 未首发时，listHTTPProxyIps 为空，selectHTTPProxyIpRoundRobin 直接抛 E_PROXY_TARGET_NOT_FOUND。
- 该错误并非“真实无代理”，而是“尚未就绪”。

## 方案 A 设计

新增异步 helper 等待 terminalInfos$ 首发并重算 ip 列表；同时提供异步 round-robin 选择 API。同步 API 保持不变。

### 接口定义

```ts
export function waitForHTTPProxyIps(terminal: Terminal): Promise<string[]>;

export function selectHTTPProxyIpRoundRobinAsync(terminal: Terminal): Promise<string>;
```

固定超时常量：`TIMEOUT_MS = 30_000`（不可配置）。

### Protocol Overview / 端到端流程

1. 调用 waitForHTTPProxyIps 先执行 listHTTPProxyIps。
2. 若列表非空，立即返回。
3. 若 terminalInfos$ 不可用，立即抛 E_PROXY_TARGET_NOT_FOUND（reason=empty_pool）。
4. 订阅 terminalInfos$；每次变更时重算 ip pool：
   - ip pool 非空：返回结果。
   - ip pool 仍为空：继续等待，直到超时。
5. 超时仍未返回，抛 E_PROXY_TARGET_NOT_FOUND（reason=timeout）。
6. selectHTTPProxyIpRoundRobinAsync 在 waitForHTTPProxyIps 成功后执行 round-robin 选择。

### State Machine / 状态机

状态：

- Idle：尚未检查。
- AwaitingInfos：已确认空池且已订阅 terminalInfos$。
- Ready：ip 列表非空并返回。
- TimedOut：超时失败。

转移：

- Idle -> Ready：首次 listHTTPProxyIps 非空。
- Idle -> AwaitingInfos：首次 listHTTPProxyIps 为空且 terminalInfos$ 可用。
- AwaitingInfos -> Ready：terminalInfos$ 变更后 ip 列表非空。
- Idle/AwaitingInfos -> TimedOut：等待超过 30_000ms。

## Data Model / 数据模型

### 输入参数

- 无可配置参数。

### 输出/错误

- 成功返回 string[] 或 string。
- 失败统一抛 E_PROXY_TARGET_NOT_FOUND，使用 newError 结构化信息：
- `newError('E_PROXY_TARGET_NOT_FOUND', { reason, terminal_id, timeoutMs })`
- terminal_id 来源：`terminal.terminal_id`，若不可用则写入 `'unknown'`。
- timeoutMs 固定为 30_000（不可配置）。
- 所有失败路径（timeout/empty_pool）必须使用相同 payload 结构。

## Error Contract / 错误契约

- 唯一错误形态：`newError('E_PROXY_TARGET_NOT_FOUND', { reason, terminal_id, timeoutMs })`
- timeoutMs 字段固定为 30_000。
- reason 取值：`timeout` / `empty_pool`
- terminal_id 缺失策略：一律写入 `'unknown'`
- reason 可取：
  - timeout: 等待窗口内未出现任何可用 ip（包含未就绪与无代理）。
  - empty_pool: terminalInfos$ 不可用（无法订阅）。

### 兼容策略

- 同步 API 仍保留原行为与签名。
- 异步 API 在 index.ts 导出，按需改造调用点。

## Error Semantics / 错误语义

timeout 语义覆盖“等待窗口内未出现可用 ip”的所有原因（含未就绪与无代理）。等待窗口固定为 30 秒，不允许调用点覆盖。

R1. waitForHTTPProxyIps MUST 在首次 listHTTPProxyIps 非空时立即 resolve，不得订阅 terminalInfos$。
R2. terminalInfos$ 不可用且初始空池时 MUST 立即以 newError('E_PROXY_TARGET_NOT_FOUND', { reason: 'empty_pool', terminal_id, timeoutMs: 30_000 }) reject；该分支用于非标准 Terminal/测试双场景的防御。
R3. 订阅 terminalInfos$ 后，每次变更 MUST 重新计算 ip pool；若仍为空 MUST 继续等待直到超时。
R4. 超时 MUST 以 newError('E_PROXY_TARGET_NOT_FOUND', { reason: 'timeout', terminal_id, timeoutMs: 30_000 }) reject，timeout 代表等待窗口内未出现可用 ip（包含未就绪与无代理）。
R5. selectHTTPProxyIpRoundRobinAsync MUST 基于 waitForHTTPProxyIps 的结果执行 round-robin；若 waitForHTTPProxyIps 失败则原样抛出。
R6. 超时日志 MUST 仅包含 terminal_id 与 timeoutMs，并对 terminal_id 维度限频。
R7. 所有失败路径 MUST 使用相同错误 payload 结构，terminal_id 缺失一律写入 'unknown'，timeoutMs 固定为 30_000。

## Observability / 观测

- 仅在超时失败时记录日志（R6）。
- 日志不包含 ip 列表或敏感字段。
- 限频规则：以 terminal_id 为粒度，复用 `libraries/http-services/src/proxy-ip.ts` 既有常量 `MISSING_IP_LOG_INTERVAL = 3_600_000`，避免新增配置并与缺失 ip 日志保持一致。
  - 说明：该常量已存在于 proxy-ip.ts 内部，无需新增导出；timeout 日志与缺失 ip 日志在同模块内复用。

## Operational Guidance / 运行策略

- 仅在 `USE_HTTP_PROXY=true` 的调用路径启用等待逻辑，预期存在 proxy 终端。
- 等待窗口固定为 30 秒，调用点不得传参与覆盖；无 proxy 环境应避免触发该路径。
- 基准/示例：benchmarks 保持同步调用，不引入等待成本。

## Backward Compatibility & Rollout / 兼容性与灰度

- 同步 API 不变；原调用点保持可编译。
- 仅 vendor HTTP 请求上下文改为 async；不改动非 proxy 相关请求路径。
- 可按 vendor 分批替换，支持灰度上线。

## 迁移步骤

1. 在 `libraries/http-services/src/proxy-ip.ts` 增加 waitForHTTPProxyIps 与 selectHTTPProxyIpRoundRobinAsync。
2. 在 `libraries/http-services/src/index.ts` 导出新增 API。
3. 全仓库基于 `rg "selectHTTPProxyIpRoundRobin"` 搜索调用点并逐一改造（或说明不改造原因）；当前清单：
   - `apps/vendor-binance/src/api/client.ts`（2 处调用点）
   - `apps/vendor-aster/src/api/public-api.ts`
   - `apps/vendor-aster/src/api/private-api.ts`
   - `apps/vendor-bitget/src/api/client.ts`
   - `apps/vendor-gate/src/api/http-client.ts`
   - `apps/vendor-huobi/src/api/public-api.ts`
   - `apps/vendor-huobi/src/api/private-api.ts`
   - `apps/vendor-hyperliquid/src/api/client.ts`
   - `apps/vendor-okx/src/api/public-api.ts`
   - `apps/vendor-okx/src/api/private-api.ts`
   - `libraries/http-services/benchmarks/index.ts`（基准测试保留同步调用，无需等待）
   - 清单生成方法：`rg "selectHTTPProxyIpRoundRobin"` 全仓库扫描，并辅以 `rg "from '@yuants/http-services'"` 复核别名导入；排除项需在清单中标注理由。
4. 调用点不得再传 timeout 参数；移除所有 timeoutMs 相关覆写逻辑。
5. 迁移验收（必须满足）：
   - `rg "selectHTTPProxyIpRoundRobin"` 结果仅允许 `libraries/http-services/benchmarks/index.ts`。
   - `selectHTTPProxyIpRoundRobinAsync` 仅以单一参数调用（不得出现第二参数）。
   - vendor 调用点不再出现 timeoutMs/options 相关覆写逻辑。

## Testability / 可测试性

每条 MUST 行为可映射到测试断言：

- R1: 初始 listHTTPProxyIps 非空时不订阅 terminalInfos$，直接返回结果。
- R2: terminalInfos$ 不可用且空池时立即抛 E_PROXY_TARGET_NOT_FOUND，reason=empty_pool 且 timeoutMs=30_000。
- R3: 订阅 terminalInfos$ 后 ip pool 仍为空则持续等待，直到超时。
- R4: 超时后抛 E_PROXY_TARGET_NOT_FOUND，reason=timeout 且 timeoutMs=30_000。
- R5: 异步 round-robin 仅在 waitForHTTPProxyIps 成功后执行。
- R6: 超时日志只包含 terminal_id 与 timeoutMs 且按 terminal_id 限频。
- R7: 所有失败路径错误 payload 同构，terminal_id 缺失写入 'unknown'。

## 安全性与资源考虑 / Security Considerations

- MUST 在成功或失败时释放 terminalInfos$ 订阅，避免资源泄漏。
- 固定 30 秒等待窗口防止无界等待与滥用资源消耗。
- 日志仅记录最小上下文，避免泄露代理信息。

## 兼容性与迁移 / Backward Compatibility & Rollout

- 保持同步 API 行为，避免影响未改造调用点。
- 异步 API 新增不破坏现有导出结构。
- 调用点签名变更为无 options 参数，确保不存在隐式超时覆盖。

## 测试计划

- 单元测试：覆盖 R1-R4 的等待与超时语义。
- 单元测试：覆盖 terminalInfos$ 不可用的 empty_pool 分支（R2）。
- 观测测试：验证超时日志限频与字段最小化（R6）。
- 冒烟测试：选一至两个 vendor 启动并发起请求，确认不再因启动阶段抛 E_PROXY_TARGET_NOT_FOUND。

## 风险与回滚

- 风险：等待逻辑订阅未正确释放导致资源泄漏或重复订阅。
- 风险：调用点 async 化导致上下游未 await。
- 风险：固定 30 秒超时在无 proxy 环境下造成等待成本。
- 回滚：恢复 vendor 调用点为同步 API，并移除/停用异步导出；确认启动阶段仍可能触发旧空池问题并接受该风险。

## Open Questions / 未决项

- (暂无)

## Plan

1. 核心流程：在 waitForHTTPProxyIps 内先 list，再基于 terminalInfos$ 订阅等待非空或 30_000ms 超时；selectHTTPProxyIpRoundRobinAsync 依赖该结果。
2. 接口定义：新增 waitForHTTPProxyIps 与 selectHTTPProxyIpRoundRobinAsync，接口不带 options 参数，超时固定 30_000ms。
3. 文件变更明细：仅改 `libraries/http-services/src/proxy-ip.ts`、`libraries/http-services/src/index.ts` 与列出的 vendor HTTP 调用点（移除 timeout 传参）。
4. 验证策略：单元测试覆盖 R1-R4；超时日志限频验证；选定 vendor 冒烟验证启动阶段不再抛 E_PROXY_TARGET_NOT_FOUND。
