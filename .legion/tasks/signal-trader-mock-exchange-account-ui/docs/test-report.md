# 测试报告

## 执行命令

1. `node common/temp/node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc -p apps/signal-trader/tsconfig.json --noEmit`
2. `node common/temp/node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc -p ui/signal-trader-web/tsconfig.json --noEmit`
3. `./node_modules/.bin/heft test --clean`（workdir=`apps/signal-trader`）
4. `npm run build`（workdir=`ui/signal-trader-web`）
5. `./node_modules/.bin/playwright test tests/signal-trader.spec.ts --grep @mock`（workdir=`ui/signal-trader-web`）

## 结果

PASS

## 摘要

- 通过：`apps/signal-trader` TypeScript 检查；命令成功退出，`--noEmit` 未生成产物。
- 通过：`ui/signal-trader-web` TypeScript 检查；命令成功退出，`--noEmit` 未生成产物。
- 通过：`apps/signal-trader` 的 `heft test --clean`；Jest 共 57 个用例全部通过，其中包含 mock 盈利 +10、fallback 定价、transfer free clamp、runtime account_id 变更回归、标准 mock 读面注册/清理与匿名关闭负向测试。
- 通过：`ui/signal-trader-web` 的 `npm run build`；`vite build` 成功，当前产出为 `ui/signal-trader-web/dist/index.html`、`ui/signal-trader-web/dist/assets/index-rHQ44Lh-.css`、`ui/signal-trader-web/dist/assets/index-Cul4sN2i.js`。
- 通过：mock Playwright 冒烟；`@mock loads runtime health and mock account card` 通过，验证独立前端在 mock runtime 下能读取并展示 mock account card。

## 备注

- `heft test` 与 `npm run build` 都会提示当前 TypeScript 5.9.3 高于 Heft 已验证的 5.8，但本次命令均成功完成。
- Playwright 运行期间会临时创建 `signal-trader-paper-postgres` 容器与 `dev_default` 网络，测试结束后已自动清理。
- 本轮未额外执行仓库级 `rush build`；如需要更高信心，可在后续 PR 阶段补跑针对 `@yuants/app-signal-trader` 与 `@yuants/ui-signal-trader-web` 的 Rush 目标构建。
