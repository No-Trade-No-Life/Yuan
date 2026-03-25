# 测试报告

## 执行命令

1. `./node_modules/.bin/heft test --clean`（workdir=`libraries/signal-trader`）
2. `node common/temp/node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc -p apps/signal-trader/tsconfig.json --noEmit`
3. `./node_modules/.bin/heft build --clean`（workdir=`apps/signal-trader`）
4. `npm run build`（workdir=`ui/signal-trader-web`）
5. focused runtime verification script（直接构造 `RuntimeWorker`，验证 profit target auto-flat + closed lifecycle）

## 结果

PASS-WITH-NOTES

## 摘要

- 通过：`libraries/signal-trader` 的 `heft test --clean`；core build + Jest 全部成功，29/29 用例通过。新增覆盖包含：
  - forced-flat fill attribution 会按 `target_position_qty - settled_position_qty` 回写到 settled exposure；
  - audit_only 下允许 `source='agent'` 的 forced-flat 继续提交；
  - `profit_target_reached` alert message 现在带 `action=auto_flat_profile_close`。
- 通过：`apps/signal-trader` root TypeScript no-emit 检查；命令成功退出，未发现新增类型错误。
- 通过：`apps/signal-trader` 的 `heft build --clean`；app 库构建成功，说明 runtime worker / tests / services 的最新改动可编译产出。
- 通过：`ui/signal-trader-web` 的 `npm run build`；`tsc -b && vite build` 成功，前端 submit gate 新增 `subscription_status` 检查已纳入构建验证。
- 通过：focused runtime verification script；直接驱动 `RuntimeWorker` 完成以下链路：
  - 开仓后 product projection 收敛到 `current_net_qty=1,target_net_qty=1`
  - 账户观察值达到 `profit_target_value` 后自动提交 `signal=0`
  - 自动平仓完成后 product projection 收敛到空仓，subscription/runtime config 同步为 `closed`
  - 关闭生命周期后再次 submit 被拒绝，返回 `RUNTIME_SUBSCRIPTION_INACTIVE`
  - audit log 中存在 `profit_target_flat_submitted` 与 `profit_target_lifecycle_completed`

## 失败项（如有）

- 尝试在当前环境完整重跑 `apps/signal-trader` 的 `heft test --clean` 全量 suite 时，Jest worker 因长期 observer loop 场景触发 OOM；因此本轮最终验证以 core 全量单测 + app 类型检查/构建 + focused runtime verification script 为准。

## 备注

- focused runtime verification script 使用与测试同源的 `RuntimeWorker` / `LiveExecutionAdapter` / in-memory repositories，重点覆盖了本轮新增的 auto-flat + lifecycle close 行为，而不是只验证编译。
- `apps/signal-trader` 与 `libraries/signal-trader` 的 Heft/TypeScript 过程仍会提示当前 TypeScript 5.9.3 高于 Heft 已验证的 5.8，但本轮成功命令均正常完成。
- `ui/signal-trader-web` 构建期间出现 `npm warn Unknown env config "tmp"`，不影响构建产物。
