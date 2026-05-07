# RFC: 新 Host（隔离部署）重构：ED25519 授权链 + JWT 双 Token 滚动

> **Profile**: RFC Heavy (Epic/High-risk)  
> **Status**: Draft  
> **Owners**: agent/user  
> **Created**: 2026-03-14  
> **Last Updated**: 2026-03-14

---

## Executive Summary（<= 20 行）

- **Problem**: 现有 `apps/host` 认证授权耦合、语义弱，无法满足高风险场景下的连接期验权、会话期滚动授权与可审计回滚。
- **Decision**: 新建 `apps/host-v2/**`，与老 Host 代码层隔离；引入“连接期 ED25519 授权链校验 + 会话期 JWT Access/Refresh 双 Token + 管理密钥轮换”。
- **Why now**: 当前 `resolveHost` 仅静态 token/弱验签（且 `host_id='main'` 覆盖）存在安全与演进风险；继续原地补丁会增加不可回滚耦合。
- **Impact**: 影响 Host 接入鉴权协议、token 生命周期、运维密钥流程、监控告警与灰度策略；不影响老 Host 运行。
- **Risks**: 密钥泄露、refresh 重放、灰度协议不一致、验签 DoS。
- **Blocking closure**: 本版新增 5 项阻塞闭环条款：refresh 并发原子语义、nonce 跨实例一致性、chain/handshake 职责边界、回滚 token 兼容、密钥轮换失败回退。
- **Rollout**: 双栈并行（host + host-v2），按环境与流量分层灰度，默认 fail-closed。
- **Rollback**: 通过流量开关/路由标签一键回切老 Host，保留短窗口 token 兼容兜底。

---

## 1. 背景 / 动机

- 现状：老 Host 在 `apps/host/src/host-manager.ts` 里将连接管理、消息转发、认证逻辑集中在单文件实现。
- 痛点：
  - 认证入口 `resolveHost` 与业务转发强耦合（证据：`host-manager.ts` 300-346）。
  - ED25519 仅对空串验签，缺少 challenge/nonce/timestamp，且 `host_id` 被固定为 `main`（328-337）。
  - 无 JWT 双 token 生命周期：无刷新轮换、无撤销、无重放检测。
  - 错误语义粗糙（HTTP 401/500、WS 1008），不利于排障与客户端自愈。
- 影响范围：WS 连接、HTTP `/request`、`/external/*`、Host 内部服务鉴权入口。
- 关键背景：`plan.md` 已将任务定位为 high-risk + design-only + 新旧隔离。

## 2. Goals

1. 在 `apps/host-v2/**` 设计并后续实现完整认证授权闭环：Authentication + Authorization 一体化。
2. 连接时支持 ED25519 授权链校验，具备抗重放、可追溯、可拒绝语义。
3. 会话期支持 JWT Access + Refresh 双 token（签发、轮换、撤销、过期、重放防护）。
4. Host 自持管理权限 ED25519 密钥对，具备生成/加载/轮换/灾备流程。
5. 新旧 Host 代码与部署路径直接隔离，支持灰度与快速回滚。

## 3. Non-goals

- 不实现多租户模型（本期单租户）。
- 不在本阶段修改 `apps/host` 生产代码。
- 不将本期扩展为统一 IAM 平台或全仓库服务网关改造。

## 4. Constraints（硬约束）

- Compatibility / API contract: 保持客户端可通过 WS 与 HTTP `/request` 接入；新增鉴权字段需可显式协商版本。
- Performance / SLO: 鉴权链路必须可限流，避免签名验证导致连接面雪崩。
- Security / privacy: 默认 fail-closed；密钥不落日志；输入必须严格校验。
- Operational: 新旧 Host 双栈并行，发布过程必须可回切。
- Dependency / rollout constraints: `stage=design-only`，仅产出文档，不写生产代码。

## 5. Definitions / Glossary

