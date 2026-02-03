# vendor-http-services-rollout - 任务清单

## 快速恢复

**当前阶段**: (unknown)
**当前任务**: (none)
**进度**: 4/4 任务完成

---

## 阶段 1: 调研 ✅ COMPLETE

- [x] 盘点 vendor-binance 的 fetch 使用点、现有 http client/签名/重试/限流封装，并识别是否已有可替换的统一入口。 | 验收: 形成使用点清单与替换策略草图（按模块归类），并记录潜在风险与兼容点。

---

## 阶段 2: 设计 ✅ COMPLETE

- [x] 输出 RFC 与 specs（dev/test/bench/obs），明确 http-services 的接入方式、接口适配、错误语义与观测指标。 | 验收: docs/rfc.md 与 spec-\*.md 完整可评审，包含核心流程、接口定义、文件变更明细。

---

## 阶段 3: 实现（仅 binance） ✅ COMPLETE

- [x] 在 vendor-binance 中用 http-services 替换所有 fetch 调用，并完成最小验证。 | 验收: binance 侧 fetch 替换完成且通过最小验证；其余 vendor 暂不改动，等待用户确认后进入下一阶段。

---

## 阶段 4: 推广（其他 vendor） 🟡 IN PROGRESS

- [x] 在用户确认后，将相同替换方案扩展到 okx/gate/hyperliquid/aster/bitget/huobi。 | 验收: 其他 vendor 替换完成并通过与 binance 相同的验证步骤。

---

## 发现的新任务

- [x] 设计审批通过（用户确认）。 | 来源: 设计审批门禁流程
- [x] benchmark 实现：本阶段无需新增，已在 spec-bench 记录并补充可复现/门槛说明。 | 来源: spec-bench 审核
- [x] 请求 orchestrator 决策：是否允许更新 WORK_ROOT/docs/spec-test.md（超出 SUBTREE_ROOT 边界）以记录“无需新增测试、原因：仅日志脱敏”。 | 来源: 用户指令与边界约束冲突
- [x] 修复测试环境并重跑最小验证（npx tsc）。 | 来源: 阶段 C 测试失败
- [x] 修复 @yuants/vendor-binance 找不到 @yuants/http-services 的构建错误（TS2307）并重跑 rush build | 来源: 阶段 C 测试失败
- [x] Walkthrough 报告生成完成（覆盖 okx/gate/hyperliquid/aster/bitget/huobi 推广、日志脱敏修复、review/test 结果） | 来源: 阶段 D 需求
- [x] 设计变更审批通过（用户确认）。 | 来源: 新增 USE_HTTP_PROXY 条件覆盖逻辑
- [x] 更新 spec-test 说明补充 USE_HTTP_PROXY 手工验证要点（不新增测试）。 | 来源: 用户指令
- [x] 设计变更审批通过（用户确认：推广到所有 vendor）。 | 来源: 用户指令
- [x] RFC 生成完成（http-services 递归栈溢出修复）。 | 来源: 用户指令
- [ ] PR 创建完成 | 来源: 发布流程
- [x] 排查 http-services 引入后导致 RangeError: Maximum call stack size exceeded 的递归问题，并输出修复设计（RFC + review）。 | 来源: 用户反馈：vendor-okx/gate/huobi/bitget 运行时栈溢出
- [x] 补充 publicIP 用途/是否可删除，并调整 Goals/R1-R7/Testability 以可验证 | 来源: RFC 对抗审查 blocking
- [x] RFC 审查完成（最终对抗审查，结论 PASS） | 来源: 用户指令
- [x] 实现 RFC 修复：缓存 \_\_yuantsNativeFetch/标记 proxy fetch，terminal public IP 跳过逻辑 | 来源: 用户批准设计，进入阶段 A
- [x] 验证与审查：运行测试，review-code，review-security | 来源: 流程阶段 B
- [x] 生成报告：report-walkthrough + PR body 建议 | 来源: 流程阶段 C

---

_最后更新: 2026-02-03_
