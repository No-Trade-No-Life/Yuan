# app-signal-trader-live-integration - 上下文

## 会话进展 (2026-03-18)

### ✅ 已完成

- 已批准并创建 `app-signal-trader-live-integration` 任务，并切换为当前 active task。
- 已完成第一轮调研：确认新 app 可复用 `@yuants/exchange`、`@yuants/sql`、`@yuants/secret`、`data-account/data-order` 的现有宿主模式。
- 已完成 `apps/signal-trader` 宿主方案 RFC，并写入 `docs/rfc.md`。
- 已完成 RFC 对抗审查，`docs/review-rfc.md` 结论为 PASS-WITH-NITS，blocking 已清零。
- 已生成 `docs/test-report.md`，当前 targeted build/test 通过。
- 已生成 `docs/review-code.md` 与 `docs/review-security.md`，review 识别出 3 类阻塞问题：锁态恢复错误、缺少 runtime 串行队列、observer/reconciliation 未接入生产路径。
- 已完成 reconciliation freshness gate 最后收口：observer tick 与 submit 前统一执行 freshness gate，并持久化最近 matched reconciliation / account snapshot 状态。
- 已修复 code review 指出的 boot/unlock 误判：同一 fresh matched snapshot 在重启与 unlock 场景下不再被错误卡在 audit_only。
- 已完成 targeted rebuild 验证：`node common/scripts/install-run-rush.js rebuild -t @yuants/app-signal-trader -t @yuants/tool-sql-migration --verbose` 通过；`@yuants/app-signal-trader` 1 suite / 18 tests 通过。
- 已重新生成 `docs/test-report.md`、`docs/review-code.md`、`docs/review-security.md`，当前 code/security review 均无 blocker。
- 已生成最终交付文档 `docs/report-walkthrough.md` 与 `docs/pr-body.md`。
- 已为 `apps/signal-trader` 补充本地 paper bootstrap：新增 docker-compose、permissive bootstrap app、启动脚本与 smoke 脚本。
- 已更新 `apps/signal-trader/README.md` 与 package scripts，补充本地 build / start / smoke / stop runbook。
- 已完成快速自检：shell 语法、Node 脚本语法、docker compose 配置校验均通过；targeted Rush build 通过。
- 已新增 `apps/signal-trader/GUIDE.md`，系统化说明 signal-trader 的职责边界、运行模式、启动方式、服务面、运维语义、副作用、SQL 建模与 GUI/外部系统集成。
- 已更新 `apps/signal-trader/README.md`，增加到详细指南 `GUIDE.md` 的入口链接。
- 已把 live capability 从“隐式 resolver”收口为显式 registry，并新增 `SignalTrader/ListLiveCapabilities` 作为 support matrix 只读服务。
- 已把 live 准入状态语义收口为：boot/preflight 失败进入 `stopped`；运行中安全异常进入 `audit_only`。
- 已把 capability admission 快照写入 `signal_trader_runtime_audit_log`，detail 包含 `phase`、`descriptor_hash`、`validator_result` 等结构化字段。
- 已把 operator 审计身份改为 `servicePolicy.resolveOperatorAuditContext(...)` 注入的受信主体，不再信任请求体自报 `operator`。
- 已完成最新验证：`apps/signal-trader` `npm run build` 通过，当前 26 tests 全通过。
- 已重新生成 `docs/review-rfc.md`、`docs/review-code.md`、`docs/review-security.md`、`docs/test-report.md`、`docs/report-walkthrough.md` 与 `docs/pr-body.md`，当前 RFC/code/security review 均为 PASS。
- 完成 signal-trader 前端控制台可行性调研：确认首版优先落在 `ui/web`，页面最小能力为发布 0/1/-1 信号、查看 runtime 状态、查看事件/审计信息。
- 已把 signal-trader 前端控制台细化到可直接开工的 MVP 方案：建议单页 `SignalTraderConsole`，分为 runtime 选择、状态卡、SubmitSignal、projection、event stream、audit log 6 个区块。
- 已补充本地 live OKX profile：`docker-compose.live-okx.yml`、`bootstrap-live-app.js`、`seed-live-runtime.js`、`run-local-live-stack.sh`、`env.live.example`。
- 已更新 `apps/signal-trader/README.md`、`apps/signal-trader/GUIDE.md` 与 package scripts，补充本地 live 运行方式与安全约束。
- 已完成脚本/compose 语法校验与 targeted build：`node --check`、`bash -n`、`docker compose config`、`rush build -t @yuants/app-host -t @yuants/app-postgres-storage -t @yuants/app-signal-trader -t @yuants/vendor-okx -t @yuants/tool-sql-migration`。
- 已做一轮代码/安全复核：code review 结论 PASS-WITH-NITS；security review 结论 PASS-WITH-NITS。
- 已完成 env-driven VEX live 路径的第二轮安全复审，并重写 `docs/review-security.md`；当前结论为 FAIL，阻塞点集中在 env 自报 capability 造成的 live admission 放宽、`register-vex-credential.js` 仍直接接触真实 secret、以及 local live 默认开放通用写入口但缺少写主体审计。
- 重新执行本次改动直接相关的语法/compose/targeted build 验证，并覆盖 `docs/test-report.md`。
- 额外执行 `apps/signal-trader` `npm run build`，确认新增 `bootstrap-from-env.test` 与现有 `signal-trader-app.test` 共 32 条测试通过。
- 已完成 `apps/signal-trader/**` 第三次安全/风控复审，并覆盖 `docs/review-security.md`；结论仍为 FAIL，唯一 blocker 为 live admission proof 未与后续真实 submit/cancel/query 路由强绑定。
- 已基于当前最新 `apps/signal-trader/**` 完成一轮 blocker-only 安全/风控复审，并覆盖 `docs/review-security.md`；本轮结论为 PASS，三项待确认 blocker 已清零。
- 已将 `apps/signal-trader/src/index.ts` 收口为 env-driven 默认入口，直接注入 VEX account-bound live 依赖；`bootstrap-live-app.js` 降级为兼容薄包装。
- 已新增 `apps/signal-trader/src/bootstrap-from-env.ts`，默认 live 语义改为 account-bound `SubmitOrder/CancelOrder/QueryPendingOrders/QueryAccountInfo` + SQL `"order"` 历史，并支持 `SIGNAL_TRADER_LIVE_BACKEND`。
- 已移除 live 对 `secret_ref` 的默认强制要求；默认 `resolveSecretRef` 仅返回 route/account context，不再在 app 内解析真实 credential。
- 已把 VEX account-bound route proof 固化到 runtime metadata，并让 capability 校验、submit/cancel/query 全链路只使用已验证的 `terminal_id/service_id`。
- 已将本地 live 栈改为 `virtual-exchange + okx-vex-exchange + okx-order-writer` 形态，并新增 `register-vex-credential.js` 完成本地 VEX 凭证注册。
- 已收紧本地 live 默认权限：不再默认开启通用写入口；`AUTO_UPSERT_RUNTIME=1` 仅在显式打开 mutating + trust-all 时才允许自动 seed。
- 已刷新 `README.md` / `GUIDE.md` / `env.live.example` / `seed-live-runtime.js` / package scripts，使文档与默认入口、VEX account-bound 语义一致。
- 已完成最终验证：Node 脚本语法、shell 语法、compose config、`rush build -t @yuants/app-signal-trader`、以及 `docs/review-code.md` / `docs/review-security.md` / `docs/test-report.md` 最新 PASS。
- 已按用户要求把 signal-trader 自身收进 `apps/signal-trader/dev/docker-compose.live-okx.yml`，不再由 `run-local-live-stack.sh` 在宿主机本地起 Node 进程。
- 已将 `run-local-live-stack.sh` 收口为纯 compose 驱动：先拉基础服务、跑 migration、注册 VEX 凭证，再通过 compose 启动 `signal-trader` 服务。
- 已更新 `README.md` 与 `GUIDE.md`，明确默认推荐直接启动 `app-signal-trader` 入口并注入 env，不再把“写薄宿主”作为默认建议。
- 已完成本轮校验：`bash -n apps/signal-trader/dev/run-local-live-stack.sh`、dummy env 下 `docker compose -f apps/signal-trader/dev/docker-compose.live-okx.yml config`、以及 targeted `rush build` 均通过。
- 已基于当前最新代码重新执行 live profile 相关语法检查、compose 展开与 targeted Rush build，并覆盖 docs/test-report.md；结论 PASS，确认默认交付已移除 okx-order-writer 软件依赖但仍保留 SQL "order" 证据链。
- 已按用户要求对 `apps/signal-trader/**` 做本轮安全/风控复审，并覆盖 `docs/review-security.md`。
- 已完成 `apps/signal-trader/**` 终版安全/风控复审，并覆盖写入 `docs/review-security.md`；结论仍为 FAIL。
- 已对当前最新 `apps/signal-trader/**` 做最终安全/风控复审，并覆盖写入 `docs/review-security.md`；结论为 FAIL，唯一 blocker 仍是 `ORDER_HISTORY_SOURCE_UNAVAILABLE` 在无 in-flight binding 时可从 `degraded` 自动恢复 `normal`，形成 silent data gap 风险。
- 已基于当前最新 `apps/signal-trader/**` 完成 blocker-only 安全/风控复审，并覆盖 `docs/review-security.md`；结论 PASS，确认 `ORDER_HISTORY_SOURCE_UNAVAILABLE` 已 fail-close，SQL `"order"` 外部前提表达清楚，当前无新增 blocker。
- 已清理废弃的 `apps/signal-trader/dev/bootstrap-live-app.js`；该脚本已不再被 compose、package scripts、启动脚本或当前文档使用。
- 已同步更新 `apps/signal-trader/README.md` 与 `apps/signal-trader/GUIDE.md`，删除对 `bootstrap-live-app.js` 的目录/兼容包装描述。
- 已通过引用回扫确认 `apps/signal-trader/**` 下不再存在 `bootstrap-live-app.js` 的残留引用。
- 已将 `apps/signal-trader/dev/docker-compose.live-okx.yml` 的基础镜像切到 `postgres:17-alpine` 与 `node:24-bookworm-slim`。
- 已将 `apps/signal-trader/dev/docker-compose.yml` 的 postgres 基础镜像切到 `postgres:17-alpine`。
- 已完成 compose 展开校验：live/paper 两个 compose 在新镜像版本下 `docker compose config` 均通过。
- 已对当前最新 `apps/signal-trader/**` 完成安全/风控复审并覆盖写入 `docs/review-security.md`；本轮结论为 FAIL，唯一 blocker 为 `GUIDE.md` 仍保留“默认入口不开匿名读/写”旧表述，与当前默认全开读/写/operator 的实现不一致，存在误导跨 Host 暴露的风险。
- 基于当前最新 `apps/signal-trader/**` 重新执行 `npm run build` 与 `node common/scripts/install-run-rush.js build -t @yuants/app-signal-trader`，并刷新 `docs/test-report.md`；确认默认入口不再读取旧的 `SIGNAL_TRADER_*` 启动 env，默认模型/路径已移除 `secret_ref`，当前 2 suites / 35 tests 全通过。
- 已对当前最新 `apps/signal-trader/**` 完成最终 blocker-only 代码复审，并覆盖写入 `docs/review-code.md`；结论 PASS，确认默认入口不再依赖旧的 `SIGNAL_TRADER_*` 启动 env、固定 live backend / service policy 已落实、`secret_ref` 已从默认路径与 runtime 模型移除且公开扩展点已统一为 `resolveLiveCredential`。
- 基于当前最新 `apps/signal-trader/**` 重新执行 `npm run build` 与 `node common/scripts/install-run-rush.js build -t @yuants/app-signal-trader`，并再次刷新 `docs/test-report.md`；确认默认入口不再依赖旧的 `SIGNAL_TRADER_*` 启动 env，live backend/service policy 已固定到代码常量，`secret_ref` 已从默认路径与模型中移除，当前 2 suites / 35 tests 全通过，Rush target build 通过但带 warning。
- 已将 `apps/signal-trader/src/bootstrap-from-env.ts` 收口为代码内固定默认值：默认入口不再读取旧的 `SIGNAL_TRADER_*` 权限/live backend/service-name 启动 env。
- 已将默认 service policy 改为同一 Host 内互信：读/写/operator 全开，operator 审计主体固定为 `host-internal-trusted`。
- 已将 live backend / evidence source / SQL `"order"` 表名 / account-bound 服务名全部写死在代码常量中，并从 `docker-compose.live-okx.yml` 与 `env.live.example` 中移除对应 signal-trader env。
- 已彻底移除 `secret_ref` 默认路径：`SignalTraderRuntimeConfig` 不再包含该字段，seed/runtime 默认只走 VEX account-bound；公开扩展点已从 `resolveSecretRef` 统一改为 `resolveLiveCredential`。
- 已补充回归测试：废弃 env 覆盖项会被忽略；当前 `apps/signal-trader` `npm run build` 通过，2 suites / 35 tests 全通过。
- 已完成最新复审：`docs/review-code.md`、`docs/review-security.md`、`docs/test-report.md` 已刷新，当前结论均为 PASS。
- 刷新 `.legion/tasks/app-signal-trader-live-integration/docs/test-report.md`，覆盖本轮 dummy live 测试链路验证结果。
- 已新增 `apps/signal-trader/dev/dummy-live-backend.js`：单进程模拟 `VEX/ListCredentials`、`SubmitOrder`、`CancelOrder`、`QueryPendingOrders`、`QueryAccountInfo`，并把 mutating 请求写入 `${DUMMY_LIVE_OUTPUT_DIR}/requests.ndjson`。
- 已新增 `apps/signal-trader/dev/docker-compose.live-dummy.yml` 与 `apps/signal-trader/dev/run-local-live-dummy-stack.sh`，形成一条不启动真实 VEX 的 dummy live 测试链路。
- 已为 dummy live 新增 package scripts：`dev:live:dummy:start|stop|status`。
- 已更新 README/GUIDE，说明 dummy live stack 只是测试桩，不是真实交易行为；同时强调 dummy backend 自己维护 SQL `"order"` 记录，因此不需要额外 writer。
- 已额外收口 dummy backend：SQL 写失败时也会把错误写入请求日志；未知 `order_id` 的撤单现在返回 `ORDER_NOT_FOUND`，不再静默成功。
- 已完成验证：`node --check apps/signal-trader/dev/dummy-live-backend.js`、`bash -n apps/signal-trader/dev/run-local-live-dummy-stack.sh`、`docker compose -f apps/signal-trader/dev/docker-compose.live-dummy.yml config`、以及 `apps/signal-trader` `npm run build`（2 suites / 35 tests 全通过）。
- 已将 dummy live 栈手工拉起到可访问状态：`signal-trader-dummy-host` / `signal-trader-dummy-postgres` / `signal-trader-dummy-postgres-storage` / `signal-trader-dummy-backend` / `signal-trader-dummy-signal-trader` 当前都在运行。
- 已确认 UI 应连接 dummy Host：`ws://127.0.0.1:8898`，并填写 `HOST_TOKEN=signal-trader-dummy`。
- 已通过 Host 请求确认：`SignalTrader/SubmitSignal` 服务实际存在；当前阻塞提交的主因不是服务缺失，而是 runtime `runtime-live` 处于 `stopped`。
- 已查询 audit log：`runtime-live` 在 upsert/boot 阶段 capability 校验通过，但随后因 `RECONCILIATION_MISMATCH` 被锁到 `audit_only`，再进一步停在 `LIVE_OBSERVER_PENDING_INITIAL_RECONCILIATION`。
- 已移除 `ui/web` SignalTraderConsole 的 health stale / non-normal / submit-service-visible 前置灰按钮门禁；提交按钮现在只在 terminal/runtime/加载/信号本身缺失时禁用。
- 已移除 `RuntimeWorker.submitSignal()` 的 health/domain-mode/reconciliation freshness 前置拒绝，trusted-host 下 live submit 直接放行到执行层。
- 已保留显式 `RUNTIME_DISABLED` 与 signal scope mismatch 这类非安全性、纯正确性门禁。
- 已重新构建 `apps/signal-trader`（2 suites / 35 tests 通过）与 `ui/web`（build 通过）。
- 已重启 dummy `signal-trader` 容器，并禁用旧的 `runtime-live`；当前可用 runtime `runtime-dummy-ok` health = normal。
- 已新增 `apps/signal-trader/doc/concepts-and-test-intent.md`，整理 signal-trader 的核心概念定义（signal / VC config / strategy profile / runtime / runtime_id / execution_mode / health / audit log）以及当前 35 个测试用例的设计意图。
- 已在 `apps/signal-trader/README.md` 与 `apps/signal-trader/GUIDE.md` 中补充该文档入口，方便从启动文档跳转到概念模型与测试说明。
- 已继续完善 `apps/signal-trader/doc/concepts-and-test-intent.md`，补充概念关系总览图、health 状态机 ASCII 图，以及 `signal -> command -> event -> effect -> execution -> observer -> checkpoint` 的时序图，避免后续再口头重复解释。

