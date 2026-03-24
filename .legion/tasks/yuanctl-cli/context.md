# yuanctl 全量能力统一 CLI 设计与实现 - 上下文

## 会话进展 (2026-03-23)

### ✅ 已完成

- 已生成 `.legion/tasks/yuanctl-cli/docs/rfc.md`，完成统一 CLI 平台第一版可评审 RFC，明确 current-state、骨架 + 注册架构与第一阶段 Scope。
- 已完成对 `.legion/tasks/yuanctl-cli/docs/rfc.md` 的对抗式 RFC 审查，并生成 `.legion/tasks/yuanctl-cli/docs/review-rfc.md`；审查结论为 FAIL。
- 已按 `docs/review-rfc.md` blocking issues 直接重写 `.legion/tasks/yuanctl-cli/docs/rfc.md`，将一期硬收敛为 `deploy + config + static registry`。
- 已在 RFC 中新增资源/命令边界表、capability class gating、重排后的 Phase 0/1/2/3，以及第一阶段仅 `table/json` 输出承诺。
- 已同步更新 `plan.md` 与 `tasks.md`，使设计索引、阶段范围与 RFC 收敛版保持一致。
- 已重新审查 `.legion/tasks/yuanctl-cli/docs/rfc.md`，重点复核上一轮 blocking issues 的收敛情况；结论更新为 PASS WITH CHANGES。
- 已按 residual issues 对 RFC 做最小修订：将 future `service call` requirement 标记为 Future-only/非 Phase 1 验收，并补充 Phase 2/3 进入前需新增 amendment 或 implementation plan。
- 已完成最终一轮 RFC 对抗审查，并覆盖写入 `.legion/tasks/yuanctl-cli/docs/review-rfc.md`；结论为 PASS，确认当前 RFC 满足设计门禁中的“RFC 对抗审查 PASS”。
- 已根据用户新增最高优先级约束修订 RFC：yuanctl 视为全新 CLI，移除 legacy compat、迁移旧 verbs-resource、sunset policy 与对外兼容承诺。
- 已重新审查 `.legion/tasks/yuanctl-cli/docs/rfc.md`，聚焦“彻底去除兼容性思维、第一阶段是否足够收敛且大胆、是否仍可实现可验证”；新审查报告已覆盖写入 `docs/review-rfc.md`，结论为 FAIL。
- 已再次审查 `.legion/tasks/yuanctl-cli/docs/rfc.md`，确认设计文本已彻底切换为纯新 CLI 协议叙事；审查报告已覆盖写入 `.legion/tasks/yuanctl-cli/docs/review-rfc.md`，结论为 PASS，并确认“已满足无兼容性设计约束”。
- 用户已批准当前“无兼容性设计”RFC，可进入实现阶段。
- 已在 `tools/yuanctl/**` 内完成 Phase 1 CLI 骨架重构：移除 root 入口中的旧 verbs 注册，改为静态 `deploy/config` registry + 统一 runtime/output/error/safety。
- 已新增 `tools/yuanctl/src/namespaces/deploy` 与 `tools/yuanctl/src/namespaces/config`，接入 `deploy list|inspect|enable|disable|restart|delete|logs` 与 `config init|current|get-contexts|use-context|set-host|set-context`。
- 已重写 `tools/yuanctl/src/cli/__tests__/cli-commands.test.ts`，覆盖 registry/解析、deploy list、config init/current 与 destructive confirmation gate。
- 已完成对当前工作区 `tools/yuanctl/**` Phase 1 新命令树改动的安全/误操作审查，重点覆盖配置写入、确认门禁、日志读取与错误输出。
- 已用 docker compose 启动 e2e 环境：TimescaleDB pg17 + node-unit（node-unit 需通过 `DOCKER_DEFAULT_PLATFORM=linux/amd64` 启动）。
- 已完成一轮手工端到端验证：`config current/get-contexts/set-host/set-context/use-context`、`deploy list/inspect/enable/disable/restart/delete` 在容器环境中可执行。

