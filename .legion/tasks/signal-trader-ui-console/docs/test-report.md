# 测试报告

## 执行命令

- `npm run build`（工作目录：`/Users/c1/Work/signal-trader/apps/signal-trader`）
- `npm run build`（工作目录：`/Users/c1/Work/signal-trader/ui/web`）
- `git status --short -- ui/web apps/signal-trader`（工作目录：`/Users/c1/Work/signal-trader`，仅用于辅助归因）

## 结果

FAIL

## 摘要

- `apps/signal-trader` 的 `npm run build` 通过；Heft build 完成，Jest 1 个 suite / 26 个测试全部通过。
- `ui/web` 的 `npm run build` 失败，但失败点集中在仓库级 TypeScript 模块解析：大量既有模块无法解析 `@yuants/kernel`、`@yuants/agent`、`@yuants/deploy`、`@yuants/data-series`、`@yuants/secret`、`@yuants/transfer` 等 workspace 依赖。
- 本次 signal-trader UI 新增模块 `ui/web/src/modules/SignalTrader/SignalTraderConsole.tsx` 未出现在本轮 TypeScript 报错列表中；从当前日志看，`ui/web` blocker 更像仓库既有/环境级问题，而不是本次改动直接引入。

## 失败项（如有）

- `ui/web`：`npm run build`
  - 失败阶段：`tsc`
  - 代表性报错：
    - `src/lib.ts(11,29): error TS2307: Cannot find module '@yuants/data-series'`
    - `src/main.tsx(15,25): error TS2307: Cannot find module '@yuants/kernel'`
    - `src/modules/Agent/AgentConfForm.tsx(12,57): error TS2307: Cannot find module '@yuants/agent'`
    - `src/modules/Deploy/DeploySettings.tsx(12,29): error TS2307: Cannot find module '@yuants/deploy'`
- 归因判断：当前失败覆盖多个既有模块（`Agent`、`Deploy`、`Kernel`、`TransferOrder` 等），并非聚焦 signal-trader 新模块；因此应先按“仓库原有/环境级问题”处理。

## 备注

- 之所以选择这两个命令，是因为用户已明确要求，而且它们分别是 `apps/signal-trader` 与 `ui/web` 各自最接近真实交付门槛的最小验证入口。
- `apps/signal-trader` 的 `build` 脚本同时执行 Heft build + Jest test，覆盖面已经比单纯编译更强，因此无需额外扩大验证范围。
- 对 `ui/web`，我考虑过更小的备选项（例如只跑单文件/局部 typecheck），但当前全量 `tsc` 在进入 signal-trader 新模块前就被一批既有 workspace 依赖解析错误拦住；先记录这一 blocker 更能真实反映仓库现状。
- 辅助执行了 `git status --short -- ui/web apps/signal-trader`，用于确认本次改动范围中确实包含 `ui/web/src/modules/SignalTrader/` 与 `apps/signal-trader/`，从而做出“失败不直接指向新模块”的归因判断。
