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
- 完成现状调研：已阅读 tokenBucket util、http-services/proxy-ip、http-proxy 启动注入、vendor-binance 按 weight 限流调用链。
- 确认当前核心行为：ip 选择为 round robin，tokenBucket 维度为 encodePath([baseKey, ip])，请求通过 labels.ip 路由。
- 识别关键约束：tokenBucket 仅暴露 acquire/acquireSync/read，acquireSync 在令牌不足时立即抛错；Terminal 路由对多候选服务默认随机。
- 按最新任务目标完成 RFC 覆盖重写（v2）：聚焦“按权重自动负载均衡 + 主动限流”，明确方案 A/B 对比并推荐方案 B（`acquireProxyBucket`）。
- 在 RFC 中补齐 Problem/Constraints（3 条调研事实）、状态机、数据模型、错误语义、可观测性、Testability（R1-R12）与回滚到 RR 策略。
- 已同步更新 `plan.md` 摘要（核心流程/接口变更/文件清单/验证策略）并在 `tasks.md` 勾选“RFC 生成完成”。
- 完成 v2 RFC 剃刀原则对抗审查并落盘报告：`.legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-rfc.md`。
- 审查结论更新为 NEEDS_CHANGES，识别 4 项 blocking：接口输入不足、错误码边界重叠、回滚目标冲突、R10/T-R10 不可测。
- 已按 latest review 完成 RFC 最小修订并闭环 4 个 blocking：
  - `acquireProxyBucket` 明确 options 来源为 `getBucketOptions(baseKey)`，禁止隐式默认 options。
  - 新增错误阶段归属表（`pool|acquire|route|request`），封闭 `E_PROXY_TARGET_NOT_FOUND` 与 `E_PROXY_REQUEST_FAILED` 边界。
  - 固化灰度/回滚模式命名：`legacy_rr_single_try`、`rr_multi_try`、`helper_acquire_proxy_bucket`，并写明默认/灰度/回滚值和 30 分钟验证窗口。
  - 将 R10/T-R10 改为可观测行为：`bucket_options_conflict_total` 计数 + `E_BUCKET_OPTIONS_CONFLICT` 返回语义。