### 🟡 进行中

- 开始按 RFC 在 `tools/yuanctl/**` 内实现 Phase 1 最小骨架；拟改 `src/cli/index.ts`、新增 `static-registry/runtime-context/output/error/safety`、新增 `namespaces/deploy` 与 `namespaces/config`，并重写旧 CLI 测试为新命令树覆盖。

### ⚠️ 阻塞/待定

- `deploy logs` 在已启动的 e2e 环境中仍返回 `E_INTERNAL`，说明 Phase 1 的日志路径存在运行时问题；当前手工 E2E 结果为部分通过。

---

## 关键文件

- `.legion/tasks/yuanctl-cli/docs/rfc.md`：统一 CLI 平台设计真源，定义规范条款 R1-R23、命令树、注册协议与阶段计划。
- `tools/yuanctl/src/cli/index.ts`：当前固定命令注册入口，是“非平台化”的主要现状证据。
- `tools/yuanctl/src/cli/resource.ts`：当前资源硬编码入口，是重构为 `deploy` namespace 内部实现的主要现状证据。
- `apps/host/src/host-manager.ts`：Host 控制面能力来源，支撑 terminal/service/host namespace。
- `apps/node-unit/src/index.ts`：node/deploy logs/resource-usage 能力来源。

---

## 关键决策

