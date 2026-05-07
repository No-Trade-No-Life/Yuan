# Research Notes（现状摸底）：新 Host（ED25519 授权链 + JWT 双 Token）

> 目标：在不修改生产代码前提下，基于现有 `apps/host/src/host-manager.ts` 形成可执行的重构边界与风险清单。  
> 约束：`stage=design-only`，本文件仅研究与设计输入。

---

## 1. Problem Restatement（基于 plan.md / repo 现状）

- 一句话复述：现有 Host 认证能力以静态 token 与极简 ED25519 验签为主，未形成“连接鉴权 + 会话授权 + 可撤销 + 可观测”的完整安全闭环，且认证逻辑与连接转发逻辑耦合在单文件，不利于高风险场景演进与回滚。
- 影响范围：WebSocket 连接入口、HTTP `/request` 与 `/external/*` 路由、Host 实例生命周期、终端连接替换与心跳清理链路。
- 证据：`plan.md` 第 8-15 行；`apps/host/src/host-manager.ts` 第 300-346、348-425、470-476 行。

## 2. Relevant Code / Entry Points（入口与关键模块）

- `apps/host/src/host-manager.ts` — Host 主入口（创建 HTTP/HTTPS + WS server）
  - 证据：`createNodeJSHostManager`（第 59 行）与 server 创建（第 428-438 行）。
- `resolveHost`（同文件）— 当前认证/租户解析入口
  - 行为：支持 `Authorization: Bearer` 透传为 query `host_token`，支持 `HOST_TOKEN` 静态校验，支持 `MULTI_TENANCY=ED25519` 时验签。
  - 缺口：即使走 ED25519 分支，`host_id` 最终被强制设置为 `main`（第 336 行），导致多租户分流失效；且验签消息体固定为空字符串（第 333 行），无挑战值与时效约束。
  - 证据：第 307-337 行。
- `handleRequest`（同文件）— HTTP 请求入口
  - 行为：统一先调用 `resolveHost`；401 直接返回；`/request` 走 NDJSON；`/external/*` 转发给 host terminal service。
  - 风险：`/external/*` 在鉴权成功后直接“路径即方法名”转发（第 410 行），授权粒度依赖下游服务。
  - 证据：第 348-421 行。
- `wss.on('connection')`（同文件）— WS 连接入口
  - 行为：连接时只做一次 `resolveHost`，失败即 close code 1008。
  - 缺口：无会话续期、无 token 撤销检查、无重放防护信息。
  - 证据：第 470-495 行。
- `addTerminalConnection`（同文件）— 终端连接管理
  - 行为：同 terminal_id 后连覆盖先连（第 223-228 行），消息头 JSON 解析后按 `target_terminal_id` 直接转发。
  - 风险：缺少“连接主体身份”和“terminal_id 所有权”绑定校验。
  - 证据：第 215-274 行。

## 3. Existing Conventions（项目规约/习惯）

- 规约 1：本任务走 LegionMind 设计门禁，先文档后实现。
  - 证据：`plan.md` 第 26-29、61-67 行。
- 规约 2：高风险任务需 heavy RFC，明确 migration/rollout/rollback 与 observability。
  - 证据：`config.json` 第 3-5 行；`TEMPLATE_RFC_HEAVY.md` 第 82-136 行。
- 规约 3：文档中文、生产代码本阶段不可改。
  - 证据：`config.json` 第 13-17 行；`plan.md` 第 26-29 行。

## 4. Historical Decisions（相关历史决策）

- 决策：新 Host 与老 Host 代码层必须隔离（建议 `apps/host-v2/**`）。
  - 原因：便于灰度和故障回滚，避免在 `apps/host` 原地重构引入不可控耦合。
  - 证据：`plan.md` 第 27、44、50 行；`context.md` 决策表第 36 行。
- 决策：当前阶段仅产出设计文档，禁止生产变更。
  - 原因：该需求涉及密钥管理与鉴权协议，需先做可审计设计收敛。
  - 证据：`plan.md` 第 26、64-67 行。

## 5. Constraints & Non-goals（从 repo/任务推断）

