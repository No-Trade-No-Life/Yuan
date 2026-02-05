# RFC: HTTP Proxy 目标域名流量指标（收敛版）

## Abstract

本 RFC 定义 HTTP Proxy 服务在 `http_proxy_requests_total` 上增加“目标域名 + 路径”维度的统计标签。指标解析 MUST 仅复用 handler 内 `new URL(req.url)` 的解析结果（`parse_result`），不得二次解析。RFC 删除 scheme 白名单约束，仅依赖 `new URL` 的解析成功与否；非 absolute-form 仍因解析失败归 `invalid_url`。解析成功但 `hostname` 为空（如 `file:`/`mailto:`）视为 `invalid_url`，`target_host` 固定为 `invalid`，`target_path` 固定为 `invalid`。IP 字面量目标的 `target_host` 固定为 `ip`。`error_code` 延续现有映射逻辑。指标统计与 `allowedHosts` 无关，记录所有 fetch 目标的 host 与 path。该 RFC 的 Plan 章节为工程执行的唯一设计真源。

## Motivation / 背景与问题

当前 HTTP Proxy 服务仅提供总体请求数、耗时与错误总量指标，无法按目标域名观察流量分布与异常。缺少目标域名维度会导致排障困难与成本决策盲区。

## Goals & Non-Goals

### Goals

- 扩展 `http_proxy_requests_total`，新增 `target_host`/`target_path` 标签用于按 host/path 聚合。
- 不改变现有请求处理、解析与 SSRF 行为。

### Non-Goals

- 不新增 scheme 白名单或额外协议过滤。
- 不改变现有错误码与抛出逻辑。
- 不新增 `allowedHosts` 的强制校验/上限或 fail-fast 行为。

## Definitions

- raw_url: 请求中的 `req.url` 原始字符串。
- absolute-form: `req.url` 为完整 URL（含 scheme 与 host）。
- parse_result: handler 内部 `new URL(raw_url)` 得到的 URL 实例（即 `urlObj`）。
- normalized_host: `parse_result.hostname` 先 ASCII 小写化，再去除尾部 `.` 的结果。
- allowedHosts: HTTP Proxy 现有配置的主机白名单（语义保持现状）。
- target_host: 指标 label `target_host` 的最终值。
- target_path: 指标 label `target_path` 的最终值（来自 URL pathname）。
- effective_error_code: 抛错时用于 `error_code` 记录的错误码（来源见 Error Semantics）。

## Protocol Overview（端到端流程）

请求进入 handler 后先执行 `new URL(req.url)` 解析并进入既有 SSRF/请求流程；若解析失败则按 `invalid_url` 处理。请求结束时计算 `target_host`/`target_path` 并在 `http_proxy_requests_total` 计数一次。

R1: 指标解析 MUST 仅复用 handler 内 `parse_result`，不得重新解析 `raw_url` 或构造新的 URL 实例。

R2: 当 `new URL(raw_url)` 解析失败时，`parse_result` MUST 视为不存在，`target_host`/`target_path` MUST 为 `invalid`，且 `error_code` 归一化为 `INVALID_URL`。

R3: 当 `parse_result.hostname` 为空字符串时，`target_host`/`target_path` MUST 为 `invalid`。

R4: 本 RFC MUST NOT 引入额外 scheme 过滤或白名单；`invalid_url` 由解析失败或 hostname 为空触发。

R5: 实现 MUST 在 `http_proxy_requests_total` 中追加 `target_host`/`target_path` 标签，且不依赖 `allowedHosts`。

> [REVIEW] 这是谁说的？为什么 allowedHosts 缺失就不统计了？我要的就是所有的底层 fetch 要去的 host url 的 path 部分的 metrisc 统计，和安全没有什么关系，你这个想复杂了。
>
> [RESPONSE] 已调整：指标不再依赖 allowedHosts，新增 target_path 维度，统计所有 fetch 目标的 host+path；与安全/allowedHosts 无关。
> [STATUS:resolved]

R6: 每个请求 MUST 仅计数一次，计数点 MUST 位于请求生命周期末尾（handler 已返回或抛错）。

R7: `error_code` MUST 仅由 handler 的返回/抛错路径与既有错误语义决定；不得引入“写回成功”判定。

## Data Model

指标定义如下（扩展现有指标）：

- 名称: `http_proxy_requests_total`
- 类型: Counter
- Labels:
  - 既有标签：`method`、`status_code`、`error_code`、服务 `labels`
  - 新增标签：`target_host`、`target_path`

R9: 当 `parse_result` 不存在或 `parse_result.hostname` 为空字符串时，`target_host` MUST 为 `invalid`，`target_path` MUST 为 `invalid`。

R10: 当 `parse_result.hostname` 被 `net.isIP` 判定为 IP 字面量时，`target_host` MUST 为 `ip`。

R11: 其他情况，`normalized_host` MUST 由 `parse_result.hostname` 按“ASCII 小写 + 去尾点”规范化得到，并作为 `target_host`。

R12: 当 `parse_result` 存在且 `parse_result.hostname` 非空时，`target_path` MUST 取 `parse_result.pathname`；若为空则 MUST 取 `/`。

R13: 所有占位符值 MUST 为固定小集合：`ip`、`invalid`。

## Error Semantics

R17: 本 RFC MUST 复用现有错误语义，不得改变错误码与抛出逻辑。