| 决策                                                                                                                                                | 原因                                                                                                                                                                                                            | 替代方案                                                                                                                         | 日期       |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 第一阶段统一 CLI 应优先围绕 Deployment/Terminal/SQL/Product/Service Discovery 等低凭证、强脚本化能力展开，而非直接覆盖交易/风控/AI 等高风险域。     | 这些能力已具备较稳定的 Terminal/SQL/Service 接口和明确 UI 对照，接入成本低、价值高，且更适合做统一 CLI 骨架验证。                                                                                               | 也可从交易/转账/跟单域切入，但会立即引入 TypedCredential、资金风险、跨 vendor 语义不一致等复杂度。                               | 2026-03-23 |
| 第一阶段实现 Scope 收敛到 `tools/yuanctl` 核心骨架，以及 `apps/host`/`apps/node-unit`/基础 protocol&sql 能力；UI/Web 相关目录仅作为行为对齐参考。   | 先完成统一 CLI 骨架与通用基础命令面，避免一开始就进入交易/资金/AI 等高风险域，降低设计与实现复杂度。                                                                                                            | 另一种做法是直接让各业务 app 全面接入 yuanctl，但这会在第一阶段引入大量 credential、安全与跨域语义一致性问题。                   | 2026-03-23 |
| 统一 CLI 平台采用“骨架 + 注册”而不是继续在 `tools/yuanctl` 中集中硬编码所有业务命令。                                                               | 当前 `index.ts` 与 `resource.ts` 已体现硬编码扩展瓶颈；平台层应沉淀统一上下文、输出、错误与安全协议，业务能力应靠近来源包注册。                                                                                 | 可继续沿用 verbs/resource 或集中硬编码，但长期会造成命令树膨胀、领域耦合和测试困难。                                             | 2026-03-23 |
| yuanctl 按全新 CLI 平台设计，旧 `verb/resource` 语法不进入新协议，也不提供对外兼容入口。                                                            | 用户已明确禁止任何向后兼容考量；继续保留旧入口会直接违背设计前提，并污染第一阶段收敛目标。                                                                                                                      | 也可通过兼容层渐进替换旧命令，但该方案已被用户明确否决。                                                                         | 2026-03-23 |
| RFC 当前版本不得直接进入实现阶段。                                                                                                                  | 对抗审查发现阻塞项：第一阶段静态注册约束不够硬、`service call` 安全边界不足、`host`/`node logs`/`deploy logs` 资源边界未收敛、Phase 0/1/2 切分偏宽，尚未满足可实现/可验证/可回滚。                              | 继续按现 RFC 实现会把未来扩展和一期验证混在一起，放大设计与安全复杂度。                                                          | 2026-03-23 |
| RFC 修订版将第一阶段硬收敛为“静态 TypeScript 注册 + deploy/config 最小骨架”，并把 manifest/discovery/external plugin 明确降为非目标。               | 对抗审查指出注册协议为未来扩展预留过多，会放大一期复杂度并削弱可回滚性；静态编译期汇总最简单、最可测、替换成本最低。                                                                                            | 保留 manifest/discovery/external plugin 作为一期接口承诺，但这会让 registry 过早平台化，增加扫描/加载/冲突处理的实现与测试负担。 | 2026-03-23 |
| `service call` 从第一阶段移出，只在 RFC Future Direction 中保留受限扩展说明；第一阶段 `service` 仅保留 `list/inspect`。                             | 通用 service call 接近远程 RPC 调试口，风险高于普通 write；在 capability class、安全确认、allowlist、参数 schema 没有闭环前，不应进入一期承诺。                                                                 | 一期保留 `service call`，但需强制 service+method allowlist、JSON-only 输入、额外确认门禁与更高风险等级；当前不利于尽快收敛。     | 2026-03-23 |
| 安全模型从 destructive-only 调整为 capability class gating，至少固定为 `read-safe`、`read-sensitive`、`write`、`destructive`、`remote-proxy` 五类。 | 对抗审查指出日志、代理、敏感读取并非 destructive 但同样高风险；固定能力类别比仅靠 `--yes` 更能覆盖泄露、SSRF、资源耗尽等风险。                                                                                  | 继续使用 destructive/high-risk 二元模型，但会遗漏高危读取与代理型通道。                                                          | 2026-03-23 |
| 修订后的 RFC 已基本满足可实现、可验证、可回滚要求；上一轮 blocking issues 已充分收敛，因此本轮审查不再阻塞进入设计确认。                            | Phase 0/1 已明确限定为静态 TypeScript 注册；`service call` 已移出第一阶段；资源/命令边界表与 capability class gating 已足以支撑第一阶段；阶段切分已改为保守 rollout。                                           | 若继续要求在 RFC 内量化所有 future phase 细节，会再次把第一阶段设计膨胀为未来平台承诺，反而削弱当前收敛。                        | 2026-03-23 |
| 为消除残余争议，RFC 全面删除 compat、sunset、旧命令迁移表述，只保留“代码重构替换现有实现”的内部工程策略。                                           | 用户已将“禁止兼容性设计”设为最高优先级；继续保留任何 legacy 话术都会让 RFC 不可批准。                                                                                                                           | 也可保留内部兼容过渡说明，但仍会混淆对外协议边界，因此一并删除。                                                                 | 2026-03-23 |
| 最终一轮修订后，RFC 的第一阶段定义为全新命令树下的最小骨架，不再把旧 deployment CLI 视为产品主路径。                                                | 这使设计边界与用户要求一致：一期目标是快速建立新平台骨架，而不是维护过渡双轨。                                                                                                                                  | 若仍把旧 CLI 视为主路径，会继续把设计重心拉回兼容与迁移。                                                                        | 2026-03-23 |
| 当前 RFC 的实现边界已基本收敛，但文案层面仍残留 compatibility framing，因此不能判定为完全满足“无兼容性设计约束”。                                   | 用户最新硬要求禁止任何兼容性考虑出现；RFC 虽否定 legacy/compat 行为，但仍保留 `Backward Compatibility`/`兼容策略` 等章节与术语，说明设计叙事尚未彻底切换为纯新 CLI 协议。                                       | 若用户只要求“不提供兼容实现”，则可判为 PASS WITH CHANGES；但按当前更严格约束，必须先清除这些 framing。                           | 2026-03-23 |
| 当前 RFC 已满足“无兼容性设计约束”，可视为纯新 CLI 协议叙事版本。                                                                                    | 复核未发现 `backward compatibility`、`legacy`、`compat`、`sunset`、`旧命令映射`、`兼容` 等词汇，也未发现双轨入口、迁移层、兼容章节等等价组织方式；旧实现仅被描述为内部重构输入，不再构成对外协议 framing。      | 若仍将“代码替换现有实现”视为兼容性 framing，则需要进一步删除现状/替换措辞；本轮审查认为这属于内部工程边界，不属于对外兼容设计。  | 2026-03-23 |
| 设计门禁已通过，按全新 CLI 的 Phase 1 最小骨架进入实现。                                                                                            | 用户已明确批准当前 RFC，且该 RFC 已通过无兼容性约束下的对抗审查 PASS。                                                                                                                                          | 继续停留在设计阶段，但这与用户“批准，实现”指令冲突。                                                                             | 2026-03-23 |
| Phase 1 CLI 入口直接切换为自管静态 registry + 轻量解析器，不继续沿用 Clipanion verb class 树。                                                      | RFC 明确要求新平台只保留 `namespace/subcommand` 唯一命令模型，并引入统一 runtime/output/error/safety；直接在 `src/cli/index.ts` 做静态装配和单一路径分发最朴素、最容易验证，也能彻底切断旧 verb/resource 入口。 | 继续用 Clipanion 包装一层新命令树也可实现，但会保留大量旧命令类结构与 help 习惯，增加过渡复杂度，不利于第一阶段做干净替换。      | 2026-03-23 |
| e2e 环境采用 docker compose + 手工命令验证，而未复用旧 `run-yuanctl-e2e.js`。                                                                       | 现有 e2e 脚本仍基于已废弃的旧命令模型（`get/describe/config-init` 等），不适用于当前全新 namespace/subcommand CLI。                                                                                             | 先重写 e2e 脚本再执行，但用户当前要求是先启动环境并执行端到端测试，因此优先用手工命令直接验证新命令树。                          | 2026-03-23 |