- **授权链（Authorization Chain）**：连接方提交的一组声明（公钥、声明体、上游签名、时效参数），Host 按预设信任根与策略逐跳验证。
- **管理密钥对（Host Admin Keypair）**：Host-v2 用于签发 JWT 的 ED25519 私钥/公钥。
- **Access Token**：短期令牌，携带最小权限声明，用于请求鉴权。
- **Refresh Token**：长于 access 的令牌，仅用于换取新 access（并触发 refresh 轮换）。
- **Token Family**：同一登录链路衍生的一组 refresh token，通过 family_id 管控重放与整族吊销。

---

## 6. Proposed Design（端到端）

### 6.1 高层架构

#### 模块边界（仅设计）

- `apps/host-v2/src/bootstrap/*`
  - 职责：启动 HTTP/HTTPS/WS、加载配置、初始化依赖。
- `apps/host-v2/src/auth/handshake/*`
  - 职责：连接期 ED25519 授权链校验，输出 `Principal`。
- `apps/host-v2/src/auth/jwt/*`
  - 职责：Access/Refresh 签发、校验、轮换、撤销。
- `apps/host-v2/src/authz/*`
  - 职责：基于 `Principal + scopes` 的请求级授权决策。
- `apps/host-v2/src/keyring/*`
  - 职责：管理密钥加载、key id（kid）选择、轮换窗口控制。
- `apps/host-v2/src/session/*`
  - 职责：会话状态、refresh family、nonce/jti 索引。
- `apps/host-v2/src/transport/*`
  - 职责：WS 与 HTTP 入口适配、错误码映射、审计日志打点。

#### 信任边界

1. **外部客户端 → Host-v2 边界**：不可信输入，必须先过 handshake 验证与限流。
2. **Host-v2 Auth → Host-v2 Core 边界**：只传递经过验证的 `Principal`，禁止原始声明直透。
3. **Host-v2 → Key 存储边界**：私钥读取最小化，进程内短驻留，日志不可见。
4. **Host-v2 与旧 Host 边界**：代码、配置、部署与回滚开关独立。

#### 端到端流程

1. 客户端发起 WS/HTTP 连接并提交握手材料（授权链 + challenge 回签 + 可选 access token）。
2. `handshake` 模块校验授权链（签名、时效、信任根、用途）。
3. 成功后生成 `Principal`，由 `authz` 决定是否允许连接/请求。
4. 若需要会话化，`jwt` 签发 access + refresh，并记录 session/family/jti。
5. 后续请求携带 access；过期后通过 refresh endpoint 轮换，旧 refresh 立即失效。
6. 检测到重放或密钥轮换事件时，按策略吊销 token/family 并返回明确错误码。

### 6.2 Detailed Design（关键细节）

#### 6.2.1 接口草案（Data Model / Interfaces）

```text
interface HandshakeRequest {
  terminal_id?: string
  chain: AuthChainClaim[]
  nonce: string
  timestamp_ms: number
  signature: string            // 对 canonical(handshake_payload) 的 ED25519 签名
  access_token?: string
}

interface Principal {
  subject: string              // 终端或实体标识
  chain_root: string           // 信任根标识
  scopes: string[]
  session_id?: string
}

interface TokenPair {
  access_token: string
  refresh_token: string
  expires_in_sec: number
  refresh_expires_in_sec: number
  kid: string
}
```

约束与兼容策略：

- 版本化字段：`chain[*].v`、token claims 中 `ver`；不认识的高版本默认拒绝（fail-closed）。
- 必填字段严格校验：缺失即 `AUTH_INVALID_REQUEST`。
- 时间窗口：`timestamp_ms` 默认允许偏移 ±60s；超窗拒绝。
- `terminal_id` 未提供时由服务端生成，但绑定到当前 `Principal.subject`，禁止跨主体复用。

#### 6.2.2 ED25519 授权链模型（连接时验证）

职责边界（MUST）：

