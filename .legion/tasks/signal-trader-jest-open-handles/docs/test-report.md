# signal-trader-jest-open-handles 测试报告

## 结论

- 结果：`PASS-WITH-WARNINGS`
- 日期：2026-03-24
- 核心变化：修复 `@yuants/app-signal-trader` 的 worker forced exit warning

## 执行命令

1. `npm run build`（workdir=`apps/signal-trader`）

   - 结果：通过
   - 关键覆盖点：Heft build + Jest `50/50` 通过，worker forced exit warning 消失。
   - 剩余告警：TypeScript `5.9.3` 高于 Heft 已验证版本；`npm warn Unknown env config "tmp"`。

2. `node common/scripts/install-run-rush.js build -t @yuants/app-signal-trader`

   - 结果：通过
   - 关键覆盖点：Rush 定向构建成功，worker forced exit warning 消失。
   - 剩余告警：Rush 提示 Node `24.13.0` 未被当前版本验证。

3. `npx jest lib/__tests__/signal-trader-app.test.js --runInBand --detectOpenHandles`（辅助诊断）
   - 结果：通过
   - 关键覆盖点：单测 `39/39` 通过，进程未再因 observer timer 残留挂住构建链路。

## 备注

- 当前 warning 已从“worker forced exit”收敛为纯工具链/环境提示。
- 本轮未继续扩大到 `createSignalTraderApp().dispose()` 或测试文件大规模 teardown 重构。
