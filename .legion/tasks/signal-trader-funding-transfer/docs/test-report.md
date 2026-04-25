# signal-trader-funding-transfer 测试报告

## 结论

- 结果：`PASS-WITH-WARNINGS`
- 日期：2026-03-23
- 覆盖范围：core funding/trading projection、transfer venue、paper/live runtime 编排、构建链路

## 执行命令

1. `npm run build`（workdir=`libraries/signal-trader`）

   - 结果：通过，带工具链 warning
   - 关键覆盖点：
     - `libraries/signal-trader` build
     - `lib/index.test.js` 17 passed
     - `api-extractor run --local` 通过
   - 告警：TypeScript `5.9.3` 高于 Heft / API Extractor 已验证版本

2. `node common/scripts/install-run-rush.js build -t @yuants/app-signal-trader`

   - 结果：通过，带 warning
   - 关键覆盖点：
     - `@yuants/app-signal-trader` 与依赖链在 Rush 下通过
     - app 测试包含 transfer happy path / mismatch / conflict 回归
   - 告警：Jest worker 未优雅退出，疑似 open handles / timer 泄漏

3. `npm run build`（workdir=`apps/signal-trader`）

   - 结果：通过，带 warning
   - 关键覆盖点：
     - `lib/__tests__/bootstrap-from-env.test.js` 9 passed
     - `lib/__tests__/signal-trader-app.test.js` 36 passed
     - 总计 45 passed
   - 告警：同样存在 Jest worker 未优雅退出 warning

4. `node common/scripts/install-run-rush.js build -t @yuants/signal-trader -t @yuants/app-signal-trader`
   - 结果：通过，带 warning
   - 关键覆盖点：
     - library + app 联合目标在同一 Rush 依赖图下通过
   - 告警：`@yuants/app-signal-trader` 仍保留 worker 未优雅退出 warning

## 本次新增验证重点

- `libraries/signal-trader/src/index.test.ts`

  - `funding_account` / `trading_account` projection 与 budget helper 一致
  - daily burn 释放与 capital 字段联动

- `apps/signal-trader/src/__tests__/bootstrap-from-env.test.ts`

  - 默认 transfer venue 的 query / submit / poll
  - service policy 默认收紧与显式 env 放开

- `apps/signal-trader/src/__tests__/signal-trader-app.test.ts`
  - paper mock transfer-in / transfer-out
  - live pre-order transfer-in
  - live observer transfer-out 去重与 cooldown
  - `TRANSFER_CURRENCY_MISMATCH`
  - `TRANSFER_TRADING_ACCOUNT_CONFLICT`

## 备注

- `npm warn Unknown env config "tmp"` 为本机 npm 警告，不影响本次结论。
- 当前唯一稳定告警是 `@yuants/app-signal-trader` 的 Jest worker 退出清理问题；功能与断言结果均通过。
