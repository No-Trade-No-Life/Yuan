# host-v2-auth-ed25519-jwt

TITLE: 新 Host（隔离部署）重构设计：ED25519 授权链 + JWT 双 Token 滚动
SLUG: host-v2-auth-ed25519-jwt

## 问题定义

现有 `apps/host` 的认证与授权能力较弱（`HOST_TOKEN` 与可选 `MULTI_TENANCY=ED25519`，且逻辑耦合在单文件），难以满足高风险场景下的强鉴权、授权链校验、可审计签发与在线可回滚要求。需要设计一个**与老 Host 代码层面完全隔离**的新 Host，实现连接期 ED25519 授权链校验与 JWT 双 Token 滚动授权，并支持主机自身管理密钥直接签发 Token。

## 验收标准（设计阶段）

1. 形成 heavy RFC：覆盖威胁模型、身份模型、授权链模型、Token 生命周期、密钥轮换、错误语义、回滚策略。
2. 形成 research：明确旧 Host 现状、复用点、不可复用点、迁移与隔离边界。
3. RFC 经过对抗审查（review-rfc）并产出阻塞项/结论。
4. 输出 RFC-only Draft PR 描述，可直接用于“先审设计再实现”。

## 假设

- 仅单租户（不要求多租户隔离）。
- 连接入口至少包含 WebSocket 与 HTTP `/request` 路径（与现网兼容）。
- ED25519 将作为连接握手和授权链校验核心算法。
- JWT 采用 Access + Refresh 双 Token，并支持轮换与撤销策略。

## 约束

- 本阶段 `stage=design-only`：不改生产代码。
- 新 Host 与老 Host 必须代码隔离，优先新包（建议 `apps/host-v2`）而非原地重构。
- 设计文档保持中文（跟随仓库与当前工作语言约定）。

## 风险分级

- **High**。
- 理由：涉及认证/授权/密钥管理（安全关键）、连接协议与 Token 签发（外部合约影响）、线上回滚需求（切换风险）。

## 目标

在尽量少打扰人的前提下，将新 Host 的高风险设计先收敛到可执行、可审计、可回滚状态，为后续按 Milestones 分步实现提供唯一契约入口。

## 要点

- 连接期：支持 ED25519 授权链直接验权。
- 会话期：支持 JWT 双 Token 滚动授权（Access 短期 + Refresh 轮换）。
- 签发侧：主机管理密钥（ED25519）可直接签发 Token，并具备轮换策略。
- 架构侧：新旧 Host 代码隔离，发布可灰度，故障可快速回滚。

## 范围（设计范围）

- `.legion/tasks/host-v2-auth-ed25519-jwt/**`
- `apps/host/src/host-manager.ts`（仅调研，不改）
- 预期实现落点（后续阶段）：`apps/host-v2/**`（新目录）
- 预期共享能力（后续阶段，如需要）：`libraries/protocol/**`、`libraries/utils/**` 的最小扩展

## Design Index

- 研究文档：`.legion/tasks/host-v2-auth-ed25519-jwt/docs/research.md`
- 设计文档（heavy RFC）：`.legion/tasks/host-v2-auth-ed25519-jwt/docs/rfc.md`
- 对抗审查：`.legion/tasks/host-v2-auth-ed25519-jwt/docs/review-rfc.md`（当前结论：PASS）
- RFC-only 报告：`.legion/tasks/host-v2-auth-ed25519-jwt/docs/report-walkthrough.md`
- RFC-only PR Body：`.legion/tasks/host-v2-auth-ed25519-jwt/docs/pr-body.md`

## 阶段概览

1. 调研与问题收敛（research）
2. heavy RFC 设计（spec-rfc）
3. RFC 对抗审查与收敛（review-rfc）
4. RFC-only 报告与 Draft PR 文案（report-walkthrough）
5. 等待 Draft PR merge 作为设计批准，随后 `continue` 进入实现阶段

## 执行档位

- `rfcProfile=heavy`
- `stage=design-only`

---

_创建于: 2026-03-14 | 最后更新: 2026-03-14（RFC 复审 PASS）_
