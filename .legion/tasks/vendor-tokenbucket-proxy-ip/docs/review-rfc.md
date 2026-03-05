# RFC 对抗审查报告: Proxy IP TokenBucket v2（最终只读复审）

目标文档: `/Users/c1/Work/Yuan/.legion/tasks/vendor-tokenbucket-proxy-ip/docs/rfc.md`
审查日期: 2026-02-07
原则: 奥卡姆剃刀（逐条质疑必要性/假设/边界/复杂度，优先最小复杂度收敛）

## 结论

`PASS`

当前文本已满足进入设计门禁的三个必要条件：

- 可实现：输入边界、状态机、错误阶段、模式切换都已收敛为可编码约束。
- 可验证：`R1-R15` 与 `T-R1-T-R15` 一一映射，负例断言覆盖关键失败路径。
- 可回滚：模式命名、默认/灰度/回滚值与观测窗口已明确定义，可执行回切。

## 关键收敛检查（只读结论）

1. 设计必要性

- `acquireProxyBucket` 作为统一入口保留，避免 vendor 侧重复实现与语义漂移，复杂度收益比成立。

2. 设计假设与边界

- options 来源固定为 `getBucketOptions(baseKey)`，消除了 helper 隐式默认配置的歧义。
- 错误边界通过 `pool|acquire|route|request` 归属表与 `R14/R15` 封闭，无跨阶段吞并。

3. 复杂度控制

- 三模式并存但职责清晰：`helper_acquire_proxy_bucket`（目标）、`rr_multi_try`（默认）、`legacy_rr_single_try`（回滚）。
- 未引入中心化状态或新持久化依赖，保持实现最小侵入。

## 可选优化（非阻塞）

1. 为 `T-R10` 增加并发判定锚点

- 建议在测试描述中明确“以候选构造时 `read()` 快照分组”为断言基准，减少高并发抖动。

2. 明确模式开关配置落点

- 建议在 Rollout 补一行“配置键路径/环境变量名”，降低运维误配概率。

3. 补充最小观测样例

- 建议在 Observability 增加 1 条示例日志字段（`stage,error_code,base_key,ip`），便于跨团队对齐。
