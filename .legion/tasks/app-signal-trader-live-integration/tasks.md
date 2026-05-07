# app-signal-trader-live-integration - 任务清单

## 快速恢复

**当前阶段**: 阶段 3 - 验证与交付
**当前任务**: (none)
**进度**: 7/7 任务完成

---

## 阶段 1: 调研与设计 ✅ COMPLETE

- [x] 盘点现有 app 宿主模式（如 trade-copier / virtual-exchange / node-unit）与 `@yuants/signal-trader` 的集成缺口，明确新 app 的运行边界、Terminal 服务面、mock/live 模式与安全约束。 | 验收: `plan.md`/RFC 里明确 app 架构、运行模式、外部依赖、风险与回滚策略。
- [x] 设计事件持久化与回放方案（SQL 表、append/query/replay）、命令入口（upsert_subscription / submit_signal / apply_execution_report / capture_authorized_account_snapshot）以及 execution adapter（mock/live）。 | 验收: RFC 给出数据流、表结构/索引、服务契约、执行链路和故障处理策略。

---

## 阶段 2: 实现宿主 app ✅ COMPLETE

- [x] 创建新的 Rush project `apps/signal-trader`，接入 package/config/build，集成 `@yuants/signal-trader` 并实现宿主编排层。 | 验收: 新 app 可被 monorepo 构建并启动，能够加载历史事件、接受命令并维护状态快照。
- [x] 实现 mock/paper 与 live execution 适配：paper 可本地演示与测试，live 可通过现有 Terminal/vendor 生态实际下单，并把 execution report 回灌 event stream。 | 验收: 存在明确的 mock/live 运行路径；缺少授权或关键配置时 fail-close；最小 happy path 可跑通。
- [x] 按需补齐 SQL migration / schema 与运行配置，确保事件存储、查询与重放闭环成立。 | 验收: 迁移文件与 app 使用的读写逻辑一致；重启后可从事件流恢复状态。

---

## 阶段 3: 验证与交付 🟡 IN PROGRESS

- [x] 补充单测/集成验证/最小 smoke 用例，覆盖 replay、一条信号闭环、mock execution、live adapter 安全校验。 | 验收: 生成可复现验证步骤；相关 build/test 通过。
- [x] 产出运行文档：本地 mock/paper 启动方式、live 配置方式、风控注意事项、部署/Node Unit 接入说明。 | 验收: 开发者可按文档完成本地演示与实盘接入，且已知风险/限制被明确记录。

---

## 发现的新任务

- [x] 收紧 `SignalTrader/*` 控制面：默认高危写服务需要显式授权；`backfill/unlock` 仅允许受限状态转换并记录审计事件/说明。 | 来源: `docs/review-security.md` blocking findings
- [x] 补充 `apps/signal-trader` 本地 paper bootstrap：提供 docker-compose、启动脚本、smoke 脚本与 README runbook，降低手工联调成本。 | 来源: 用户要求“我要一个本地 bootstrap 的 docker-compose 和脚本吧”
- [x] 补充 `apps/signal-trader` 详细指南文档：覆盖启动方式、使用流程、运维语义、副作用、SQL 建模与 GUI/外部系统集成。 | 来源: 用户要求补齐 signal-trader 使用/运维/数据建模/GUI 集成文档
- [x] 取消 `app-signal-trader` 对 `OKX/SWAP/* + okx_swap_sql_order_history` 的硬编码白名单，改为通用 live 宿主：由 capability registry + `observer_backend` canonical key 决定 support matrix，并同步收敛文档、测试、审计与服务面。 | 来源: 用户要求“不要白名单，不要只支持 OKX 相关的，修改一下”
- [x] 将默认 live 启动收口为基于 VEX account-bound 服务的 env 驱动入口，移除 app 直接解析 secret / 直连 vendor 的假设。 | 来源: 用户澄清“signal-trader 是 VEX 上游；secret 和实际下单由 VEX 处理” + .opencode/plans/1773751421023-tidy-meadow.md
- [x] 保留 SQL order 表依赖但移除 signal-trader 默认交付中的 okx-order-writer 软件依赖，并将其表数据生产责任下沉到 VEX/叶子节点。 | 来源: /Users/c1/Work/signal-trader/.opencode/plans/1773751421023-tidy-meadow.md + 用户明确要求“依赖 order sql 表就行，但不要从软件层面依赖一个 writer”
- [x] 移除 signal-trader 的权限/env 开关与 secret_ref 兼容 env；将 live backend/service policy 全部收口为代码内默认常量。 | 来源: 用户明确要求 host 内服务互信、live backend 配置写死代码、删除 secret_ref 兼容 env。
- [ ] 新增无 VEX 的 dummy live compose：用文件落单脚本模拟 account-bound 服务接口供 signal-trader 联调。 | 来源: 用户要求“另一个测试 docker compose，背后不启动 vex，而是把下单等请求直接写文件”
- [ ] 新增 dummy live compose：不启动 VEX，改由 dummy backend 模拟 account-bound 服务并把请求写文件。 | 来源: 用户要求“另一个测试 docker compose，背后不启动 vex，而是把下单等请求直接写文件”
- [x] 移除 trusted-host 下 signal-trader 前端与后端 live submit 的健康/审计门禁，减少灰按钮与 fail-close 前置拦截。 | 来源: 用户明确要求“把无用的安全考虑能拆的都拆了”，当前症状为 live submit 按钮持续灰色 ← CURRENT

---

_最后更新: 2026-03-22 00:09_