- `chain` **只负责**证明委托关系与授权范围（who can delegate what）。
- `handshake signature` **只负责**证明本次连接的新鲜度、私钥持有证明与传输绑定（proof-of-possession + freshness + transport binding）。
- 两者不得互相替代：`chain` 通过也不能跳过 `handshake signature`；`handshake signature` 通过也不能跳过 `chain`。

canonical 原文字段（MUST，固定顺序）：

1. `method`（`WS`/`HTTP`）
2. `path`（例如 `/request`）
3. `terminal_id`（空值按空串）
4. `nonce`
5. `timestamp_ms`
6. `chain_digest`（对 `chain` 的 canonical JSON 做 SHA-256）

示例：
`WS\n/request\nterminal-42\nN-abc123\n1710000000123\nsha256:9f...`

验证顺序（必须固定，防止绕过）：

1. 解析与 canonical 化输入（确定签名原文，防字段重排攻击）。
2. 轻量校验 `timestamp_ms` 与请求大小上限（先过滤明显无效流量，降低 DoS 成本）。
3. 校验 `handshake signature`（验证连接新鲜度与持有证明）。
4. 执行 `nonce` 一次性去重（见 6.2.2.1）。
5. 自叶到根验证每一跳 ED25519 链签名。
6. 校验链上声明的用途（`use=host-connect`）、作用域与最短有效期。
7. 校验根公钥是否在信任根集合中。
8. 生成 `Principal` 并进入授权决策。

顺序理由：先做低成本“新鲜度 + 持有证明”再做高成本链验签，可降低恶意流量对链验签 CPU 的消耗；同时保留“signature + nonce + chain”三重门禁，避免单点绕过。

#### 6.2.2.1 Nonce 重放防护（跨实例一致性）

- 去重键（MUST）：`nonce_key = issuer + ":" + purpose + ":" + nonce`，其中 `purpose` 固定为 `host-connect`。
- 存储域（MUST）：nonce 去重必须使用跨实例共享、支持原子 `SETNX + TTL` 的存储；进程内内存去重仅可作为本地缓存优化，不得作为安全判断依据。
- TTL（MUST）：`nonce_ttl_ms = max(2 * allowed_clock_skew_ms, 120000)`；默认 `allowed_clock_skew_ms=60000`。
- 时钟基准（MUST）：以服务端时钟为准；请求携带时间戳仅用于偏移判断，不作为写入时间来源。
- 时钟观测（SHOULD）：记录 `clock_skew_ms`（服务端接收时间 - 请求 timestamp）分布，用于发现 NTP 漂移或客户端异常。

失败语义：

- 任一步失败立即终止，不进入业务逻辑。
- 返回可机器处理错误码（见第 10 节），并在审计日志记录失败阶段 `failed_stage`。

#### 6.2.3 JWT 双 Token 设计

签发：

- Access（短期，建议 5-15 分钟）：携带 `sub/sid/scopes/aud/iss/exp/iat/jti/kid/ver`。
- Refresh（中期，建议 7-30 天）：携带 `sub/sid/family_id/jti/rot/ver/exp/kid`。

轮换：

- Refresh 每次使用都签发新 refresh，旧 refresh 立即标记 consumed。
- 若同一 refresh 再次被使用，判定 **reuse attack**，吊销整个 `family_id`。

#### 6.2.3.1 Refresh 并发原子语义与幂等

状态机（MUST）：

- `refresh_state ∈ {active, consumed, revoked}`。
- 仅允许原子迁移：`active -> consumed`（由成功刷新触发）；`active|consumed -> revoked`（由安全策略触发）。

原子更新（MUST）：

- 刷新处理必须以“条件更新/比较并交换（CAS）”完成：仅当 `state=active` 且 `version` 匹配时才可消费该 refresh。
- 任一非原子读后写实现均不符合本 RFC。

幂等窗口（MUST）：

