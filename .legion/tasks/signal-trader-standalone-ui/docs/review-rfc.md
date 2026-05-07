# signal-trader-standalone-ui RFC 审查

## 结论

- Verdict: `PASS-WITH-NITS`
- 审查日期: 2026-03-22
- 审查方式: 对抗性 RFC review（两轮）

## 已关闭的 blocker

1. **不再回接 `ui/web`**
   - RFC 已在非目标、工程形态、向后兼容章节明确：新项目固定落在 `ui/signal-trader-web`，不再修改旧 `SignalTraderConsole`。
2. **`vite dev` 与 `build/preview` 冲突**
   - RFC 已明确拆成两条链路：
     - `vite dev` 负责开发联调
     - `serve-with-proxy` 负责 `build + preview` 与 Playwright
3. **`dummy-live/live` 风险识别模糊**
   - RFC 已把 `SIGNAL_TRADER_ENV_PROFILE + runtime config + capability summary` 写成硬规则，并固定“缺失/冲突 => 按 `live` + 禁写”。
4. **写入 gate 未纳入 capability / 本地写开关**
   - RFC 已新增 `SIGNAL_TRADER_ENABLE_MUTATION` 与 `capability_ok`，形成 fail-close 写入前置条件。

## 保留的 nits

1. Playwright / stack wrapper / `serve-with-proxy` 章节已经可执行，但仍偏实施提纲，真正落地时要把命令名、端口、环境变量和清理动作写进实现与测试报告。
2. `dummy-live` 首版自动化建议先覆盖 fail-close 路径，不必为了“自动化真实提交成功”扩大 scope。

## 结论摘要

- RFC 已达到可实现状态，可以进入生产代码阶段。
- 后续实现时优先保证三件事：
  - 代理层真的只在 Node 侧持有 `HOST_TOKEN`
  - 风险层级推导缺省即禁写
  - paper Playwright happy path 先稳定，再补 dummy-live fail-close 冒烟