---

## 快速交接

**下次继续从这里开始：**

1. 若继续提高交付可信度，先修复 `tools/yuanctl` 历史测试脚本与 workspace TypeScript 解析问题，再重跑 package 级测试。
2. 若进入下一阶段，再按 RFC 的 amendment / implementation plan 扩展 `terminal` 与 `host` namespace。

**注意事项：**

- 产物路径：RFC=`.legion/tasks/yuanctl-cli/docs/rfc.md`，代码审查=`.legion/tasks/yuanctl-cli/docs/review-code.md`，安全审查=`.legion/tasks/yuanctl-cli/docs/review-security.md`，测试报告=`.legion/tasks/yuanctl-cli/docs/test-report.md`，walkthrough=`.legion/tasks/yuanctl-cli/docs/report-walkthrough.md`，PR body=`.legion/tasks/yuanctl-cli/docs/pr-body.md`。
- 当前对外协议已切换为纯新 CLI；未实现任何旧命令兼容层。

---

_最后更新: 2026-03-23 22:14 by Claude_
� 先保证 E2E 稳定可运行，再视需要继续下沉治理。 | 2026-03-23 |

---

## 快速交接

**下次继续从这里开始：**

1. 若继续提高交付可信度，先修复 `tools/yuanctl` 历史测试脚本与 workspace TypeScript 解析问题，再重跑 package 级测试。
2. 若进入下一阶段，再按 RFC 的 amendment / implementation plan 扩展 `terminal` 与 `host` namespace。

**注意事项：**

- 产物路径：RFC=`.legion/tasks/yuanctl-cli/docs/rfc.md`，代码审查=`.legion/tasks/yuanctl-cli/docs/review-code.md`，安全审查=`.legion/tasks/yuanctl-cli/docs/review-security.md`，测试报告=`.legion/tasks/yuanctl-cli/docs/test-report.md`，walkthrough=`.legion/tasks/yuanctl-cli/docs/report-walkthrough.md`，PR body=`.legion/tasks/yuanctl-cli/docs/pr-body.md`。
- 当前对外协议已切换为纯新 CLI；未实现任何旧命令兼容层。

---

_最后更新: 2026-03-23 22:14 by Claude_