- 客户端必须提供 `request_id`（或 `Idempotency-Key`）；服务端按 `(refresh_jti, request_id)` 建立幂等索引，TTL 默认 2 秒。
- 同一 `(refresh_jti, request_id)` 的重复请求必须返回**同一** `TokenPair`（或同一错误），不得触发 `family_id` 吊销。

reuse 判定（MUST）：

- 仅当 refresh 已 `consumed` 且出现**不同** `request_id` 的再次使用，才判定为 `reuse attack` 并吊销整族。
- 若缺失 `request_id`，服务端按不同请求处理，第二次及以后命中 `consumed` 直接进入 reuse 判定。

撤销：

- 支持按维度撤销：`jti`、`session_id`、`family_id`、`subject`。
- 撤销索引需具备 TTL，与 token 最大生命周期一致。

过期与重放防护：

- Access 过期只允许走 refresh；不支持隐式续期。
- Refresh 过期/撤销/reuse 均返回 `AUTH_REFRESH_INVALID`。
- 建议对 refresh endpoint 增加客户端指纹（可选）和速率限制。

#### 6.2.4 Host 管理密钥对策略

生成：

- 初始部署生成 `kid=v1` ED25519 keypair；私钥仅在安全介质存储。

加载：

- 启动时加载活动私钥 + 至少一个历史公钥窗口（用于校验旧 token）。
- 进程内只暴露签发器接口，不暴露私钥原文。

轮换：

- 双窗口策略：`active_kid` 签发，新旧公钥并存校验。
- 轮换采用候选态（MUST）：`active_kid` + `candidate_kid`。
- 轮换步骤（MUST）：预加载 `candidate_kid` 公钥 → shadow 验签观测达标 → promote 为 `active_kid` 开始签发 → 观察窗口 → 下线旧 kid。

失败回退（MUST）：

- 自动回退触发器：
  - `token_sign_failure_rate > 0.5%` 持续 3 分钟；或
  - `unknown_kid_verify_count` 超过基线 3 倍并持续 3 分钟。
- 回退动作：
  1. 立即停止 `candidate_kid` 签发；
  2. 恢复旧 `active_kid` 签发；
  3. 保留已签发 token 的校验窗口，不默认吊销既有 `family_id`；
  4. 触发 `AUTH_KID_ROLLBACK_ACTIVE` 运维告警事件并进入 runbook。

灾备：

- 私钥泄露应急：冻结签发、吊销相关 family/session、切换新 kid、触发强制重登。
- 提供 runbook：30 分钟内完成“停签-切钥-恢复签发”。

---

## 7. Threat Model（攻击面与信任边界）

### 7.1 攻击面

- 握手参数篡改、重放历史签名、伪造授权链节点。
- refresh token 窃取后重放。
- kid 欺骗（伪造 header 指向不存在或旧 key）。
- 高频握手验签与刷新请求导致 DoS。
- `/external/*` 入口携带超大负载或恶意头部。

### 7.2 信任边界与假设

- 客户端环境不可信，所有声明都必须可验证。
- Host-v2 进程可信但可能被高压流量打垮，需强限流与失败快返。
- Key 存储系统在权限模型上可信，但需防配置错误（加载错 key/kid）。

### 7.3 防护策略摘要

- 连接期：nonce + 时间窗 + 授权链逐跳验签 + 固定 canonical 串。
- 会话期：short access + one-time refresh + family reuse 检测。
- 运行期：速率限制、payload 限制、错误分层、审计与告警闭环。

---

## 8. Alternatives Considered（>=2）

### Option A：在 `apps/host` 原地增强（不新建 host-v2）

- Pros: 上线路径最短，复用现有部署。
- Cons: 认证与转发耦合继续扩大；回滚粒度粗；高风险逻辑混入旧文件。
- Why not: 不满足“新旧代码层直接隔离”的硬约束，回滚风险不可接受。

### Option B：仅 JWT，不做 ED25519 授权链

- Pros: 实现复杂度较低，团队熟悉度高。
- Cons: 连接初始身份证明弱，无法覆盖“授权链”场景。
- Why not: 与任务核心目标（连接时 ED25519 链校验）冲突。

