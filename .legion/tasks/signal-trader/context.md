# signal-trader - 上下文

## 会话进展 (2026-03-17)

### ✅ 已完成

- 已批准并创建 `signal-trader` Legion 任务
- 已把根目录 `signal-trader-rfc-v1-事件溯源重排版.md` 登记为 RFC 真源
- 已补全 `plan.md`：问题定义/验收/假设/约束/风险/Scope/Design Index
- 已完成 RFC 审查并产出 `docs/review-rfc.md`
- 已根据 review-rfc 收敛根 RFC：冻结新增风险暴露时的 `entry_price/stop_loss_price` 规则、删除投影型 append 事件、缩小对账与 frozen API 边界
- RFC 复审结论已转为 PASS，可开始实现
- 已完成 `libraries/signal-trader` 新实现的安全/威胁建模审查，并产出 `docs/review-security.md`。
- 已基于最新代码重新完成 `libraries/signal-trader` 安全复审，并覆盖更新 `docs/review-security.md`；先前 4 条 blocking 均已关闭。
- 已实现新的 `@yuants/signal-trader` Rush library，并接入 `rush.json` 与 lockfile
- 已落地事件溯源核心模块：commands/events/snapshot、compute-target-position、reducer、dispatch/append/replay/query、execution port、mock execution port
- 已根据 review 反馈修复 audit_only fail-close、execution report product mismatch、metadata 脱敏、订阅停用补偿 effect、多活跃订单补偿等问题
- 已完成最新 `node common/scripts/install-run-rush.js build -t @yuants/signal-trader` 验证，`review-code.md` PASS，`review-security.md` PASS
- 已生成 walkthrough 与可直接用于 PR 的 `pr-body.md`

### 🟡 进行中

(暂无)

### ⚠️ 阻塞/待定

(暂无)

---

## 关键文件

(暂无)

---

## 关键决策

| 决策                                                                                                                                                              | 原因                                                                                            | 替代方案                                                                                      | 日期       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------- |
| 将根目录 `signal-trader-rfc-v1-事件溯源重排版.md` 直接作为本任务 RFC 真源，不复制为新的 task-local RFC 文件。                                                     | 用户明确要求直接把该文档作为 RFC；避免双份文档漂移，同时保留 plan 摘要级契约。                  | 复制一份到 `<taskRoot>/docs/rfc.md`；缺点是后续容易与根文档失同步。                           | 2026-03-17 |
| V1 首版仅实现四条命令主链（upsert_subscription / submit_signal / apply_execution_report / capture_authorized_account_snapshot），不包含 `update_risk_policy`。    | RFC Heavy 复审指出首版范围过宽；先收敛最小事件闭环更利于正确性、回放一致性与可测试性。          | 一并实现 `update_risk_policy`、复杂资金账户语义与增强版内冲抵；缺点是显著扩大实现与测试矩阵。 | 2026-03-17 |
| 停用订阅时，planned effects 按 product 维度聚合活跃订单：`desired_delta=0` 取消全部，非零时仅保留一张 keeper 订单做 `modify_order`，其余订单统一 `cancel_order`。 | 避免多活跃订单场景下对每张单重复套用同一个目标 delta，保证外部挂单总量与最新 product 目标一致。 | 对每张活跃订单都直接套用相同 `desired_delta`；缺点是会重复计算总挂单量并破坏执行语义。        | 2026-03-17 |

---

## 快速交接

**下次继续从这里开始：**

1. 将 `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader/docs/pr-body.md` 作为 PR 描述发起 Review/合并
2. 如需继续增强，可补非零 `desired_delta` 的多订单补偿测试，或将 mock port 迁到显式 testing/unsafe 导出路径

**注意事项：**

- 最新验证已通过：`node common/scripts/install-run-rush.js build -t @yuants/signal-trader`
- 交付文档位于 `/Users/c1/Work/signal-trader/.legion/tasks/signal-trader/docs/`
- 根 RFC 已收敛并通过 review-rfc，可作为后续宿主接入的设计真源

---

_最后更新: 2026-03-17 22:39 by Claude_
