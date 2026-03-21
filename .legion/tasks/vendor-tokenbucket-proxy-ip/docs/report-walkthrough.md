# Walkthrough Report - vendor-tokenbucket-proxy-ip

## 目标与范围

- 目标：按当前 RFC 收敛 HTTPProxy 信任模型，删除基于 `terminal_id` 的准入与 route pin，让代理链路只按 `labels.ip` 路由，并继续保持 `bucketKey = encodePath([baseKey, ip])` 的 IP 维度限流。
- 范围（绑定本次 scope）：
  - `libraries/http-services/src/proxy-ip.ts`
  - `libraries/http-services/src/__tests__/proxy-ip.test.ts`
  - `libraries/http-services/src/__tests__/client.test.ts`
  - `libraries/http-services/src/__tests__/integration.test.ts`
  - `libraries/http-services/etc/http-services.api.md`
  - `apps/http-proxy/src/index.ts`
  - `apps/vendor-binance/src/api/client.ts`
  - `.legion/tasks/vendor-tokenbucket-proxy-ip/plan.md`
  - `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/rfc.md`
  - `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/test-report.md`
  - `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-code.md`
  - `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-security.md`

## 设计摘要

- 设计真源：`.legion/tasks/vendor-tokenbucket-proxy-ip/docs/rfc.md`
- 核心收敛：删除 `TRUSTED_HTTP_PROXY_TERMINAL_IDS`，不再把 `terminal_id` 用作 HTTPProxy allowlist、helper 返回值或请求 route pin。
- 新信任模型：同一 host 网络内可见的 `HTTPProxy` terminal 默认互信；候选池仅由 `HTTPProxy` 服务、合法 `tags.ip`、`ip_source=http-services` 和按 IP 去重构成。
- 接口收敛：`AcquireProxyBucketResult` 从 `{ ip, terminalId, bucketKey }` 收敛为 `{ ip, bucketKey }`；`apps/vendor-binance` 的请求上下文与发送标签同步移除 `terminalId` / `labels.terminal_id`。
- 边界澄清：类似字段仍允许保留，但仅限观测/缓存用途，不再承担 trust boundary 或 route pin 语义；本次明确包括 `terminal_id` 的本地缓存/metrics、`hostname`、`ip_source`。

## 改动清单

### 1. `libraries/http-services/src/proxy-ip.ts`

- 删除 `TRUSTED_HTTP_PROXY_TERMINAL_IDS` 的解析、缓存、allowlist 日志与 fail-closed 分支。
- 将候选池统一收敛为共享逻辑，供导出的 proxy IP helper 复用，避免部分路径残留旧的 terminal allowlist 语义。
- 保留 IP 维度选择与 bucket 语义：helper 仍返回 `{ ip, bucketKey }`，bucket key 仍按 `encodePath([baseKey, ip])` 生成。
- 保留但降级 `terminal_id` 相关残留用途：仅用于本地缓存命名空间、metrics 或诊断上下文，不再参与候选筛选、授权或路由。

### 2. `libraries/http-services/src/__tests__/proxy-ip.test.ts`

- 删除或重写旧 allowlist 相关断言，改为覆盖“环境变量存在但被忽略”。
- 新增同 IP 多 terminal 去重验证，确保不会因 terminal 数量放大 bucket cardinality。
- 继续覆盖空池、失败切换、旧错误语义与 IP 等价类行为，确保删除 `terminal_id` 信任边界后核心 helper 仍可工作。

### 3. `libraries/http-services/src/__tests__/client.test.ts`

- 继续锁定 route/request 阶段错误边界。
- 配合新模型确认请求只依赖 `labels.ip` 路由，不再需要 `labels.terminal_id`。

### 4. `libraries/http-services/src/__tests__/integration.test.ts`

- 增加/确认“两个 `HTTPProxy` terminal 共享同一 IP 时，仅带 `labels.ip` 仍能路由成功”的验收。
- 增加/确认“无匹配 IP 时返回 `stage=route` / `E_PROXY_TARGET_NOT_FOUND`”的验收。