### Option C：引入外部 IAM 服务托管签发与校验

- Pros: 安全能力集中、策略统一。
- Cons: 额外基础设施依赖、迁移周期长、短期回滚复杂。
- Why not: 超出当前 scope，且会延迟“先隔离再灰度”的目标。

### Decision

- 选择：**Option D（推荐）= 新建 host-v2，内置 ED25519 链校验 + JWT 双 token，双栈灰度**。
- 原因：
  - 满足隔离回滚硬约束。
  - 连接期与会话期安全闭环完整。
  - 可按里程碑拆分，逐步交付并可验收。
  - 对现有客户端协议兼容空间可控。
- 放弃的东西（明确）：
  - 放弃“原地小改快上”（牺牲短期速度换取安全与回滚能力）。
  - 放弃“只做 JWT 简化版”（牺牲实现简易性换取连接身份强证明）。
  - 放弃“一步到位平台化 IAM”（避免 scope 膨胀）。

---

## 9. Migration / Rollout / Rollback（强制）

### 9.1 Migration Plan

- 是否有数据迁移：有（会话状态、撤销索引属于运行态数据迁移/并行新建）。
- 迁移步骤：
  1. 部署 host-v2（不接生产流量），完成健康检查与 smoke test。
  2. 开启只读观测模式（校验请求但不放量），比对 auth 成败分布。
  3. 小流量灰度（1% → 10% → 50% → 100%）。
  4. 达到稳定阈值后，切默认入口到 host-v2；保留老 Host 旁路。
- 双写/切换策略：
  - token 撤销索引仅在 host-v2 生效；灰度期间旧 Host 继续独立认证，不共享写路径。

### 9.2 Rollout Plan

- Feature flags / 配置项（建议）：
  - `HOST_V2_ENABLED`
  - `HOST_V2_HANDSHAKE_ENFORCE`
  - `HOST_V2_JWT_ISSUER`
  - `HOST_V2_ACTIVE_KID`
- 灰度策略：按环境（dev/staging/prod）+ 按连接来源标签分批。
- 验收指标：
  - 握手成功率 ≥ 99.9%（排除恶意流量）
  - refresh 成功率 ≥ 99.5%
  - P95 鉴权延迟在目标阈值内（由环境基线定义）
  - 回滚演练期间：会话连续性失败率（`AUTH_TOKEN_COMPAT_WINDOW_EXPIRED` + 401 兼容失败）≤ 0.2%

### 9.3 Rollback Plan（可执行）

- 回滚触发器：
  - 连续 5 分钟握手失败率超过阈值。
  - refresh reuse 告警显著升高或误杀率异常。
  - 关键服务 5xx/WS 1008 激增。
- 回滚步骤：
  1. 关闭 `HOST_V2_ENABLED`，入口回切旧 Host。
  2. 停止 host-v2 新 token 签发。
  3. 启用旧 Host 的 **v2 token 短窗兼容验证**（MUST）：仅接受 `kid in {v2-active, v2-prev}` 且 `iss=host-v2` 且 `exp-now <= compatibility_window_ms`（默认 10 分钟）。
  4. 超出兼容窗或验签失败的会话返回 `AUTH_TOKEN_COMPAT_WINDOW_EXPIRED`，客户端走重新登录。
  5. 导出故障窗口审计日志与指标快照。
  6. 对受影响 session 执行强制失效或白名单恢复策略。
- 回滚后数据处理：
  - host-v2 的 session/revocation 运行态数据保留用于取证，不回写旧 Host。
  - 兼容窗口结束后，旧 Host 必须清理临时 `v2 kid` 白名单并恢复默认信任集合。

---

## 10. Error Semantics & Observability（强制）

### 10.1 错误码语义（草案）

