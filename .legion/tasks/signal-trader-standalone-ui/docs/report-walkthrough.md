# signal-trader-standalone-ui 交付走查

## 目标与范围

- 本次交付在 `ui/signal-trader-web/**` 新建独立 signal-trader 控制台，不再回接 `ui/web/**`，目标是提供可单独运行、可本地联调、可端到端验证的产品化前端。
- 范围覆盖独立前端工程、Host `/request` 代理链路、`SubmitSignal` 风险护栏、Rush 接入与最小联调/测试脚本。
- 本次允许的宿主侧改动仅限 `apps/host/src/host-manager.ts` 与 `apps/host/src/utils/parseBodyText.ts`，用于修复本地联调阻塞与补齐请求体限制。
- 相关设计与评审文档：`rfc.md`、`review-rfc.md`、`review-code.md`、`review-security.md`、`test-report.md`。

## 设计摘要

- 设计基线见 `rfc.md`：独立前端固定落在 `ui/signal-trader-web`，所有页面请求统一走同源 `/request`，开发态由 Vite middleware 代理，预览与 Playwright 走 Node `serve-with-proxy`。
- 风险模型采用 `env profile + runtime config + capability summary + health/freshness + runtime_id confirmation` 交叉校验，任一缺失或冲突都按 `live` 且默认禁写。
- 安全边界上，浏览器 bundle 不持有 `HOST_TOKEN`；高风险写入在 standalone proxy 先做一次 fail-close 复核，再转发给 Host/服务端。
- `.legion/playbook.md` 已沉淀控制面约定：live readiness 必须看 matched + freshness，且独立控制面需要在 Node proxy 侧重复做最小安全复核。

## 改动清单

### 1. 独立前端项目与 Rush 接入

- `ui/signal-trader-web/package.json`：新增独立包 `@yuants/ui-signal-trader-web`，定义 `dev`、`build`、`preview`、`test:e2e:paper`、`test:e2e:dummy-live` 脚本。
- `ui/signal-trader-web/config/rush-project.json`、`rush.json`、`common/config/rush/pnpm-lock.yaml`：把新项目纳入 Rush 工程图与锁文件，保证仓库级构建可识别。
- `ui/signal-trader-web/vite.config.ts`：注入 `app-config.json` 与 `/request` middleware，统一 dev 态运行配置。

### 2. 页面工作区与只读/写入分区

- `ui/signal-trader-web/src/app.tsx`：实现单页控制台，包含 runtime rail、环境摘要、health/config/capability 摘要、projection/event/audit 观测面，以及 `SubmitSignal` 写入卡片。
- `ui/signal-trader-web/src/api.ts`：封装 `SignalTrader/ListRuntimeConfig`、`GetRuntimeHealth`、`QueryProjection`、`QueryEventStream`、`QueryRuntimeAuditLog`、`SubmitSignal` 等请求，前端页面不直接拼 `/request` payload。
- `ui/signal-trader-web/src/styles.css`、`ui/signal-trader-web/src/types.ts`、`ui/signal-trader-web/src/main.tsx`：补齐视觉层、类型与入口，形成独立可运行的控制台壳。

### 3. 风险护栏与代理复核

- `ui/signal-trader-web/src/risk.ts`：前端根据 profile、runtime、capability、health/freshness、runtime_id 确认结果计算风险档位与禁写原因，默认 fail-close。
- `ui/signal-trader-web/scripts/request-proxy.mjs`：统一处理 dev/preview 代理，请求体大小限制为 1 MiB，并在 `SignalTrader/SubmitSignal` 前做 Node 侧二次校验。
- `ui/signal-trader-web/scripts/serve-with-proxy.mjs`：为 `build + preview` 提供静态托管与 `/request` 代理，保证预览链路与 Playwright 链路一致。

### 4. Host 侧配套修补

- `apps/host/src/host-manager.ts`：修复多租户 `host_id` 解析与日志脱敏问题，避免 `ED25519` 模式错误回落到 `main`，并确保 `authorization`、`host_token`、`signature` 不以明文进入日志。
- `apps/host/src/utils/parseBodyText.ts`：补齐 1 MiB 请求体上限，降低大包体带来的联调与 DoS 风险。

### 5. 本地联调与 Playwright 冒烟

- `ui/signal-trader-web/scripts/run-paper-stack.mjs`、`ui/signal-trader-web/scripts/bootstrap-paper-app.mjs`：封装 paper 本地栈启动与清理。
- `ui/signal-trader-web/scripts/run-dummy-fixture-stack.mjs`、`ui/signal-trader-web/scripts/dummy-signal-trader-server.mjs`：提供更稳定的 dummy-live fixture 路径，用于验证 fail-close 而非模拟完整 live 执行链路。
- `ui/signal-trader-web/scripts/run-playwright.mjs`、`ui/signal-trader-web/tests/signal-trader.spec.ts`、`ui/signal-trader-web/playwright.config.ts`：固化 paper happy path 与 dummy-live fail-close 冒烟路径。

## 如何验证

详细结果见 `test-report.md`，本次验证结论为 `PASS`。

1. 仓库目标构建

```bash
node common/scripts/install-run-rush.js build -t @yuants/app-host -t @yuants/app-postgres-storage -t @yuants/app-signal-trader -t @yuants/tool-sql-migration -t @yuants/ui-signal-trader-web
```

- 预期：目标包构建通过，新前端可被 Rush 正常识别并产出可运行构建。

2. paper 端到端冒烟

```bash
npm run test:e2e:paper
```

- workdir：`ui/signal-trader-web`
- 预期：页面成功加载 runtime 与 health；`SubmitSignal` 可提交；Event Stream 中可见 `SignalReceived`；成功横幅显示 `accepted=true`。

3. dummy-live fail-close 冒烟

```bash
npm run test:e2e:dummy-live
```

- workdir：`ui/signal-trader-web`
- 预期：页面进入 `dummy-live` 风险档位；未输入 `runtime_id` 时提交按钮保持禁用；界面展示明确的 fail-close 原因文案。

## 风险与回滚

### 主要风险

- 该前端是控制面，`SubmitSignal` 可触发真实或近实盘写入；若 profile/runtime/capability/freshness 判定漂移，可能误放开高风险写入口。
- 当前前端 `src/risk.ts` 与 Node proxy `scripts/request-proxy.mjs` 分别维护近似规则，后续演进若不同步，存在阈值漂移风险。
- `dummy-live` 自动化当前偏向 fixture fail-close 路径，不等于真实 live 观测链路已完全覆盖。

### 回滚策略

- 前端回滚：停止交付 `@yuants/ui-signal-trader-web`，必要时从 `rush.json` 移除项目注册。
- 运行回滚：保留页面只读，关闭 `SIGNAL_TRADER_ENABLE_MUTATION`，或撤销 Host / signal-trader 对 `SubmitSignal` 的写权限。
- 风险回滚：即使页面仍可访问，也可通过 profile 与 capability 策略让 `dummy-live/live` 默认禁写，快速恢复只读观测态。

## 未决项与下一步

- `dummy-live` 若要升级为更贴近真实链路的联调入口，建议另开后续任务，单独收口 runbook、fixture 与真实 dummy stack 的差异。
- 风控规则目前在前端与 proxy 各维护一份，若后续继续扩展高风险动作，建议抽为单一规则源，避免长期漂移。
- 首版仍聚焦单页控制台与 `SubmitSignal`；`UnlockRuntime`、`BackfillOrderBinding` 等 operator 能力继续留在后续受控任务内处理。