### 5. `libraries/http-services/etc/http-services.api.md`

- 同步删除 `AcquireProxyBucketResult.terminalId`，确保导出面与实现、消费方一致，不留下半改状态。

### 6. `apps/http-proxy/src/index.ts`

- 删除服务注册中的 `labels.terminal_id`，停止暴露 terminal 级 route pin 能力。
- 保留 `labels.ip` 作为唯一业务路由键。
- 保留 `hostname`，但仅作为观测/人工排障字段，不再承担路由 pin 或信任决策语义。

### 7. `apps/vendor-binance/src/api/client.ts`

- 删除对 `AcquireProxyBucketResult.terminalId` 的消费与 `IRequestContext.terminalId`。
- 代理请求标签收敛为只发送 `labels.ip`，不再发送 `labels.terminal_id`。
- 保持 vendor 侧 bucket key 与最终路由 IP 同源，避免“同一出口、不同 terminal 身份”的伪差异。

## 如何验证

测试报告：`.legion/tasks/vendor-tokenbucket-proxy-ip/docs/test-report.md`

执行结果（真实结果）：

- `node common/scripts/install-run-rush.js install`：成功。
- `node common/scripts/install-run-rush.js build --to @yuants/app-host`：成功。
- `npx @rushstack/heft test --clean`（`libraries/http-services`）：成功，`4 suites / 38 tests / 0 failed`。
- `node common/scripts/install-run-rush.js build --to @yuants/http-services --to @yuants/vendor-binance`：成功。
- `npm run build`（`apps/vendor-binance`）：成功。

失败与修复记录：

- 曾有一次失败：首次直接执行 `node common/scripts/install-run-rush.js build --to @yuants/http-services --to @yuants/vendor-binance` 时，因未先构建 `@yuants/app-host`，导致 integration host 无法启动。
- 处理方式：先补跑 `node common/scripts/install-run-rush.js build --to @yuants/app-host`，再复跑原命令，结果通过。

验收点对应：

- `TRUSTED_HTTP_PROXY_TERMINAL_IDS` 已移除，且相关 env 即使存在也被忽略。
- 同 IP 多 terminal 会被视为同一个 IP 等价类，不再因为 `terminal_id` 放大 bucket 或固定路由。
- 请求仅按 `labels.ip` 路由仍可成功。
- route 阶段无匹配时返回 `E_PROXY_TARGET_NOT_FOUND`。

## 风险与回滚

- 风险：信任模型从 terminal allowlist 收敛为 host 内默认互信；若 host 网络前提失效，当前设计会立即退化为前提外高风险模型。
- 风险：`hostname`、`ip_source`、以及本地缓存/metrics 中残留的 `terminal_id` 若未来被重新解释为授权或选路条件，会重新引入错误 trust boundary。
- 风险：`http-proxy` 仍需依赖部署侧约束 `allowedHosts` 等外围控制；这不是本次变更新增问题，但仍是 residual risk。
- 回滚：直接回滚到删除 allowlist 之前的稳定 commit/版本，恢复旧的 terminal allowlist 与 route pin 逻辑。
- 回滚判据：`E_PROXY_TARGET_NOT_FOUND` 异常升高且确认由 host 内标签/路由不一致引起，而非真实容量不足或服务未注册。

## 未决项与下一步

- 将 `hostname`、`ip_source`、以及本地缓存/metrics 中使用的 `terminal_id` 的“仅限观测/缓存”定位继续固化到实现注释或运行文档，降低后续概念漂移风险。
- 若后续需要更强隔离，应新增 host 接入鉴权、签名标签、mTLS 或网络隔离，而不是恢复 `terminal_id` allowlist。
- 如需提升排障能力，可补充“实际命中的 proxy terminal/service”观测字段，但只用于日志/指标，不回流为路由或授权条件。
- 评审结论已闭环：`review-code` 为 PASS，`review-security` 为 PASS；其中安全 PASS 以用户明确确认的“host 内互信”前提为边界。
