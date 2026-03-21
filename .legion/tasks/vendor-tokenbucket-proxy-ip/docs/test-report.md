# 测试报告

## 执行命令

- `node common/scripts/install-run-rush.js install`（repo root）
- `node common/scripts/install-run-rush.js build --to @yuants/http-services --to @yuants/vendor-binance`（repo root，首次失败）
- `node common/scripts/install-run-rush.js build --to @yuants/app-host`（repo root）
- `npx @rushstack/heft test --clean`（`libraries/http-services`）
- `node common/scripts/install-run-rush.js build --to @yuants/http-services --to @yuants/vendor-binance`（repo root，补齐 host 后复跑成功）
- `npm run build`（`apps/vendor-binance`）

## 结果

PASS

## 摘要

- 依赖安装成功，`rush install` 无异常，为后续定向构建与单测提供了完整工作区。
- `libraries/http-services` 定向单测通过：4 suites / 38 tests / 0 failed，覆盖本次关键路径中的 `proxy-ip`、client 错误边界与 integration 路由行为。
- 首次直接执行 `rush build --to @yuants/http-services --to @yuants/vendor-binance` 失败，原因是 `apps/host/lib/index.js` 尚未构建，导致 integration test 所需 host 无法启动；先补构建 `@yuants/app-host` 后，复跑定向构建通过。
- `apps/vendor-binance` 执行 `npm run build` 通过；Jest 0 suites 但退出码为 0，TypeScript 编译与 API Extractor 均通过，满足 vendor 侧构建验收。
- 关键验收点已覆盖并通过：allowlist 被移除、相关 env 被忽略、请求仅按 `labels.ip` 路由成功、`vendor-binance` 构建通过。

## 失败项（如有）

- 首次失败命令：`node common/scripts/install-run-rush.js build --to @yuants/http-services --to @yuants/vendor-binance`。
- 失败原因：`apps/host/lib/index.js` 缺失，`libraries/http-services/src/__tests__/integration.test.ts` 依赖的 integration host 无法启动。
- 处理方式：先执行 `node common/scripts/install-run-rush.js build --to @yuants/app-host`，再复跑原定向构建命令，结果通过。

## 备注

- 之所以优先采用 `rush install` 与 `rush build --to ...`，是因为仓库 CI（`.github/workflows/ci.yml`）以 Rush 作为主验证入口；这也是单仓多包场景下成本最低、最贴近真实流水线的选择。
- 之所以选择 `npx @rushstack/heft test --clean` 作为 `http-services` 的 targeted test，是因为 `libraries/http-services/package.json` 的 `build` 脚本本身以 `heft test --clean` 起步，且本次 scope 的核心单测与 integration test 都在该包内。
- 之所以补充 `apps/vendor-binance` 的 `npm run build`，是因为 `apps/vendor-binance/package.json` 仅显式提供 `build` 脚本，没有独立 `test` 脚本；该命令同时覆盖 heft、TypeScript 与 API Extractor，是该包最合适的最小验收入口。
- 考虑过的备选项包括：直接跑仓库级 `rush build --verbose`、只跑 `libraries/http-services` 的 `npm run build`、以及仅执行单个 Jest 文件；最终未采用，是因为前者成本更高，后两者对跨包依赖与 vendor 构建验收覆盖不足。
