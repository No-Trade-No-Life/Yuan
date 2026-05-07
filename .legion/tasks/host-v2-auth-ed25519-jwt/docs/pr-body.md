# RFC Review（Design-only / Docs-only）

> 本 PR **仅包含设计产物**（`research.md` / `rfc.md` / `review-rfc.md` / walkthrough / pr-body），**无生产代码变更**。  
> **Merge 视为设计批准**；合并后请在评论区输入 `continue` 进入实现阶段。

---

## What

- 产出并收敛 host-v2 设计文档：连接期 ED25519 授权链 + 会话期 JWT 双 Token。
- 明确 high-risk 场景下的威胁模型、错误语义、观测面与回滚策略。
- 给出实现阶段可验收的 Milestones 与推荐交付顺序。

## Why

- 当前 Host 认证/授权语义与耦合结构不足以支持高风险场景演进。
- 先做 docs-only 设计审批，可在不触发生产改动的前提下提前收敛边界与风险。
- 以设计先行降低后续实现返工与上线回滚不确定性。

## How

- 基于 `plan.md` 问题定义与 `research.md` 现状摸底形成 RFC Heavy 方案。
- 在 `review-rfc.md` 中完成对抗审查并闭环 B1-B5 阻塞项。
- 输出 RFC-only walkthrough，明确实现阶段推荐顺序：**M1 → M2 → M3 → M4**。

## Review Focus（Checklist）

- [ ] 问题定义与设计范围是否准确，且与 plan 对齐？
- [ ] 方案是否同时满足可实现、可验证、可回滚？
- [ ] ED25519 授权链与 JWT 双 Token 的职责边界是否清晰？
- [ ] Migration / Rollout / Rollback 是否具备可执行性？
- [ ] Milestones 是否足够小、顺序是否合理（M1→M2→M3→M4）？
- [ ] Non-goals 是否明确，能防止实现阶段 scope 膨胀？

## Next

- 该 PR 合并即视为设计批准（Design Gate 通过）。
- 合并后评论 `continue`，按 Milestones 进入实现阶段逐步交付。

## Links

- plan: `/.legion/tasks/host-v2-auth-ed25519-jwt/plan.md`
- research: `/.legion/tasks/host-v2-auth-ed25519-jwt/docs/research.md`
- rfc: `/.legion/tasks/host-v2-auth-ed25519-jwt/docs/rfc.md`
- review-rfc: `/.legion/tasks/host-v2-auth-ed25519-jwt/docs/review-rfc.md`
- walkthrough: `/.legion/tasks/host-v2-auth-ed25519-jwt/docs/report-walkthrough.md`