| Code                             | HTTP/WS 映射 | 可恢复性     | 客户端动作                | 备注                            |
| -------------------------------- | ------------ | ------------ | ------------------------- | ------------------------------- |
| AUTH_INVALID_REQUEST             | 400 / 1008   | 可恢复       | 修正请求后重试            | 参数缺失/格式错误               |
| AUTH_CHAIN_INVALID               | 401 / 1008   | 条件可恢复   | 重新生成授权链            | 签名/信任根/用途不合法          |
| AUTH_NONCE_REPLAY                | 401 / 1008   | 不可直接恢复 | 重新发起挑战流程          | 重放检测命中                    |
| AUTH_CLOCK_SKEW_EXCEEDED         | 401 / 1008   | 条件可恢复   | 校准时钟后重试            | 请求时间偏移超窗                |
| AUTH_TOKEN_EXPIRED               | 401 / 1008   | 可恢复       | 用 refresh 换新 access    | access 过期                     |
| AUTH_REFRESH_INVALID             | 401 / 1008   | 条件可恢复   | 重新登录                  | refresh 过期/撤销/reuse         |
| AUTH_REFRESH_REUSE_DETECTED      | 401 / 1008   | 不可恢复     | 重新登录（family 已吊销） | consumed 后不同 request_id 再用 |
| AUTH_TOKEN_COMPAT_WINDOW_EXPIRED | 401 / 1008   | 可恢复       | 重新登录                  | 回滚兼容窗已结束                |
| AUTHZ_DENIED                     | 403 / 1008   | 不可恢复     | 申请权限/降级操作         | 主体无 scope                    |
| AUTH_RATE_LIMITED                | 429 / 1013   | 可恢复       | 指数退避重试              | 鉴权/刷新限流                   |
| AUTH_INTERNAL_ERROR              | 500 / 1011   | 可恢复       | 短暂重试                  | 服务内部异常                    |

补充语义（MUST）：

- `AUTH_REFRESH_INVALID` 用于过期/撤销/格式错误；
- `AUTH_REFRESH_REUSE_DETECTED` 专用于安全事件（reuse attack），用于区分误重试与恶意重放；
- `AUTH_KID_ROLLBACK_ACTIVE` 作为运维事件码记录在日志/告警，不对外暴露为稳定客户端错误码。

### 10.2 日志（Logs）

- 必打字段：`request_id`, `principal.subject`, `sid`, `jti`, `family_id`, `kid`, `auth_stage`, `error_code`, `latency_ms`。
- 采样：成功日志低采样，失败日志全量（脱敏）。
- 禁止：私钥、完整 token、原始敏感声明明文。

### 10.3 指标（Metrics）

- 连接鉴权：成功率、失败率（分 error_code）、P95/P99 延迟。
- token 生命周期：签发量、刷新成功率、reuse 命中数、撤销量。
- 资源：验签 CPU 时间、队列长度、限流丢弃数。

### 10.4 告警（Alerts）

- 握手失败率突增告警。
- refresh reuse 异常告警。
- kid 加载失败/未知 kid 告警。
- 鉴权延迟超阈值告警。

### 10.5 排障入口（Debug Playbook）

1. 先按 `request_id` 查 auth_stage 与 error_code。
2. 再查 `kid` 与 keyring 状态（是否轮换窗口错配）。
3. 再查 `sid/family_id` 是否被撤销或 reuse 命中。
4. 最后看限流与资源指标（是否 DoS/突发流量）。

---

## 11. Security & Privacy（强制）

- Threat model：见第 7 节。
- 权限边界：
  - 仅 Host-v2 可持有签发私钥。
  - 业务请求必须携带经过验证的 `Principal`。
  - `/external/*` 需显式 scope 才可调用。
- 输入校验与资源耗尽：
  - 限制 header/query/body 大小；握手/刷新频率限流；无效请求快速失败。
- Secrets / key handling：
  - 私钥不落盘日志；配置最小可见；支持轮换与紧急吊销。
