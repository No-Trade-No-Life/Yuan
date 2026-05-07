# signal-trader-daily-burn-budget 测试报告

## 结论

- 结果：`PASS-WITH-WARNINGS`
- 日期：2026-03-22
- 覆盖范围：core daily burn helper、library/app 构建、paper/live 跨天预算回归

## 执行命令

1. `node common/scripts/install-run-rush.js build -t @yuants/signal-trader`

   - 结果：通过，首次重跑时带 API Extractor 签名变更提示，随后缓存稳定。
   - 关键覆盖点：
     - `libraries/signal-trader` build
     - `lib/index.test.js` 16 tests passed
     - API report 更新并通过

2. `node common/scripts/install-run-rush.js build -t @yuants/app-signal-trader`

   - 结果：通过，带 warning
   - 关键覆盖点：
     - `apps/signal-trader` build
     - app 测试 37 passed（含新增 paper/live 跨天预算回归）
   - 告警：Jest worker 未优雅退出，疑似 open handles / timer 泄漏；不影响本次功能通过。

3. `node common/scripts/install-run-rush.js build -t @yuants/signal-trader -t @yuants/app-signal-trader`

   - 结果：通过，带 warning
   - 关键覆盖点：
     - library + app 联合目标在同一 Rush 依赖图下通过
   - 告警：同上，仅 `@yuants/app-signal-trader` 存在 worker 退出 warning。

4. `npm run build`（workdir=`libraries/signal-trader`）

   - 结果：通过
   - 关键覆盖点：
     - `heft test --clean`
     - `lib/index.test.js` 16 passed
     - `api-extractor run --local`

5. `npm run build`（workdir=`apps/signal-trader`）
   - 结果：通过，带 warning
   - 关键覆盖点：
     - `heft test --clean`
     - `lib/__tests__/bootstrap-from-env.test.js` 7 passed
     - `lib/__tests__/signal-trader-app.test.js` 30 passed
     - 总计 37 passed
   - 告警：同样存在 Jest worker 未优雅退出 warning。

## 本次新增验证重点

- `libraries/signal-trader/src/index.test.ts`

  - 新 subscription 首日 tranche = `min(vc_budget, daily_burn_amount)`
  - D0 / D+1 / D+2 lazy release
  - query-only 跨天刷新
  - reconciliation 跨天预算口径
  - over-reserved 下维持现状且禁止同向扩张

- `apps/signal-trader/src/__tests__/signal-trader-app.test.ts`
  - paper：跨天后 query 与 submit 共用同一 daily burn 预算语义
  - live：跨天 submit 使用同一 daily burn 预算语义

## 备注

- `@yuants/app-signal-trader` 的 warning 属于既有测试退出清理问题，不影响本次 daily burn 功能与断言结果。
- Rush 仍提示当前 Node.js `24.13.0` 未被该版本 Rush 验证；npm 仍提示 env config `tmp` 的未来兼容 warning。这两项都未阻断本次结果。
