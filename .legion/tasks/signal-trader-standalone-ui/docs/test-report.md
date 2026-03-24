# signal-trader-standalone-ui 测试报告

## 结论

- 结果：`PASS`
- 日期：2026-03-22
- 覆盖范围：独立前端构建、paper 真实端到端、dummy-live fail-close 端到端

## 执行命令

1. `node common/scripts/install-run-rush.js build -t @yuants/app-host -t @yuants/app-postgres-storage -t @yuants/app-signal-trader -t @yuants/tool-sql-migration -t @yuants/ui-signal-trader-web`

   - 结果：通过
   - 备注：`@yuants/app-signal-trader` 在一次构建中出现 Jest worker 未优雅退出的 warning，但目标产物可用，不影响本次前端交付。

2. `npm run test:e2e:paper`（workdir=`ui/signal-trader-web`）

   - 结果：通过
   - 覆盖点：
     - 启动本地 paper Host/Postgres/signal-trader 栈
     - 页面加载 runtime 列表与 health
     - 成功提交一次 `SubmitSignal`
     - Event Stream 出现 `SignalReceived`

3. `npm run test:e2e:dummy-live`（workdir=`ui/signal-trader-web`）
   - 结果：通过
   - 覆盖点：
     - 启动 task-local dummy signal-trader fixture
     - 页面进入 `dummy-live` 风险档位
     - 未输入 `runtime_id` 时，提交按钮保持禁用
     - fail-close 原因文案可见

## 关键说明

- `paper` 冒烟使用真实本地 signal-trader 栈，验证的是前端与现有 Host `/request`、SQL migration、paper runtime 的真实闭环。
- `dummy-live` 冒烟使用 task-local fixture server，目标是稳定验证高风险写入护栏，而不是模拟完整 live 执行链路。
- 前端 `preview` / Playwright 统一经由 Node `serve-with-proxy` 代理访问 `/request`；`HOST_TOKEN` 不进入浏览器端。

## 非阻塞备注

- `npm warn Unknown env config "tmp"` 是本机 npm 警告，不影响本次构建与测试结果。
- 真实 docker 版 dummy-live 启动包装脚本仍保留在 `ui/signal-trader-web/scripts/run-dummy-live-stack.mjs`，但本次通过判定依赖的是更确定的 fixture 路径。
