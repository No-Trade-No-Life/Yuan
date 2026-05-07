# signal-trader-formal-process-tests 测试报告

## 结论

- 结果：`PASS-WITH-WARNINGS`
- 日期：2026-03-24

## 执行命令

1. `npm run build`（workdir=`libraries/signal-trader`）

   - 结果：通过，带环境/工具链 warning
   - 关键覆盖点：Jest `27/27` 通过；新增 formal-process library 用例通过。

2. `npm run build`（workdir=`apps/signal-trader`）

   - 结果：通过，带环境/工具链 warning
   - 关键覆盖点：Jest `51/51` 通过；新增 paper/live formal-process app 用例通过。

3. `node common/scripts/install-run-rush.js build -t @yuants/signal-trader -t @yuants/app-signal-trader`
   - 结果：通过，带 Rush/Node 版本 warning
   - 关键覆盖点：targeted Rush build 成功。

## 本次新增用例重点

- library：

  - 同日重复 query 不双释放
  - 多天推进后封顶到 `vc_budget`

- app / paper：

  - 不下单按日拨资
  - 同日不重复补资
  - 达到 cap 后停止继续拨资

- app / live：
  - 同一 snapshot 不重复补资
  - 只有跨天 + 新 snapshot 才继续按日拨资

## 备注

- 当前剩余 warning 主要是工具链环境提示，不是新增 formal-process 用例引起的问题。
