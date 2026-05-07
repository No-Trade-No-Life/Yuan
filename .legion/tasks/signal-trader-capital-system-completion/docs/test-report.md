# signal-trader-capital-system-completion 测试报告

## 结论

- 结果：`PASS-WITH-WARNINGS`
- 日期：2026-03-23
- 覆盖范围：core 资本语义、replay/query、一体化构建链路

## 执行命令

1. `npm run build`（workdir=`libraries/signal-trader`）

   - 结果：通过，带 warning
   - 关键覆盖点：
     - `@yuants/signal-trader` build
     - `lib/index.test.js` 24 passed
     - API Extractor 通过
   - 告警：
     - `npm warn Unknown env config "tmp"`
     - TypeScript `5.9.3` 高于 Heft / API Extractor 已验证版本
     - API Extractor 自动更新 `libraries/signal-trader/etc/signal-trader.api.md`

2. `node common/scripts/install-run-rush.js build -t @yuants/signal-trader`

   - 结果：通过，带 warning
   - 关键覆盖点：
     - `@yuants/signal-trader` 与依赖链在 Rush 下通过
   - 告警：Rush 提示 Node.js `24.13.0` 未被该版本验证

3. `npm run build`（workdir=`apps/signal-trader`）

   - 结果：通过，带 warning
   - 关键覆盖点：
     - `lib/__tests__/bootstrap-from-env.test.js` 9 passed
     - `lib/__tests__/signal-trader-app.test.js` 36 passed
     - 总计 45 passed
   - 告警：Jest worker 未优雅退出，疑似 open handles / timer 泄漏

4. `node common/scripts/install-run-rush.js build -t @yuants/signal-trader -t @yuants/app-signal-trader`
   - 结果：通过，带 warning
   - 关键覆盖点：
     - library + app 联合目标在同一 Rush 依赖图下通过
   - 告警：
     - Rush 提示 Node.js `24.13.0` 未被该版本验证
     - `@yuants/app-signal-trader` 仍保留 Jest worker 未优雅退出 warning

## 本次新增验证重点

- `libraries/signal-trader/src/index.test.ts`
  - `precision_lock` -> investor buffer
  - internal netting happy path
  - internal netting blocked when pending order exists
  - account-scoped advisory `profit_target_reached`
  - `investor` / `signal` projection query
  - reconciliation tolerance / explanation

## 备注

- 本轮主要改动集中在 `libraries/signal-trader`；`apps/signal-trader` 仅做最小查询/权限/测试配合，因此验证重点仍以 core 为主。
- 当前唯一稳定工程尾项是 `@yuants/app-signal-trader` 的 Jest teardown warning，不影响本次资本系统功能结论。
