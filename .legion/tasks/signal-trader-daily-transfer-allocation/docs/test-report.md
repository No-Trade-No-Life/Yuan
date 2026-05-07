# signal-trader-daily-transfer-allocation 测试报告

## 结论

- 结果：`PASS-WITH-WARNINGS`
- 日期：2026-03-23
- 覆盖范围：core daily allocation 语义、app runtime transfer 编排、paper 前端冒烟

## 执行命令

1. `npm run build`（workdir=`libraries/signal-trader`）

   - 结果：通过，带 warning
   - 关键覆盖点：
     - `@yuants/signal-trader` build 通过
     - Jest `26/26` 通过
     - API Extractor 通过并更新 `etc/signal-trader.api.md`
   - 告警：
     - `npm warn Unknown env config "tmp"`
     - TypeScript `5.9.3` 高于 Heft / API Extractor 已验证版本

2. `npm run build`（workdir=`apps/signal-trader`）

   - 结果：通过，带 warning
   - 关键覆盖点：
     - `@yuants/app-signal-trader` build 通过
     - Jest `50/50` 通过
     - 覆盖 paper/live 不下单日拨资、paper clock、excess sweep、unlock/backfill 等场景
   - 告警：
     - `npm warn Unknown env config "tmp"`
     - Jest worker 未优雅退出

3. `node common/scripts/install-run-rush.js build -t @yuants/signal-trader -t @yuants/app-signal-trader`

   - 结果：通过，带 warning
   - 关键覆盖点：
     - monorepo 目标链路构建成功
     - `@yuants/signal-trader` 与 `@yuants/app-signal-trader` 在 Rush 依赖图下通过
   - 告警：
     - Rush 提示 Node `24.13.0` 未被当前版本验证
     - `@yuants/app-signal-trader` 仍有 worker forced exit warning

4. `npm run test:e2e:paper`（workdir=`ui/signal-trader-web`）
   - 结果：通过，带 warning
   - 关键覆盖点：
     - 前端 production build 成功
     - paper stack 拉起成功
     - Playwright `@paper loads runtime health and submits a signal` 通过
   - 告警：`npm warn Unknown env config "tmp"`

## 本次新增验证重点

- `libraries/signal-trader/src/index.test.ts`

  - D0 / D1 / D2 `funding_account` / `trading_account` / `available_vc` 新语义
  - precision lock 与 investor buffer
  - over-reserved 不隐式缩仓

- `apps/signal-trader/src/__tests__/signal-trader-app.test.ts`
  - paper 不下单按日拨资
  - paper 平仓后不 sweep 已分配本金
  - live boot/observer 周期不下单也会补资
  - live observer transfer-out 去重

## 备注

- `apps/signal-trader` 单包 `npm run build` 必须在 library 已完成构建后顺序执行；若与 library build 并行，可能因 build clean 导致临时模块解析失败。
- 当前唯一稳定工程尾项仍是 app 测试退出清理 warning，不影响本轮 daily allocation 功能结论。