- Data retention：
  - 审计日志按最短合规周期保留，默认不记录 PII；必要标识使用哈希或脱敏。

---

## 12. Testing Strategy（强制，可执行验收矩阵）

### 12.1 单元测试

- 授权链验证：合法链、断链、错误签名、错误用途、过期 timestamp、重复 nonce。
- JWT：access/refresh 签发、过期、轮换、reuse 检测、撤销命中。
- Refresh 并发：`active->consumed` CAS 原子迁移、相同 `request_id` 幂等返回、不同 `request_id` reuse 判定。
- keyring：active kid 切换、历史公钥兼容窗口。
- keyring 回退：candidate promote 前 shadow 观测、触发阈值后自动回退旧 active。

### 12.2 集成测试

- WS 连接：握手成功/失败码映射。
- HTTP `/request`：access 正常、过期后 refresh 再请求。
- `/external/*`：无 scope 拒绝、有 scope 放行。
- 多实例重放：实例 A 首次握手成功后，实例 B 使用相同 nonce 必须命中 `AUTH_NONCE_REPLAY`。
- 回滚兼容：切回旧 Host 后，兼容窗口内 v2 token 可通过；窗口外返回 `AUTH_TOKEN_COMPAT_WINDOW_EXPIRED`。

### 12.3 回归与安全测试

- 重放攻击用例（nonce 重用、refresh 重用）。
- 模糊测试（畸形 headers/query/token）。
- 压测（高并发握手 + 刷新风暴）验证限流与稳定性。

### 12.4 手工验收清单（UAT）

| 场景                        | 前置                  | 操作                             | 期望                                                |
| --------------------------- | --------------------- | -------------------------------- | --------------------------------------------------- |
| 合法授权链连接              | 已配置信任根          | 发起 WS 握手                     | 连接成功，记录 principal                            |
| 无效签名连接                | 同上                  | 篡改签名                         | 返回 AUTH_CHAIN_INVALID                             |
| Access 过期刷新             | 已登录                | 用过期 access 调用，再用 refresh | 首次失败、刷新成功、重试成功                        |
| Refresh 重放                | 已完成一次刷新        | 重复使用旧 refresh               | AUTH_REFRESH_INVALID + family 吊销                  |
| Refresh 并发同 request_id   | 同一 refresh 并发双发 | 携带同 request_id                | 返回同一 TokenPair，不吊销 family                   |
| Refresh 并发不同 request_id | 同一 refresh 并发双发 | 不同 request_id                  | 次请求返回 AUTH_REFRESH_REUSE_DETECTED，family 吊销 |
| kid 轮换窗口                | 双 kid 配置           | 切换 active_kid                  | 新 token 用新 kid，旧 token 在窗口内可验            |
| kid 轮换失败回退            | candidate 配置故障    | 触发失败阈值                     | 自动恢复旧 active_kid，不默认吊销 family            |
| 灰度回滚                    | host-v2 开启          | 触发回滚开关                     | 流量回切旧 Host，服务可用                           |
| 回滚会话连续性              | 已有 v2 会话          | 回滚至旧 Host                    | 兼容窗口内持续可用，超窗后可引导重登                |

---

## 13. Milestones（可验收最小增量，强制）

- **Milestone 1：鉴权骨架与隔离部署基线**

  - Scope: 建立 `apps/host-v2` 模块骨架、基础配置、错误码框架、可观测埋点骨架。
  - Acceptance: host-v2 可独立启动；不接生产流量；基础健康检查与日志指标可见。
  - Rollback impact: 零（不切流）。

- **Milestone 2：ED25519 授权链握手闭环**

  - Scope: 完成 handshake 校验管线（nonce/timestamp/chain/signature/trust-root）。
  - Acceptance: 验收矩阵中“合法连接/无效签名/重放”全部通过。
  - Rollback impact: 关闭 `HOST_V2_HANDSHAKE_ENFORCE` 可退回观测模式。