- 约束：
  - 不做多租户（host 逻辑按单租户设计）。
  - 新 Host 需直接包含 Authentication + Authorization（连接期与会话期一体化策略）。
  - 连接时必须支持 ED25519 授权链校验。
  - 会话期必须支持 JWT Access+Refresh 双 Token 滚动与撤销。
  - Host 自持管理权限 ED25519 密钥对并可签发 token。
  - 新旧 Host 代码层隔离，支持快速回滚。
- 非目标：
  - 本阶段不改 `apps/host` 生产逻辑。
  - 本阶段不引入多租户模型。
  - 本阶段不要求统一改造所有下游 terminal/service 的授权模型，只定义 host-v2 对外契约与兼容策略。

## 6. 可复用/不可复用边界

### 6.1 可复用（建议）

- 网络入口骨架：HTTP `/request`（NDJSON）与 `/external/*` 路由形态可延续，降低客户端切换成本。
  - 证据：`host-manager.ts` 第 360-421 行。
- Host 内部事件模型：`HostEvent` + `seq_id` 连续性语义可复用为“状态同步面”。
  - 证据：第 116-143、145-169 行。
- 终端连接生命周期模式（连接、替换、断开清理）可复用思想，但需加身份绑定。
  - 证据：第 215-274 行。

### 6.2 不可复用（必须重做）

- 认证入口 `resolveHost` 与业务转发强耦合，不适合演进复杂鉴权。
  - 证据：第 300-346 行。
- 当前 ED25519 验签语义不足：无 challenge/nonce/timestamp/token 绑定，且 `host_id='main'` 覆盖逻辑破坏身份分流。
  - 证据：第 328-337 行。
- 会话层无 token 生命周期管理：无 access 过期策略、无 refresh 轮换、无撤销索引。
  - 证据：WS/HTTP 仅依赖一次性 resolveHost（第 352、471 行）。
- 错误码体系缺失：HTTP 主要 401/500，WS 仅 1008，无法支撑审计与客户端自愈。
  - 证据：第 355-357、423-425、474 行。

## 7. Risks & Pitfalls（安全与回滚关键风险）

- 风险 1：签名重放攻击
  - 触发：复用历史 `public_key/signature` 查询参数连接。
  - 影响：伪造授权连接。
  - 缓解：引入 challenge + nonce + timestamp + 短 TTL + 单次 nonce 存储。
- 风险 2：Refresh Token 被盗后长期驻留
  - 触发：刷新 token 未轮换或未检测 token family reuse。
  - 影响：攻击者维持长期会话。
  - 缓解：refresh 每次轮换 + jti 追踪 + family 级吊销。
- 风险 3：管理密钥泄露
  - 触发：密钥明文落盘、日志泄漏、配置分发错误。
  - 影响：可伪造全部 token。
  - 缓解：分离 key id 与私钥、最小权限加载、轮换双窗口、紧急吊销剧本。
- 风险 4：新旧 Host 混部切换失败
  - 触发：灰度中 token 受众（aud）或发行者（iss）配置不一致。
  - 影响：连接大量 401/1008，业务中断。
  - 缓解：双栈并行 + 明确流量切换开关 + 一键回切旧 Host。
- 风险 5：资源耗尽（DoS）
  - 触发：高频握手验签、refresh 风暴、`/external/*` 大包体请求。
  - 影响：CPU 飙升、连接排队。
  - 缓解：握手限流、payload size 限制、鉴权失败指数退避。

## 8. Unknowns（仍待确认）

- [ ] JWT 实现细节是否复用仓库既有库（待实现阶段搜 `@yuants/*` 内可用签发/校验能力）。
- [ ] 管理私钥的最终托管形态（环境变量、文件挂载、KMS）需由运维基线确认。
- [ ] 现网客户端对 WS close reason / HTTP 错误码的兼容窗口需确认，避免灰度期误判。

## 9. References（证据索引）

- 任务契约：`.legion/tasks/host-v2-auth-ed25519-jwt/plan.md`
- 任务配置：`.legion/tasks/host-v2-auth-ed25519-jwt/config.json`
- 现状代码：`apps/host/src/host-manager.ts`
- heavy 模板：`/Users/zccz14/.opencode/skills/legionmind/references/TEMPLATE_RFC_HEAVY.md`