### 🟡 进行中

(暂无)

### ⚠️ 阻塞/待定

- 唯一 blocker 仍是外部 SQL `"order"` 证据源失联时，runtime 可在同一 observe 周期从 `degraded` 自动恢复 `normal`。

---

## 关键文件

- `apps/signal-trader/src/runtime/live-capability.ts`：capability registry / descriptor hash / audit detail 构造。
- `apps/signal-trader/src/runtime/runtime-worker.ts`：live boot preflight、运行中 fail-close、operator 审计写入。
- `apps/signal-trader/src/services/signal-trader-services.ts`：`ListLiveCapabilities` 注册与 operator audit context 注入。
- `apps/signal-trader/src/__tests__/signal-trader-app.test.ts`：26 条回归测试，覆盖 capability registry、stopped/audit_only、operator audit context、execution fail-close。
- `.legion/tasks/app-signal-trader-live-integration/docs/review-rfc.md`：当前 RFC 结论 PASS。
- `.legion/tasks/app-signal-trader-live-integration/docs/review-code.md`：当前代码评审结论 PASS。
- `.legion/tasks/app-signal-trader-live-integration/docs/review-security.md`：当前安全评审结论 PASS。

---

## 关键决策

| 决策                                                                                                                                                                                                                    | 原因                                                                                                                                                                                                                                                      | 替代方案                                                                                                                                                         | 日期       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 首版 live 白名单冻结为 `OKX/SWAP/* + okx_swap_sql_order_history`，其它 vendor 不进入本轮 live 支持矩阵。                                                                                                                | 仓库现状里只有 OKX order writer 这条 SQL order history 证据链足够明确；继续泛化会让 High risk 任务失去可验证边界。                                                                                                                                        | 继续把 `sql_order_history` 写成泛化能力，等实现时再挑 vendor；缺点是联调/验收范围漂移，review 已判定不可执行。                                                   | 2026-03-18 |
| 新增 append-only runtime audit log，用于记录 `backfill` / `unlock` 等人工接管与控制面动作，避免只把说明覆写进 `last_error`。                                                                                            | high-risk live host 需要不可变审计线索；review-security 指出当前人工接管动作缺少可追溯证据，无法支撑 fail-close runbook。                                                                                                                                 | 继续复用 binding.last_error / checkpoint.lock_reason 存说明；缺点是可被覆盖且无法表达操作前后值与操作者。                                                        | 2026-03-18 |
| live readiness 与 unlock 判定统一改为“当前 reconciliation 已 matched 且 freshness 仍在窗口内”，不再要求 snapshot id 本轮必须变化。                                                                                      | 静止账户可能长期复用同一 snapshot id；若把 snapshot id 变化当作必要条件，会把健康 runtime 错误卡在 audit_only。                                                                                                                                           | 继续要求新 snapshot id；缺点是重启或人工 unlock 后，healthy 但无仓位变化的账户可能长期无法恢复 normal。                                                          | 2026-03-18 |
| boot 成功恢复到 normal 后立即持久化 normal checkpoint，避免把启动阶段的临时 audit_only 健康态留在 checkpoint 中。                                                                                                       | 如果 boot 期间先为 reconcile gate 暂时切到 audit_only，但最终进入 normal 后不落盘，重启或读路径会读到过期健康态并误判。                                                                                                                                   | 继续沿用只在 observe 阶段落 checkpoint 的方式；缺点是 checkpoint 中的 health_status 可能落后于真实运行态。                                                       | 2026-03-18 |
| 本地 bootstrap 只用 docker-compose 承载 postgres，Host / Postgres Storage / SignalTrader bootstrap 仍由仓库内本地 Node 进程启动，日志与 pid 默认落到系统临时目录。                                                      | 这样可以在不增加镜像构建复杂度的前提下，快速复用仓库已有 lib/cli.js，并避免在仓库根目录制造本地调试脏文件。                                                                                                                                               | 把 Host、Postgres Storage、SignalTrader 也一并容器化；缺点是需要额外处理镜像构建、源码挂载、依赖安装与本地开发路径映射，摩擦更高。                               | 2026-03-19 |
| `app-signal-trader` 不再在 app 内部硬编码 `OKX/SWAP/* + okx_swap_sql_order_history` 白名单；live 支持矩阵改由 capability registry + `observer_backend` canonical key 与宿主注入观测链共同决定。                         | 用户明确要求取消硬编码 OKX 白名单；同时 High risk live host 仍需要可枚举、可校验、可审计的 support matrix。                                                                                                                                               | 保留 OKX 白名单，仅修改文档措辞；缺点是产品行为与用户要求不一致，且 app 仍把 vendor/product 策略硬编码到基础宿主层。                                             | 2026-03-19 |
| live 准入改为 capability descriptor 方案：`observer_backend` 是 canonical capability key，descriptor 缺失/不匹配/能力不足时必须在 boot 时 fail-close，并把校验结果写入 runtime audit log。                              | 取消 OKX 硬编码白名单后，仍需要一个显式、可校验、可审计的宿主能力契约，避免 live 支持矩阵退化成宿主内部的隐式实现细节。                                                                                                                                   | 仅依赖宿主注入 `liveVenue` / `observerProvider` 的口头约定；缺点是无法在设计、启动与事故复盘时证明某个 backend 为什么被允许进入 live。                           | 2026-03-19 |
| operator 审计身份必须来自受信认证上下文，而不是请求体自报 `operator`。                                                                                                                                                  | high-risk live host 的 backfill / unlock / disable 等人工接管动作需要不可抵赖的审计主体，否则 audit log 不能作为可信取证线索。                                                                                                                            | 继续接受请求体自报 `operator`；缺点是拥有 operator 权限的调用方可伪造他人身份，破坏审计可信度。                                                                  | 2026-03-19 |
| signal-trader 的首版人工控制台优先做进 `ui/web`，不先单独起一个新前端。                                                                                                                                                 | `ui/web` 已有 Host/Terminal 连接、页面注册、JSON Schema 表单、表格与 SQL 访问模式；而 `apps/signal-trader` 也已明确 GUI 只需调用 `SignalTrader/*` 服务即可接入。把首版页面放进现有 GUI 能显著减少重复造轮子与联调摩擦。                                   | 参考 `~/1earn` 单独起前端；优点是隔离部署与交互自由度更高，但首版会重复建设 Host 连接、服务调用、权限/调试链路，MVP 成本更高。                                   | 2026-03-19 |
| 本轮本地 live 脚手架采用“前端本地启动 + signal-trader live bootstrap 本地 Node 进程 + 其余依赖通过 docker compose 拉起”的形态；首个可复现 profile 收敛为 OKX account/order/order-history 侧车 + SQL `"order"` 历史。    | 用户已明确前端不需要镜像；而仓库内现成可复用的 live 证据链最完整的是 OKX 账户服务、订单动作服务与 `"order"` SQL sidecar。把 signal-trader bootstrap 保持为本地 Node 进程，能最小化 secret/servicePolicy 调试摩擦，同时仍用 compose 把其余依赖一次性拉齐。 | 把 signal-trader 本身也容器化；优点是更统一，缺点是需要额外处理本地源码挂载、环境注入与调试路径。继续只提供 paper 脚手架；缺点是无法满足用户当前 live 联调需求。 | 2026-03-20 |
| 本地 live bootstrap 改为 secure-by-default：要求显式 `HOST_TOKEN` 才允许启动；`AUTO_UPSERT_RUNTIME` 默认关闭；operator 服务默认关闭，只有显式开启时才要求并使用受信 `SIGNAL_TRADER_OPERATOR_PRINCIPAL`。                | 本地联调仍会接真实 OKX 凭证与 live 运行态；若默认无 token、默认自动 seed 或默认开放 operator，误下单/误解锁与审计归因不清的风险过高。把这些开关收紧后，仍保留一键启动能力，但避免把高危动作设为隐式默认。                                                 | 继续沿用 paper 脚手架的宽松默认值；优点是少配环境变量，缺点是会把 live 控制面的最小安全边界放空，不符合 fail-close 方向。                                        | 2026-03-20 |
| signal-trader 的默认 live 边界改为 VEX account-bound 服务：signal-trader 作为 VEX 上游，仅负责 signal/effect/runtime/fail-close；secret 与真实下单/撤单由 VEX 处理。                                                    | 用户明确要求 signal-trader 不是替代 VEX 的执行层，而是 VEX 的上游，因此 app 默认入口不应再围绕 direct-vendor secret resolver / live venue 设计。                                                                                                          | 继续保留当前 OKX local profile 作为默认 live；缺点是把 secret 解析与 vendor 执行职责错误地下沉到 signal-trader app。                                             | 2026-03-20 |
| 本地 live 联调形态进一步收口为“所有运行时服务都进 docker compose”，其中 signal-trader 也作为 compose 服务直接读取 env 启动；不再默认推荐额外写薄宿主。                                                                  | 用户明确要求 app-signal-trader 注入 env 后即可直接启动，并要求 signal-trader 也进入 docker compose；这比“本机 Node + compose 混合启动”更贴近产品化交付与用户预期。                                                                                        | 继续保留 signal-trader 在宿主机本地启动，或在文档中推荐用户自行写薄宿主；缺点是仍把核心启动路径分散在脚本/额外装配层，违背用户目标。                             | 2026-03-20 |
| signal-trader 默认 live 继续依赖 SQL `"order"` 表作为 closed order history 证据源，但不再在默认 compose/runbook 中捆绑 `okx-order-writer` 进程；该表的数据生产责任下沉到 VEX/叶子节点或外部基础设施。                   | 用户接受 SQL order history 数据契约，但拒绝 signal-trader 从软件交付层面绑定特定 writer 组件。                                                                                                                                                            | 移除 SQL order history 依赖并仅靠 open orders/account snapshot；缺点是会改变既有观察与 fail-close 语义，并削弱终态证据链。                                       | 2026-03-20 |
| 移除默认 bundled writer 后，`supports_closed_order_history=true` 的 live backend 一旦失去 SQL `"order"` 证据源，不应在同一 observe 周期自动恢复为 `normal`。                                                            | 否则外部证据链缺口会被健康态覆盖，违背 secure-by-default 与 fail-close。                                                                                                                                                                                  | 继续仅记录瞬时 degraded 并在当轮恢复 normal；缺点是监控面可能观察不到 evidence source outage，直到更晚才因缺少终态证据锁死。                                     | 2026-03-20 |
| 外部 SQL `"order"` evidence source 一旦不可用，signal-trader 直接 fail-close，而不是先 degraded 后尝试自动恢复。                                                                                                        | 在默认 bundled writer 已移除的前提下，`"order"` 成为更显式的外部终态证据前提；若 source outage 仅记为瞬时 degraded，监控面可能看不到 evidence gap，形成 silent data gap。直接 fail-close 更符合 secure-by-default 与审计完整性。                          | 仅保持 degraded 并等待 source 恢复后自动回 normal；缺点是 outage 窗口内的终态缺口可能被静默吞掉，安全复审判定为 blocker。                                        | 2026-03-20 |
| signal-trader 默认假设同一 Host 内服务彼此可信：控制面默认开启读/写/operator，且不再通过 env 开关控制权限。                                                                                                             | 用户明确要求把 `SIGNAL_TRADER_ALLOW_ANONYMOUS_READ`、`SIGNAL_TRADER_ENABLE_MUTATING_SERVICES`、`SIGNAL_TRADER_ENABLE_OPERATOR_SERVICES`、`SIGNAL_TRADER_TRUST_ALL_REQUESTS`、`SIGNAL_TRADER_OPERATOR_PRINCIPAL` 全部移除，并以 Host 内互信作为架构前提。  | 继续保留 secure-by-default 的权限 env 开关；缺点是与用户当前架构假设冲突。                                                                                       | 2026-03-20 |
| app-signal-trader 默认入口明确采用“同一 Host 内服务互信”模型：权限相关 env 删除，默认 service policy 固定全开；若需要跨 Host/共享环境权限收口，必须改为手工嵌入 `createSignalTraderApp(...)` 并自定义 `servicePolicy`。 | 用户明确要求 Host 内服务互信，并要求移除所有 signal-trader 权限 env 开关；继续保留 env 只会让默认入口与架构假设不一致。                                                                                                                                   | 继续保留 allowAnonymousRead/enableMutatingServices/trustAllRequests 等 env 开关；缺点是默认路径仍暴露两套相互冲突的权限模型。                                    | 2026-03-21 |
| app-signal-trader 默认路径彻底放弃 secret-centered 接口语义：删除 `secret_ref` runtime 字段与兼容 env，并将公开扩展点改名为 `resolveLiveCredential`。                                                                   | 用户明确要求不要为新应用保留 `secret_ref` 兼容；继续沿用 `resolveSecretRef` / `secret_ref` 只会在类型、存储与文档层残留过时心智。                                                                                                                         | 仅删除 env，但保留 `secret_ref` 类型字段和 `resolveSecretRef` 命名；缺点是 code review 已判定为 blocker，且会继续误导接入方。                                    | 2026-03-21 |
| 新增一个不依赖 VEX 的测试 live compose：由 dummy terminal 直接暴露 account-bound Submit/Cancel/Pending/Account 服务，并把请求落文件，供 signal-trader 做接口联调。                                                      | 用户需要一个不启动 VEX、只验证 signal-trader 下单/观测接口与文件落单行为的测试栈。                                                                                                                                                                        | 继续复用 VEX/OKX 测试栈；缺点是链路过重，且无法直接观察 signal-trader 发出的底层请求载荷。                                                                       | 2026-03-21 |
| 新增一条不启动 VEX 的 dummy live 测试链路：由单个 dummy backend 直接暴露 `VEX/ListCredentials`、`SubmitOrder`、`CancelOrder`、`QueryPendingOrders`、`QueryAccountInfo`，并把请求写入文件。                              | 用户需要一个不依赖真实 VEX 的测试 compose，但当前 signal-trader 默认 backend 仍要求 account-bound 服务与 VEX identity marker；最小实现是用 dummy backend 在同一进程里同时模拟这些接口。                                                                   | 修改 signal-trader 默认 backend 让其完全不要求 `VEX/ListCredentials`；缺点是会改变当前默认 live 契约与 route proof 逻辑，超出本次测试脚手架范围。                | 2026-03-21 |
| 在当前 trusted-host 架构下，signal-trader 的 live submit 路径应尽量去掉健康/审计型前置门禁：默认允许提交，由下游执行与观测负责发现问题，而不是在 UI/submit 前就因为 stale/non-normal health 拦截。                      | 用户明确要求整个环境都在可信环境内，不希望 signal-trader 继续保留大量 fail-close / 安全门禁导致 UI 灰按钮与 live 提交被拦。                                                                                                                               | 继续保留 health stale / non-normal / reconciliation mismatch 等前置限制；缺点是与当前“同一 Host 内服务互信”目标冲突，且直接影响联调与人工操作体验。              | 2026-03-21 |

---

## 快速交接

**下次继续从这里开始：**

1. 如需更强验证，可由 engineer/orchestrator 实际启动 `bash apps/signal-trader/dev/run-local-live-dummy-stack.sh start` 做端到端 smoke。

**注意事项：**

- 本轮未修改业务代码，只刷新测试报告。
- 本轮关键结果：4 条指定命令全部 PASS；`npm run build` 为 2 suites / 35 tests passed。

---

_最后更新: 2026-03-22 00:44 by Claude_
�：\*\*

1. 如需继续收口风险，可把 `ORDER_HISTORY_SOURCE_UNAVAILABLE` 单独接入外部监控/告警。
2. 如需防回归，可补一条跨 observe 周期的 order-history outage 恢复测试。

**注意事项：**

- 本轮未修改业务代码，只更新了 `.legion/tasks/app-signal-trader-live-integration/docs/review-security.md`。
- 当前 review 依据来自 `runtime-worker.ts`、`signal-trader-app.test.ts`、`README.md`、`GUIDE.md` 与 `docker-compose.live-okx.yml`。

---

_最后更新: 2026-03-20 17:17 by Claude_
