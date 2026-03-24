## What

- 本 PR 交付 `yuanctl` Phase 1 最小骨架：将 CLI 切换为全新 `namespace/subcommand` 命令树，并落地 static registry、统一 runtime/output/error/safety。
- 首批接入 `deploy` 与 `config` 两个 namespace，覆盖 deployment 基础操作与本地 CLI 配置管理。

## Why

- 现有 `tools/yuanctl` 仍是 deployment 专用、硬编码扩展模式，难以承载统一 CLI 平台。
- 本次先用最小骨架验证“全新 CLI + 静态注册 + 安全门禁 + 标准输出/错误”这条主路径，为后续 phase 扩展打底。

## How

- 根入口移除旧 verbs 注册，统一经静态注册表分发到 `deploy/*` 与 `config/*`。
- 引入统一 runtime context、输出层、错误码/退出码、capability gate，并补 CLI 命令树与 destructive confirmation 相关测试。
- 本次**已实现** `deploy` / `config`、static registry、runtime/output/error/safety；`terminal` / `host` / `node` / `service` 等后续命令面留待后续阶段。

## Testing

- 设计审查 PASS：`.legion/tasks/yuanctl-cli/docs/review-rfc.md`
- 代码审查 PASS：`.legion/tasks/yuanctl-cli/docs/review-code.md`
- 安全审查 PASS：`.legion/tasks/yuanctl-cli/docs/review-security.md`、`.legion/tasks/yuanctl-cli/docs/review-security-recheck.md`
- 工具链测试阻塞：见 `.legion/tasks/yuanctl-cli/docs/test-report.md`
  - `rush test --to @yuants/tool-yuanctl` 当前仓库不可用
  - `heft`/`tsc` 被 `tools/yuanctl` 历史脚本与 TypeScript 问题阻塞，未能形成完整绿灯

## Risk / Rollback

- 风险：后续扩命令面时需持续守住单一路径分发、最小输出、错误脱敏与 capability gate，不要回退到旧 CLI 兼容/双轨模式。
- 回滚：如需止损，可整体回滚 `tools/yuanctl/**` 本轮 Phase 1 骨架改动；如仅需控风险，可先冻结后续 namespace 扩展，待工具链恢复后再推进。

## Links

- Plan：`.legion/tasks/yuanctl-cli/plan.md`
- RFC：`.legion/tasks/yuanctl-cli/docs/rfc.md`
- RFC Review：`.legion/tasks/yuanctl-cli/docs/review-rfc.md`
- Code Review：`.legion/tasks/yuanctl-cli/docs/review-code.md`
- Security Review：`.legion/tasks/yuanctl-cli/docs/review-security.md`
- Security Recheck：`.legion/tasks/yuanctl-cli/docs/review-security-recheck.md`
- Test Report：`.legion/tasks/yuanctl-cli/docs/test-report.md`
- Walkthrough：`.legion/tasks/yuanctl-cli/docs/report-walkthrough.md`
