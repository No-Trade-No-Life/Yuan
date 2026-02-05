# vendor-tokenbucket-proxy-ip - 上下文

## 会话进展 (2026-02-04)

### ✅ 已完成

- 生成 RFC：`.legion/tasks/vendor-tokenbucket-proxy-ip/docs/rfc.md`。
- RFC 对抗审查报告已落盘至 `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-rfc.md`。
- RFC 已按审查意见更新：采用 `encodePath([BaseKey, ip])`、补充 proxy ip fallback、直连同样引入 public_ip 维度、回滚改为版本回退、增加日志限频与可观测要求。
- 已响应 RFC review：明确 `req.labels.ip` 已指定时直接使用该 ip 并保持 labels 发送请求，避免重复 resolve。
- 已根据 review 增补 RFC：引入 Label-Pinned Proxy IP 概念，明确 labels.ip 已指定时不再 resolve，并在设计/计划中区分两条路径。
- 更新 RFC 对抗审查要点，聚焦 labels.ip 绑定出口一致性与风险。
- 输出更新后的 RFC 对抗审查报告正文，聚焦 labels.ip 验证路径、一致性契约、错误语义与可验证性。
- 已按最新对抗审查补充 RFC：新增 labels.ip 验证顺序与错误码（E_PROXY_IP_INVALID/NOT_AVAILABLE），定义多 target 同 IP 的确定性选择规则，并补齐 Testability/Observability。
- 完成二次对抗审查，结论聚焦 labels.ip 校验顺序可执行性、确定性 target 选择闭环、错误语义映射与可验证性。
- 已根据最新审查意见更新 RFC：labels.ip 仅允许 helper 写入；校验顺序明确为格式/来源/匹配；labels.ip 路径强制 target-aware fetch；补充错误语义映射与校验阶段观测。
- 完成 RFC 再次对抗审查，重点检查 labels.ip 可信来源绑定与错误语义闭环。
- 已在 RFC 中定义 ProxyTarget Binding 作为可信来源信号，并将 labels.ip 的可用性绑定到 target-aware fetch 路径。
- 完成 RFC 对抗审查并输出报告正文（未能写入 review-rfc.md，受工具限制）。
- RFC 已改为使用 `proxy_ip_hint` + `ProxyTargetBinding` 选择/固定目标，不再接受外部 labels.ip；补充 binding 数据模型与接口定义。
- 完成对最新 RFC 的对抗审查，聚焦 proxy_ip_hint_source/internal、hint 无 fallback、错误语义与 testability 闭环。
- 审查报告正文已输出到会话，但因工具限制未能写入 `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-rfc.md`。
- 已明确 Proxy IP Fallback 仅适用于无 hint 分支，并补充 hint 分支缺失 tags.ip 的错误语义。
- 完成对最新 RFC 的对抗审查，聚焦 proxy_ip_hint 无 fallback、错误语义映射与 testability 闭环。
- RFC 已同步修正：R4 明确 fallback 仅无 hint 分支；确定性选择改为 terminal_id+service_id；修复 Testability/Review 响应中的 labels.ip 术语。
- 完成对最新 RFC 的对抗审查，重点检查 proxy_ip_hint 分支无 fallback、错误语义映射与 Testability 闭环，并输出审查报告正文。
- RFC 已补齐 hint 分支无 fallback 的数据模型/兼容策略，并修正 Testability（terminal_id+service_id、hint 分支禁用 fallback）。
- 完成对最新 RFC 的对抗审查，核对 hint 分支无 fallback 与错误映射闭环；发现 ProxyTargetBinding 约束与 Testability R4 断言不一致，仍需修订。
- RFC 已修正 ProxyTargetBinding 分支约束，并补齐 Testability 的 R4 fallback 断言。
- RFC 已补齐 hint 分支 binding 与 proxy_ip_hint 一致性要求，并在 Testability 增加对应断言。
- 完成最新 RFC 对抗审查（聚焦 hint 分支 binding 一致性闭环），审查报告正文已输出。
- RFC 已补齐 hint 分支候选过滤步骤与 binding mismatch 错误语义，并补充负例断言/观测项。
- 完成对最新 RFC 的对抗审查，聚焦 hint 分支过滤/绑定、错误语义映射与 Testability 闭环；已在回复中输出审查报告正文（未写入文件，工具限制）。
- RFC 已补齐无服务/无匹配的错误语义区分，并将候选枚举与确定性选择收敛为 resolveHTTPProxyTarget 合约。
- 完成最新 RFC 对抗审查并输出报告正文，结论聚焦错误语义区分与 resolveHTTPProxyTarget 合约闭环；受工具权限限制未写入 review-rfc.md。
- RFC 已收敛 resolveHTTPProxyTarget 合约（返回 ok/error_code）并将校验/枚举/过滤职责内聚到该函数。
- 完成最新 RFC 对抗审查，聚焦 resolveHTTPProxyTarget 合约与错误模型闭环。
- RFC 已删除随机 resolve 引用，明确候选枚举使用 resolveTargetServicesSync，并收敛 resolveHTTPProxyTarget 的 error_code 联合类型。
- 完成最新 RFC 对抗审查，聚焦候选枚举来源与 error_code 联合类型闭环，并已写入 `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-rfc.md`。
- RFC 已补充 resolveHTTPProxyTarget 的错误码归属表，封闭 error_code 边界与阶段归属。
- 完成最新 RFC 对抗审查（候选枚举 MUST 与错误码归属表闭环），结论: `E_PUBLIC_IP_MISSING` 归属未闭环，仍有阻塞，报告已写入 `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-rfc.md`。
- RFC 已移除 E_PUBLIC_IP_MISSING 作为返回错误码，改为直连场景日志/指标处理。
- RFC 对抗审查已完成并确认无阻塞，报告写入 `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-rfc.md`。
- 已按 review 调整 RFC：取消新增 fetchViaHTTPProxyTarget，改为扩展现有 fetch 支持 proxy_ip_hint，并由 fetch 内部固定 target；labels.ip 仅用于观测。
- 按新增 review 调整 RFC：同 IP 多 proxy 允许随机路由，移除确定性选择要求。
- 已在 RFC 中响应“proxy_ip_hint 为什么需要”的 review，并解释其作为 labels.ip 路由提示的角色。
- 已按最新 review 重写 RFC：删除 proxy_ip_hint/固定 target 逻辑，改为 http-services helper 枚举 http-proxy ip 池并 round robin 选择，fetch 仅用 labels.ip 路由。
- 同步更新 Error Semantics/Observability/Testability/Plan 与接口定义以匹配新流程。
- 已按你的确认更新 RFC：将 ip 标签计算移到 http-services（computeAndInjectProxyIp），并加入 ip 池缓存与在 http-proxy 终端变更时刷新策略。
- 执行测试：`(cd libraries/http-services && npx heft test --clean)` 通过（Jest 3 suites, 0 failures）。
- vendor-binance 未发现可用的 targeted 测试脚本/用例（包内无 test 文件，package.json 无 test/bench），按要求跳过并记录。
- 已按新增 review 重写 RFC：使用 http-services helper 枚举 HTTPProxy ip 池并 round robin 选择，fetch 通过 labels.ip 路由；移除 proxy_ip_hint/固定 target 设计。
- 同步更新 plan.md 摘要以匹配新流程。
- 完成 vendor-binance 先行改造：tokenBucket key 引入 ip 维度，代理场景通过 labels.ip 路由；新增 http-services proxy ip helper。
- 执行测试：`npx heft test --clean`（workdir `libraries/http-services`）通过；Jest 3 suites, 0 failures；含 API Extractor warning（缺少 release tag、API 变更提示）。
- 执行测试：`npx tsc --noEmit --project apps/vendor-binance/tsconfig.json` 失败（npx 提示未安装/未解析到 TypeScript）；判断为环境/工具链问题，非 impl-dev/impl-test 逻辑错误。
- 执行测试：`(cd libraries/http-services && npx heft test --clean)` 通过；Jest 3 suites，0 failures；仅 API Extractor 警告（缺少 release tag）。
- 安全修复：默认 https 获取 proxy ip，限制 PROXY_IP_FETCH_URL 为 https，空 ip 不覆盖既有标签。
- 可信来源闭环：ip_source 标记 + 枚举校验 + http-proxy 仅注入可信 labels.ip。
- 测试：libraries/http-services `npx heft test --clean` 通过（Jest 3 suites, 0 failures）。
- 代码审查通过，安全审查通过（均已落盘至 Task docs）。
- 生成 walkthrough 报告与 PR Body 建议（已落盘 Task docs）。
- 完成 selector 微基准实现：覆盖不同 proxy 池规模并输出阈值判定。
- 补充 spec-bench 对 selector 微基准的场景、阈值与验收标准。
- 完成 benchmark 安全审查结论与修复建议（聚焦资源占用/日志泄露/非法访问）。
- 执行 benchmark：`npm run bench`（workdir `libraries/http-services`）超时失败；HTTPProxy 仅允许 localhost，导致外部域名全部 FORBIDDEN，bench 未完成。
- 新增 selector 微基准与阈值判定，并补充 spec-bench 文档。
- bench 运行通过：已忽略非本地 HOST_URL，使用本地 Host 完成全部场景与 selector 微基准。
- 验证：`npm run bench`（workdir `libraries/http-services`）通过，selector 微基准 S1-S4 达标。
- 已完成安全复审（订阅清理、缓存过期风险、ip_source 可信来源假设）并生成报告正文；因工具限制无法写入 docs/review-security.md。
- 完成安全复审：重点检查 ip_source 信任边界与订阅清理风险，形成报告正文（未能落盘 docs/review-security.md，工具权限限制）。
- 优化 listHTTPProxyIps：使用 listWatchEvent 缓存并绑定 dispose 清理；无 terminalInfos$ 时按调用刷新。
- 恢复 selector 微基准原阈值并通过 bench。
- 用户确认安全问题暂不处理，解除安全审查阻塞。
- 完成 Aster public/private API 推广：tokenBucket key 增加 ip 维度，USE_HTTP_PROXY 时通过 labels.ip 路由，直连使用 public_ip fallback。
- 运行 `rush build` 通过（含 vendor-aster）。
- 已复核 scope 内 vendor 文件，确认 proxy ip 选择/labels.ip 路由/encodePath key/public_ip fallback 均已满足 RFC 要求，无需改动。
- 阶段 B 验证：在仓库根目录执行 `rush build`，结果通过（缓存命中较多）。
- 推广剩余 vendor（bitget/gate/huobi/hyperliquid/okx）：代理场景通过 labels.ip 路由并引入 ip 维度限流 key；直连使用 public_ip fallback。
- 验证：`rush build` 通过。
- 完成 code/security review，报告落盘：`review-code-rollout.md`、`review-security-rollout.md`。
- 生成 rollout walkthrough 与 PR Body：`.legion/tasks/vendor-tokenbucket-proxy-ip/docs/walkthrough-rollout.md`、`.legion/tasks/vendor-tokenbucket-proxy-ip/docs/pr-body-rollout.md`。
- 修复 Aster per-ip tokenBucket 配置缺失：per-ip bucket 复用 base 限频参数，避免 acquireSync(weight) 直接失败。
- 验证：`rush build --to @yuants/vendor-aster` 通过。
- 检查其他 vendor 的 per-ip tokenBucket 配置：发现 Binance 未复用 base 限频参数并修复。
- 验证：`rush build --to @yuants/vendor-binance` 通过。
- 在 http-services 集成测试中增加 CI/CI_RUN 跳过逻辑，避免 CI 运行 E2E/Integration。
- Gate 测试在 HOST_URL 未设置时跳过，并延迟导入依赖，避免 fromNodeEnv 在测试加载阶段直接报错。

