# 测试报告

## 执行命令

- `node /Users/c1/.rush/node-v24.13.0/pnpm-10.27.0/node_modules/pnpm/bin/pnpm.cjs exec tsc -p tsconfig.json --noEmit`（workdir: `tools/yuanctl`）
- `node common/scripts/install-run-rush.js test --to @yuants/tool-yuanctl`（workdir: repo root）
- `node /Users/c1/.rush/node-v24.13.0/pnpm-10.27.0/node_modules/pnpm/bin/pnpm.cjs exec heft test --clean --test-path-pattern cli-commands.test.ts`（workdir: `tools/yuanctl`）

## 结果

FAIL

## 摘要

- `tsc --noEmit` 失败，主要被 `tools/yuanctl` 既有 TypeScript 问题阻塞：workspace 依赖类型解析失败（`@yuants/deploy` / `@yuants/sql` / `@yuants/protocol` / `@yuants/utils`）以及若干旧文件显式类型错误。
- `rush test --to @yuants/tool-yuanctl` 不可用：当前仓库 Rush 未定义 `test` 子命令，CLI 直接报 `Invalid choice: test`。
- 更贴近本次改动的 targeted 命令 `heft test --clean --test-path-pattern cli-commands.test.ts` 也在 TypeScript 构建阶段提前失败，未进入 Jest 执行。

## 失败项（如有）

- 历史/工具链问题：
  - Rush 无 `test` 命令，无法按用户给定的第 2 条路径执行。
  - `tools/yuanctl/package.json` 的 `test` script 仍是 `heft test --clean --debug`，而当前 Heft 会把 `--debug` 识别为歧义参数（本轮未直接执行该脚本，但与既有阻塞一致）。
  - `tools/yuanctl` 存在既有 TS 错误：旧 `src/cli/verbs/*`、`src/client/*`、`src/utils/*` 等文件报错，且多处与本次 Phase 1 新增代码无关。
- 与本次改动直接相关：
  - `src/namespaces/deploy/index.ts:7` 仍报 `Cannot find module '@yuants/deploy'`；它落在本次改动面内，但从现象看与同仓内多处 workspace 依赖解析失败属于同类环境/包解析问题，暂不能单独归因为 Phase 1 逻辑缺陷。

## 备注

- 之所以先跑 `tsc --noEmit`：这是用户指定的最低成本编译级验证，最快能判断 Phase 1 改动是否被基础类型检查卡住。
- 之所以再跑 `rush ... test --to`：这是用户点名的仓库级验证路径；实际不可用的原因已在上文记录。
- 之所以补跑 `heft test --clean --test-path-pattern cli-commands.test.ts`：它最接近本次改动的 CLI 命令树测试文件，且成本低于全量；但仍被包级 TypeScript 构建前置失败挡住。
- 备选项考虑过 `pnpm exec jest --config config/jest.config.json --runTestsByPath src/cli/__tests__/cli-commands.test.ts --runInBand`，但当前包内无可直接调用的 `jest` binary，`pnpm exec jest` 返回 `Command "jest" not found`。

## Docker Compose E2E（2026-03-23）

### 执行命令

- `node common/scripts/install-run-rush.js build --to @yuants/tool-yuanctl`
- `node tools/yuanctl/scripts/run-yuanctl-e2e.js`

### 环境

- PostgreSQL: `timescale/timescaledb-ha:pg17`
- Node Unit: `ghcr.io/no-trade-no-life/node-unit:0.12.16`
- 额外约束：`nodeunit` 服务在当前 arm64 宿主机上需固定 `platform: linux/amd64`

### 结果

PASS

### 覆盖范围

- `config init`
- `deploy inspect`
- `deploy enable`
- `deploy disable`
- `deploy restart`
- `deploy logs`
- `deploy delete`
- docker compose 启停、SQL migration、node-unit 发现、deployment seed/cleanup

### 备注

- 旧 e2e 脚本已迁移为新命令树，不再使用废弃的 `get/describe/config-init` 入口。
- 为适应当前 protocol 调试输出与 CLI 单次命令生命周期，e2e 脚本新增了 stdout 清洗与子进程超时保护。
