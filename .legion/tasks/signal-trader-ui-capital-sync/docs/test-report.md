# signal-trader-ui-capital-sync 测试报告

## 结论

- 结果：`PASS`
- 日期：2026-03-23
- 覆盖范围：独立前端类型/API/页面同步、paper 前端冒烟

## 执行命令

1. `npm run build`（workdir=`ui/signal-trader-web`）

   - 结果：通过
   - 关键覆盖点：
     - 前端 TypeScript 构建通过
     - Vite 产物生成成功

2. `npm run test:e2e:paper`（workdir=`ui/signal-trader-web`）
   - 结果：通过
   - 关键覆盖点：
     - 页面成功加载 runtime rail
     - capital / evidence 模块可见
     - 仍可提交 signal 并看到事件流更新

## 本次新增验证重点

- `ui/signal-trader-web/src/types.ts`
  - 同步了 subscription / investor / signal / reconciliation DTO
- `ui/signal-trader-web/src/app.tsx`
  - capital 视图
  - investor / signal 视图
  - formal quote / netting / advisory 证据视图
  - 分项 projection 容错加载
  - 经过 sanitize 的 raw evidence 展示

## 备注

- `npm warn Unknown env config "tmp"` 是本机 npm 告警，不影响构建与测试结果。
- 当前前端 Playwright 仍偏 smoke test，后续如要更强回归保护，可补 capital / investor / signal / quote 字段值断言。