### 🟡 进行中

(暂无)

### ⚠️ 阻塞/待定

(暂无)

---

## 关键文件

- `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/rfc.md`
- `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-rfc.md`

---

## 关键决策

| 决策                                                                                                                                                                                        | 原因                                                                                                                                                     | 替代方案                                                                                                                               | 日期       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 推荐方案 A：在 `@yuants/http-services` 增加 target-aware API                                                                                                                                | 统一 resolve 与请求逻辑，避免 vendor 重复实现并保证 key 与 proxy target 一致                                                                             | 方案 B：vendor 自行 resolve + `requestByMessage` 固定 target                                                                           | 2026-02-04 |
| tokenBucket key 统一使用 `encodePath([BaseKey, ip])`，代理场景优先 `tags.ip`、fallback 到 `tags.public_ip`，直连使用 `terminal.terminalInfo.tags.public_ip`；不新增开关，回滚通过版本回退。 | 避免分隔符冲突、对齐用户需求并统一语义；减少额外配置复杂度。                                                                                             | 保留 `BaseKey:<ip>` 拼接 + 仅在代理场景引入 ip 维度。                                                                                  | 2026-02-04 |
| 本次审查建议补齐 labels.ip 可信来源/绑定机制与错误语义闭环后再进入实现阶段。                                                                                                                | 现有 RFC 校验顺序与可信来源信号缺失导致不可实现与不可验证。                                                                                              | 保持现状并在实现时临时约定来源信号（风险: 实现偏离与一致性不可验证）。                                                                 | 2026-02-04 |
| 提示当前 RFC 在 hint 分支无 fallback 的描述与 Data Model/兼容策略存在冲突，需收敛为“hint 分支硬失败、不降级”。                                                                              | 避免实现按默认降级路径违背 R15，导致 key 与出口不一致。                                                                                                  | 保留默认降级并在实现中额外判定（风险: 文档与实现分叉）。                                                                               | 2026-02-04 |
| 审查结论：resolveHTTPProxyTarget 合约依赖候选枚举与错误语义区分，但当前来源仅单 target，导致实现/验证不闭环。                                                                               | 无法区分 no_service 与 no_match，也无法保证确定性选择；错误码与校验顺序无法形成可验证因果链。                                                            | 新增 HTTPProxy 候选枚举 API 并保留区分；或收敛错误语义并移除确定性选择要求。                                                           | 2026-02-04 |
| 用户已批准 RFC，允许进入实现阶段。                                                                                                                                                          | 用户在会话中明确回复“批准”。                                                                                                                             | 继续等待确认                                                                                                                           | 2026-02-04 |
| labels.ip 仅接受 ip_source=http-services 的可信标签。                                                                                                                                       | 满足 RFC Security Considerations 的可信来源校验要求。                                                                                                    | 不校验来源（风险：标签被注入）                                                                                                         | 2026-02-04 |
| 安全审查报告未落盘到 docs/review-security.md                                                                                                                                                | 当前工具权限禁止编辑/写入文件（apply_patch 被拒），无法使用 Write 工具。                                                                                 | 由人类落盘或开放写入权限后重试                                                                                                         | 2026-02-04 |
| bench 默认仅允许本地 HOST_URL；远端需显式 ALLOW_REMOTE_HOST=true。                                                                                                                          | 避免共享 Host 干扰与外部请求导致 bench 失败。                                                                                                            | 始终使用 HOST_URL（可能引入外部流量与噪声）                                                                                            | 2026-02-04 |
| Bench failure classified as impl-dev (proxy-ip watch undefined), not impl-test.                                                                                                             | Stack trace points to runtime undefined access in `ensureProxyIpWatch` before selector benchmark assertions run; no evidence of test assertion mismatch. | If environment variables or host setup are required for bench, could be env issue; currently error occurs before host-dependent steps. | 2026-02-05 |
| 安全问题暂不处理：集群处于可信环境，ip_source 信任边界不再阻塞当前工作。                                                                                                                    | 用户明确表示安全暂时不要管，可信环境内运行。                                                                                                             | 补齐 Host 侧鉴权/签名或白名单机制                                                                                                      | 2026-02-05 |

---

## 快速交接

**下次继续从这里开始：**

1. Walkthrough 与 PR Body 已生成：`.legion/tasks/vendor-tokenbucket-proxy-ip/docs/report-walkthrough.md`、`.legion/tasks/vendor-tokenbucket-proxy-ip/docs/pr-body.md`（rollout 版本同目录）。
2. 如需继续验证，可补充运行包级 `rushx test` 或指定测试集。
3. 如要收敛安全建议，优先处理 public_ip 缺失的 fallback 隔离与 proxy 路由日志补齐。

**注意事项：**

- 构建输出无错误，仅提示 Node 版本未测试（Node.js 24.11.0）。

---

_最后更新: 2026-02-05 00:47 by Claude_