R18: 当 handler 抛错时，实现 MUST 计算 `effective_error_code`，来源按以下顺序尝试（仅限可检测字段）：`error.code`、`error.cause?.code`、`error.message` 的前缀（`CODE:` 形式）、`error.name`（仅用于 `AbortError`/`TimeoutError` 映射为 `TIMEOUT`）。

R19: `error_code` 标签 SHOULD 使用 `effective_error_code`（将 `ERR_INVALID_URL` 归一化为 `INVALID_URL`）；若未得到有效值，则回退 `error.message` 前缀；仍为空时使用 `FETCH_FAILED`。

R20: 当 handler 正常返回时，`error_code` MUST 为 `none`。

## Security Considerations

R25: 指标 MUST NOT 记录原始 URL 与 query/fragment；`target_path` 仅记录 `pathname`。

R26: 指标解析 MUST 复用现有 SSRF/请求解析结果，避免解析分歧导致安全绕过。

R27: 指标采集与 `allowedHosts` 无关，记录所有 fetch 目标的 host/path；部署侧需自行承担开放代理与超时风险，并确保入口鉴权与限流策略。

## Backward Compatibility & Rollout

R28: 现有 `http_proxy_requests_total` 新增标签，旧仪表盘需补齐标签或通过 `ignoring`/`sum without` 兼容。

R29: 本 RFC 不改变既有请求解析与 SSRF 行为；仅移除新增 scheme 白名单的要求，避免对请求行为产生新约束。

R30: `http_proxy_requests_total` 新增 `target_host`/`target_path` 标签。

R31: Rollout MAY 先在单个实例灰度，观察新指标时序与基数增长。

R32: 回滚策略 MUST 删除 `http_proxy_requests_total` 的 `target_host`/`target_path` 采集逻辑，避免新增标签继续暴露。

## Testability

每条 MUST 行为均可映射到测试断言：

- R1-R3: 指标解析仅复用 `parse_result`，不新增 scheme 过滤；`new URL` 失败触发 `invalid_url`。
- R4-R7: `http_proxy_requests_total` 追加标签且计数位置固定，每请求仅计数一次。
- R9-R13: `target_host`/`target_path` 规则可通过 label 断言验证。
- R18-R20: `error_code` 采用 error.code/等价信号映射，正常返回为 `none`。
- R27-R32: 兼容/回滚行为与告警日志可验证。

最小验证用例（至少 3 条）：

1. hostname 规范化

   - 请求 `http://api.example.com/v1/ping`
   - 期望：`target_host="api.example.com"`，`target_path="/v1/ping"`，`error_code="none"`

2. 解析成功但 hostname 为空

   - 请求 `raw_url="file:///etc/hosts"`
   - 期望：`target_host="invalid"`，`target_path="invalid"`，`error_code="none"`

3. IP 字面量被 SSRF 阻断

   - 请求 `http://127.0.0.1/`
   - SSRF 阻断该请求并抛错
   - 期望：`target_host="ip"`，`error_code="FORBIDDEN"`

4. IP 字面量未被 SSRF 阻断

   - 请求 `http://127.0.0.1/`
   - SSRF 放行且 handler 正常返回
   - 期望：`target_host="ip"`，`error_code="none"`

5. handler 抛错按 error.code 映射

   - 任意请求触发 `newError('INVALID_URL')`
   - 期望：`error_code="INVALID_URL"`

6. allowedHosts 含端口
   - 配置 `allowedHosts=["api.example.com:443"]`
   - 期望：该条永不匹配；若被 SSRF 阻断则 `error_code="FORBIDDEN"`

## Open Questions

1. 是否需要在观测文档中明确“非 http/https 的 URL 仅按现有 handler 行为处理”，以避免误读为新增协议支持？

2. 维度爆炸风险（预留方案 / TODO）
   - 当前 `target_path` 可能导致高基数。
   - 预留方案（未来可选）：
     - 路径归一化：仅保留前 1-2 级路径；或对数字/UUID 段替换为 `:id`。
     - 前缀过滤：仅统计特定路径前缀，其余归为 `other/overflow`。
     - 分层指标：默认仅 `target_host`，`target_path` 作为 debug/短期排障开关。

## Plan

### 核心流程

- 仅使用 `parse_result`（handler 内 `new URL(req.url)` 结果）计算 `target_host` 与 `target_path`；解析失败或 hostname 为空归 `invalid`。
- `target_host` 规则：IP 字面量固定为 `ip`；非 IP 采用 `normalized_host`（ASCII 小写 + 去尾点）。
- `target_path` 规则：使用 `parse_result.pathname`，为空则 `/`；解析失败或 hostname 为空时为 `invalid`。
- `error_code` 维持现有映射逻辑；正常返回时为 `none`。

### 接口定义

- 无新增外部接口；扩展 `http_proxy_requests_total` 新增 `target_host`/`target_path` 标签。

### 文件变更明细

- `libraries/http-services/src/server.ts`：扩展 `http_proxy_requests_total` 标签并在末尾采集。
- `libraries/http-services/src/__tests__/server.test.ts`：补充 target_host/target_path 断言。
- `libraries/http-services/grafana-dashboard.json`：新增 target_host/target_path 面板与筛选项。

### 验证策略

- 单测：覆盖 `new URL(req.url)` 解析失败/hostname 为空、target_path 采集、IP 字面量 target_host 固定、`error.code` 映射与 SSRF 阻断语义。
- 手工验证：灰度实例上发起不同目标域名/不同 scheme 请求，确认 `target_host`/`target_path` 标签输出符合预期。
