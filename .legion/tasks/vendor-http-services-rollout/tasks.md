# vendor-http-services-rollout - 任务清单

## 快速恢复

**当前阶段**: 阶段 4 - 推广（其他 vendor）
**当前任务**: (none)
**进度**: 3/4 任务完成

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

- [ ] 在用户确认后，将相同替换方案扩展到 okx/gate/hyperliquid/aster/bitget/huobi。 | 验收: 其他 vendor 替换完成并通过与 binance 相同的验证步骤。

---

## 发现的新任务

- [x] 设计审批通过（用户确认）。 | 来源: 设计审批门禁流程
- [x] benchmark 实现：本阶段无需新增，已在 spec-bench 记录。 | 来源: spec-bench 审核
- [x] 请求 orchestrator 决策：是否允许更新 WORK_ROOT/docs/spec-test.md（超出 SUBTREE_ROOT 边界）以记录“无需新增测试、原因：仅日志脱敏”。 | 来源: 用户指令与边界约束冲突
- [x] 修复测试环境并重跑最小验证（npx tsc）。 | 来源: 阶段 C 测试失败
- [x] 修复 @yuants/vendor-binance 找不到 @yuants/http-services 的构建错误（TS2307）并重跑 rush build | 来源: 阶段 C 测试失败
- [x] Walkthrough 报告生成完成（含 PR body 更新） | 来源: 阶段 D 需求
- [x] 设计变更审批通过（用户确认）。 | 来源: 新增 USE_HTTP_PROXY 条件覆盖逻辑
- [x] 更新 spec-test 说明补充 USE_HTTP_PROXY 手工验证要点（不新增测试）。 | 来源: 用户指令

---

_最后更新: 2026-01-30 11:05_
