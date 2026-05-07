# signal-trader-formal-quote-source 测试报告

## 结论

- 结果：`PASS-WITH-WARNINGS`
- 日期：2026-03-23
- 覆盖范围：formal quote source core/app 接入、idempotency、datasource 歧义 fail-close、联合构建链路

## 执行命令

1. `npm run build`（workdir=`libraries/signal-trader`）

   - 结果：通过，带 warning
   - 关键覆盖点：
     - `@yuants/signal-trader` build
     - `lib/index.test.js` 26 passed
     - API Extractor 通过
   - 告警：
     - `npm warn Unknown env config "tmp"`
     - TypeScript `5.9.3` 高于 Heft / API Extractor 已验证版本

2. `node common/scripts/install-run-rush.js build -t @yuants/signal-trader`

   - 结果：通过，带 warning
   - 关键覆盖点：
     - `@yuants/signal-trader` 与依赖链在 Rush 下通过
   - 告警：Rush 提示 Node.js `24.13.0` 未被当前 Rush 版本验证

3. `node common/scripts/install-run-rush.js build -t @yuants/signal-trader -t @yuants/app-signal-trader`
   - 结果：通过，带 warning
   - 关键覆盖点：
     - library + app 联合目标构建通过
     - app 侧 quote provider / bootstrap / runtime 测试一并通过
   - 告警：
     - Rush 提示 Node.js `24.13.0` 未被验证
     - `@yuants/app-signal-trader` 仍有 Jest worker 未优雅退出 warning

## 本次新增验证重点

- `libraries/signal-trader/src/index.test.ts`

  - internal netting 仅在 formal reference evidence 完整时触发
  - quote 缺失 / quote evidence 不完整时，不生成 `MidPriceCaptured`
  - `reference_price*` 不进入 idempotency fingerprint

- `apps/signal-trader/src/__tests__/bootstrap-from-env.test.ts`
  - SQL `QUOTE` provider 能正确读取并映射 bid/ask mid
  - 多 datasource 且未显式指定时返回 `QUOTE_AMBIGUOUS_DATASOURCE`

## 备注

- 本轮没有新增 SQL schema，也没有改变 transfer/daily burn 主链。
- 当前唯一稳定工程尾项仍是 `@yuants/app-signal-trader` 的 Jest teardown warning，不阻断本次 quote-source 交付。
