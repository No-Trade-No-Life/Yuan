# RFC 审查报告

## 结论

PASS-WITH-NITS

这版 RFC 相比上一版已经明显收敛：

- 已把 audit 读取从通用 SQL 收回到专用只读服务；
- 已把 `SubmitSignal` 的真实安全边界明确放回服务端；
- 已把 live gate、分阶段 rollout、两层 rollback、milestones 与最小 observability 写成可执行约束；
- 之前的 blocker 现在基本已收敛到可实现、可验证、可回滚的范围内。

按奥卡姆剃刀看，这版设计总体克制，没有再把首版做成“大而全控制台”。当前剩余问题主要是边界说明还可继续压缩和钉死，但不足以继续阻塞实现。

## 阻塞问题

- [ ] 无。

## 非阻塞建议

- **Non-blocking：把 live gate 的“freshness / stale”再钉到现有 health 语义，避免实现时各自脑补。**

  - 质疑：RFC 已要求服务端校验 freshness，也定义了 `stale`，但前端 gate 仍主要写成“`status=normal` + 页面无 stale”。如果实现者不回收敛到现有 health 字段/锁定原因，容易在 UI 层再造一套 freshness 判定。
  - 最小化复杂度建议：直接写死“前端只消费 `GetRuntimeHealth` 的既有状态语义；凡非 `normal` 或出现 lock/stale 迹象一律禁写，不自行计算新阈值”。这样最省复杂度。

- **Non-blocking：`QueryRuntimeAuditLog` 的白名单虽已收敛，但 `note/evidence/detail` 仍建议补一句最小脱敏/截断规则。**

  - 质疑：现在边界已经比“通用 SQL”安全很多，但这三个字段天然容易膨胀或夹带敏感文本；如果完全留给实现阶段自由发挥，后续会出现环境差异。
  - 最小化复杂度建议：RFC 补一句“服务端返回前可按既有审计策略做脱敏/截断，UI 只展示脱敏后的摘要文本”，不要再把原始明细暴露策略留空。

- **Non-blocking：`servicePolicy` 的 live/paper 区分建议再写得更直白一点。**

  - 质疑：RFC 已把 live 权限控制交给宿主 `servicePolicy`，方向是对的，但读者第一眼未必能立刻看出这是“可按请求内容做细粒度授权”，还是“仅按 serviceName 粗粒度放开”。
  - 最小化复杂度建议：补一句“宿主授权可基于 `serviceName + request.runtime_id` 做细粒度决策，因此 paper 可写与 live 受限开放可独立控制”。不需要新增鉴权体系。

- **Non-blocking：Observability 已基本够用，但建议把告警责任压到 rollout 后段，而不是永久悬空。**
  - 质疑：当前已有日志、指标、排障入口，足够支撑实现与灰度；但对 high-risk control-plane，live 受限开放后若没有最小告警触发条件，值班约束仍偏软。
  - 最小化复杂度建议：在 Milestone 3 前补一句“至少定义 submit_rejected / audit_query_failed 的人工巡检或告警接入点”；先定责任点，不必首版就做复杂自动化。

## 修复指导

建议只做最小补丁，不要再重写 RFC：

1. 把前端 freshness 判定完全锚定到现有 `GetRuntimeHealth` 语义；
2. 给 audit 三个自由文本字段补一句脱敏/截断原则；
3. 给 `servicePolicy` 的 live/paper 细粒度授权补一行说明；
4. 在 Milestone 3 前补一个最小告警/巡检责任点。

## Heavy Profile 额外检查

| 检查项                                   | 结果 | 依据                                                                                     |
| ---------------------------------------- | ---- | ---------------------------------------------------------------------------------------- |
| Executive Summary（<=20 行）             | PASS | 第 3-15 行已在 1 分钟内说明核心边界、门禁、回滚与阶段发布。                              |
| Alternatives >= 2，且写清放弃原因        | PASS | 第 10 节给出 A/B/C 三个方案，并明确放弃原因。                                            |
| Migration / Rollout / Rollback 可执行    | PASS | 第 11 节已收敛到三阶段 rollout + 两层 rollback，执行顺序清晰。                           |
| Observability（日志/指标/告警/排障入口） | PASS | 第 12 节已有最小日志、指标、关键标签与排障入口；告警自动化虽未强制，但不影响实现前收敛。 |
| Milestones（最小增量验收）               | PASS | 第 14 节拆成只读 → paper 写 → live 受限开放，避免一步到位。                              |
| 易膨胀细节是否外移                       | PASS | 主文仍聚焦边界与门禁，没有退化成长篇实现手册。                                           |

## 复审结论

- 之前 blocker **已基本收敛**。
- 当前 **不存在实现前 blocker**。
- 建议按本报告的 4 个最小补丁继续压实说明，但无需再因设计审查阻塞实现。
