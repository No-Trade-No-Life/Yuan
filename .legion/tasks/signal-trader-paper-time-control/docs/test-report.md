# signal-trader-paper-time-control 测试报告

## 结论

- 结果：`PASS-WITH-WARNINGS`
- 日期：2026-03-23
- 覆盖范围：paper clock manager/worker/service/CLI 最小闭环

## 执行命令

1. `npm run build`（workdir=`apps/signal-trader`）

   - 结果：通过，带 warning
   - 覆盖点：Heft build 完成，Jest 2 个 suite / 48 个测试全部通过。
   - 告警：TypeScript `5.9.3` 超出 Heft 已验证版本；Jest worker 未优雅退出。

2. `node common/scripts/install-run-rush.js build -t @yuants/app-signal-trader`

   - 结果：通过，带 warning
   - 覆盖点：`@yuants/app-signal-trader` 与依赖链构建成功。
   - 告警：Rush 提示 Node `24.13.0` 未被该版本验证；目标包仍有 worker forced exit warning。

3. 手工 smoke：`status -> advance 1d -> reset`
   - 结果：通过
   - 覆盖点：
     - 初始 `offset_ms=0`
     - 推进后 `offset_ms=86400000` 且有效时间前进 1 天
     - `reset` 后恢复 `offset_ms=0`

## 备注

- 当前 paper stack 已具备可运行时控制的时间偏移能力，无需修改系统时间。
- 主要工程尾项仍是 app 测试退出清理 warning，不影响功能结论。
