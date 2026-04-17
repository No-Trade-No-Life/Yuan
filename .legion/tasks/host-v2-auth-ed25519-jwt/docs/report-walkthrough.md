# RFC-only Walkthrough：host-v2-auth-ed25519-jwt

> 类型：**docs-only / design approval PR**（仅设计产物，无生产代码变更）  
> 模式：`rfc-only`  
> 任务：`host-v2-auth-ed25519-jwt`

---

## 1) 问题定义（引用 plan）

根据 `plan.md`，当前 `apps/host` 的认证/授权能力难以覆盖高风险场景：

- 认证逻辑耦合在单文件，扩展与回滚成本高；
- 连接期缺少强校验语义，会话期缺少标准化 token 生命周期；
- 需要在“新旧代码隔离”前提下，先完成可审计、可灰度、可回滚的设计收敛。

对应设计目标是：新建隔离的 Host-v2 方案，建立 **ED25519 授权链（连接期）+ JWT 双 Token 滚动（会话期）+ 密钥轮换与回滚机制** 的完整设计契约。

参考：

- `/.legion/tasks/host-v2-auth-ed25519-jwt/plan.md`

## 2) 现状摸底摘要（引用 research）

`research.md` 的核心结论：

- 现有认证入口与转发逻辑耦合，难以承载复杂鉴权策略；
- 现有 ED25519 分支缺少 challenge/nonce/timestamp 等抗重放要素；
- 当前会话阶段缺乏 access/refresh 的轮换、撤销、重放判定闭环；
- 错误语义与可观测粒度不足，不利于灰度与回滚时快速定位问题。

同时，研究明确了边界：

- 可复用：入口形态（WS、`/request`、`/external/*`）与部分生命周期模式；
- 不可复用：现有认证主流程与弱验签语义，需要在 host-v2 里重建。

参考：

- `/.legion/tasks/host-v2-auth-ed25519-jwt/docs/research.md`

## 3) 方案摘要（RFC Executive Summary）

`rfc.md` 提出的主决策：

- 新建 `apps/host-v2/**`，与旧 Host 代码/部署隔离；
- 建立连接期 ED25519 授权链校验（含 canonical、nonce、时效与信任根校验）；
- 建立会话期 JWT Access/Refresh 双 Token 生命周期（签发、轮换、撤销、reuse 检测）；
- 采用双栈灰度 + 可执行回滚，默认 fail-closed。

审查结论（`review-rfc.md`）：B1-B5 阻塞项已闭环，当前可作为“设计批准”输入进入实现阶段。

参考：

- `/.legion/tasks/host-v2-auth-ed25519-jwt/docs/rfc.md`
- `/.legion/tasks/host-v2-auth-ed25519-jwt/docs/review-rfc.md`

## 4) Alternatives & Decision

- A：在 `apps/host` 原地增强 —— 回滚与耦合风险高，不满足隔离约束。
- B：仅做 JWT，不做 ED25519 授权链 —— 无法满足连接期强身份证明目标。
- C：接外部 IAM 托管 —— 当前阶段依赖与范围过大。
- **Decision**：采用“host-v2 隔离 + ED25519 授权链 + JWT 双 Token + 双栈灰度回滚”的组合方案。

## 5) 风险、迁移/回滚、观测要点（引用 RFC 章节）

### 风险要点（RFC §7）

- 握手重放、refresh 重放、kid 错配、验签高压导致 DoS；
- 风险控制依赖：固定验证顺序、共享 nonce 去重、refresh 原子语义、密钥轮换回退触发器。

### 迁移/回滚要点（RFC §9）

- 迁移：双栈并行，从观测到小流量再逐步放量；
- 回滚：入口回切旧 Host，停止 v2 签发，启用短窗 token 兼容校验；
- 超出兼容窗后通过明确错误语义引导重新登录。

### 观测要点（RFC §10）

- 统一错误码语义（含 `AUTH_REFRESH_REUSE_DETECTED`、`AUTH_TOKEN_COMPAT_WINDOW_EXPIRED`）；
- 日志字段、指标与告警路径已定义，支持灰度与回滚期间快速定位。

## 6) Milestones（实现阶段推荐交付顺序）

> 推荐顺序：**M1 → M2 → M3 → M4**（先搭骨架，再闭环鉴权，再上线灰度）

1. **M1 鉴权骨架与隔离部署基线**  
   建立 host-v2 基础模块、错误语义框架、日志指标骨架；不切生产流量。
2. **M2 ED25519 授权链握手闭环**  
   完成 handshake 验证管线与重放防护，打通“连接期”验收。
3. **M3 JWT 双 Token 生命周期**  
   完成签发/轮换/撤销/reuse 检测，形成“会话期”闭环。
4. **M4 灰度上线与回滚演练**  
   分层放量、告警联动与回滚演练，验证可运营性。

## 7) 下一步

- 本 PR 为 **design approval（设计审批）**：仅评审设计，不讨论实现细节落地。
- **Merge = 设计批准**。
- 合并后在评论区输入 `continue`，进入实现阶段，并按上述 Milestones 顺序逐步交付与验收。