- 同步更新 `plan.md` 摘要与 `tasks.md` 进展记录，保持 RFC 作为设计真源。
- 完成 RFC 再次对抗复审（聚焦上一轮 4 个 blocking 闭环与新增阻塞识别），结论为 NEEDS_CHANGES。
- 复审确认已闭环：options 来源、错误阶段归属边界、灰度/回滚模式命名与操作窗口。
- 识别新增 blocking：R10 为 SHOULD 而 T-R10 为硬断言，规范强度冲突导致可实现/可验证不一致。
- 复审报告已写入 `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-rfc.md`。
- 已完成 RFC 最小修订：将 R10 升级为 MUST，并同步将 Goals 中“可承载组优先”由 SHOULD 升级为 MUST，消除与 T-R10 硬断言的规范强度歧义。
- 完成最新 RFC 最终只读复审：结论 PASS（可实现/可验证/可回滚均满足），审查报告已写入 `.legion/tasks/vendor-tokenbucket-proxy-ip/docs/review-rfc.md`。
- 本轮无必须修正项，仅保留 3 条可选优化建议（T-R10 并发判定锚点、模式开关配置落点、观测样例字段）。
- 完成设计循环收敛：RFC 经多轮 spec-rfc/review-rfc 对抗审查，最终结论 PASS。
- 已更新 plan.md 的 RFC 真源链接、摘要、范围与阶段，Scope 收敛到 http-services/http-proxy/vendor-binance。
- 完成 http-services v2 helper：`acquireProxyBucket(input)`（强制 `getBucketOptions(baseKey)`、可承载组优先、候选失败切换、全失败 `E_PROXY_BUCKET_EXHAUSTED`、空池 `E_PROXY_TARGET_NOT_FOUND`、options 冲突 `E_BUCKET_OPTIONS_CONFLICT` + `bucket_options_conflict_total`）。
- 完成 http-services route/request 阶段错误语义：`fetch` 路由异常归类为 `E_PROXY_TARGET_NOT_FOUND`（stage=route），代理响应失败归类为 `E_PROXY_REQUEST_FAILED`（stage=request）。
- 完成 vendor-binance 接入：`createRequestContext(baseKey, weight)` 在代理模式改用 helper 获取 `{ip,bucketKey}`；public/private API 统一使用 `requestContext.bucketKey` 与 `requestContext.acquireWeight`，确保 key/路由同源并避免重复扣减。
- 新增并通过单测：`proxy-ip.test.ts` 覆盖优先组、高权重选择、失败切换、空池、全失败、options 冲突；`client.test.ts` 覆盖 route/request 错误码边界。
- 验证通过：`npx heft test --clean`（libraries/http-services）；`rush build --to @yuants/vendor-binance`。
- 验证执行（http-services 单测）：`npx heft test --clean` @ `libraries/http-services`，4 suites/31 tests，0 失败。
- 验证执行（http-services 构建）：`npm run build` @ `libraries/http-services`，通过（含 test+api-extractor+post-build）。
- 验证执行（vendor-binance 最小构建）：`npm run build` @ `apps/vendor-binance`，通过（Jest 0 suites, code 0；TypeScript/API Extractor 通过）。
- 交叉验证（依赖图构建）：`rush build --to @yuants/vendor-binance` @ repo root，通过（20/20 from cache）。
- 验证执行（http-services 单测）：`npx heft test --clean` @ `libraries/http-services`，4 suites/34 total（30 passed, 0 failed），通过。
- 验证执行（http-services 构建）：`npm run build` @ `libraries/http-services`，通过（heft test + API Extractor + post-build 全流程完成）。
- 验证执行（vendor-binance 构建）：`npm run build` @ `apps/vendor-binance`，通过（Jest 0 suites code 0，TypeScript/API Extractor 通过）。
- 完成最新代码只读安全复审并确认此前 3 个 blocking 已闭环。
- 基于最新实现生成并落盘 walkthrough：`.legion/tasks/vendor-tokenbucket-proxy-ip/docs/report-walkthrough-impl.md`。
- 基于最新实现生成并落盘 PR Body 建议：`.legion/tasks/vendor-tokenbucket-proxy-ip/docs/pr-body-impl.md`。
- 汇总结论：实现验收通过（http-services 单测 4 suites/35 total/0 failed；定向构建通过；review-code PASS；review-security PASS）。
- 阶段 A 完成：按 RFC 在 http-services/http-proxy/vendor-binance 落地 v2（acquireProxyBucket、stage 错误边界、terminal_id 绑定、冲突计数与 fail-closed）。
- 阶段 B 完成：复测通过（heft test + rush build）且 review-code/review-security 最终均为 PASS。
- 阶段 C 完成：生成 impl 版 walkthrough 与 PR body（report-walkthrough-impl.md / pr-body-impl.md）。
- 已按 Scope 仅提交实现相关代码文件并创建提交：`feat(http-services): add weighted proxy bucket acquisition`。
- 已推送分支 `legion/feature-proxy-bucket-v2` 到 fork。
- 已创建上游 PR：`https://github.com/No-Trade-No-Life/Yuan/pull/2580`（head: `Thrimbda:legion/feature-proxy-bucket-v2`，base: `main`）。
- 根据外部代码评审反馈修复高优问题：proxy 模式 `acquireWeight=0` 导致 `acquireSync(0)` 触发 `SEMAPHORE_INVALID_ACQUIRE_PERMS`。
- 在 `libraries/utils/src/tokenBucket.ts` 将 `acquireSync(0)` 定义为 no-op，并在 `libraries/utils/src/tokenBucket.test.ts` 补充回归测试。
- 验证通过：`npx heft test --clean`（libraries/utils）与 `rush build --to @yuants/vendor-binance`。
- 已提交并推送修复提交：`fix(utils): treat tokenBucket acquireSync(0) as no-op`。

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
| 推荐 v2 采用方案 B（`http-services.acquireProxyBucket`），方案 A 作为最小侵入/回滚路径。                                                                                                    | 集中维护候选选择、acquire 失败切换与 cooldown，可统一错误语义与观测，并保证 `bucketKey.ip` 与 `labels.ip` 同源。                                         | 仅在 vendor 内做 RR+多次 acquire（实现快但会重复逻辑、行为易分叉）。                                                                   | 2026-02-07 |
| 最新 RFC 修订中固定 `acquireProxyBucket` 的 options 来源为 `getBucketOptions(baseKey)`，并以错误阶段归属表封闭错误边界。                                                                    | 消除 helper 隐式默认 options 漂移与 route/request 错分，保证实现一致性与测试稳定性。                                                                     | 继续保留模糊 options 来源与宽泛请求失败归类（风险：实现歧义、断言不稳定）。                                                            | 2026-02-07 |

---

## 快速交接

**下次继续从这里开始：**

1. 等待 PR #2580 新一轮 CI 与 reviewer 复核。

**注意事项：**

- 此次修复直接针对 reviewer 报告中的系统性运行时失败（proxy 模式下所有 Binance 请求前置失败）。

---

_最后更新: 2026-02-09 by OpenCode_