- **Milestone 3：JWT 双 Token（签发/轮换/撤销）**

  - Scope: 实现 access+refresh、family reuse 检测、撤销索引。
  - Acceptance: refresh 轮换与 reuse 防护测试通过；错误码语义稳定。
  - Rollback impact: 停止 v2 签发并回切旧 Host。

- **Milestone 4：灰度上线与回滚演练**
  - Scope: 分层灰度、监控告警、应急 runbook 实战演练。
  - Acceptance: 1%→10%→50%→100% 灰度通过；至少 1 次演练回滚成功。
  - Rollback impact: 入口开关回切，保留审计数据用于复盘。

---

## 14. Open Questions（仅阻塞级）

- [ ] 生产环境私钥托管最终选型（Env/File/KMS）与权限审批流程。
- [ ] refresh token 最大生命周期与合规要求（影响撤销索引 TTL 与存储成本）。
- [ ] 现网客户端对新增错误码与 WS close reason 的兼容窗口。

---

## 15. Blocking 闭环映射（审查项 -> 规范条款）

| Blocking                      | 设计条款                                          | 错误语义                                                         | 测试映射                                             |
| ----------------------------- | ------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------- |
| B1 refresh 并发原子/幂等      | 6.2.3.1（状态机/CAS/幂等窗/reuse 判定）           | 10.1 `AUTH_REFRESH_REUSE_DETECTED` + `AUTH_REFRESH_INVALID` 边界 | 12.1 Refresh 并发单测；12.4 并发同/异 request_id UAT |
| B2 nonce 跨实例一致性         | 6.2.2.1（共享 SETNX+TTL、键格式、时钟策略）       | 10.1 `AUTH_NONCE_REPLAY`/`AUTH_CLOCK_SKEW_EXCEEDED`              | 12.2 多实例重放集成；12.1 nonce 单测                 |
| B3 chain vs handshake 边界    | 6.2.2（职责分离、canonical 字段、固定顺序与理由） | 10.1 `AUTH_CHAIN_INVALID`/`AUTH_INVALID_REQUEST`                 | 12.1 授权链+签名单测；12.2 WS 失败码映射             |
| B4 回滚 token 兼容/会话连续性 | 9.3（短窗兼容验证 + 超窗重登）                    | 10.1 `AUTH_TOKEN_COMPAT_WINDOW_EXPIRED`                          | 12.2 回滚兼容集成；12.4 回滚会话连续性 UAT           |
| B5 密钥轮换失败回退           | 6.2.4（candidate 态、触发器、自动回退）           | 10.1 运维事件 `AUTH_KID_ROLLBACK_ACTIVE`                         | 12.1 keyring 回退单测；12.4 轮换失败回退 UAT         |

---

## 16. Implementation Notes（落地提示，仅设计）

- 预计改动文件/模块（后续实现阶段）：
  - `apps/host-v2/src/bootstrap/*`
  - `apps/host-v2/src/auth/handshake/*`
  - `apps/host-v2/src/auth/jwt/*`
  - `apps/host-v2/src/keyring/*`
  - `apps/host-v2/src/authz/*`
  - `apps/host-v2/src/session/*`
  - `apps/host-v2/src/transport/*`
- 建议实现顺序：先错误码与可观测骨架 → 再 handshake → 再 JWT lifecycle → 最后灰度开关与回滚剧本。
- 需要新增配置/文档：`host-v2` 部署配置模板、密钥轮换 runbook、灰度/回滚手册。

---

## 17. References（证据索引）

- Plan: `.legion/tasks/host-v2-auth-ed25519-jwt/plan.md`
- Research: `.legion/tasks/host-v2-auth-ed25519-jwt/docs/research.md`
- Relevant files:
  - `apps/host/src/host-manager.ts`（重点：300-346, 348-425, 470-495）
  - `.legion/tasks/host-v2-auth-ed25519-jwt/config.json`
  - `.legion/tasks/host-v2-auth-ed25519-jwt/context.md`
