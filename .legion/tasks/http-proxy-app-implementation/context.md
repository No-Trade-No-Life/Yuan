# HTTP Proxy App Implementation - 上下文

## 会话进展 (2026-01-28)

### ✅ 已完成

- 完成 RFC 文档，路径：.legion/tasks/http-proxy-app-implementation/docs/rfc.md
- 完成 Specs 文档（dev/test/bench/obs），路径：.legion/tasks/http-proxy-app-implementation/docs/spec-dev.md / spec-test.md / spec-bench.md / spec-obs.md
- 完成设计自检报告并发起用户确认请求
- 用户已确认设计审批（待在 tasks.md 勾选）
- 在 tasks.md 记录并勾选“设计审批通过（用户确认）”
- 修订 RFC/spec-dev/spec-test/spec-obs 以补齐安全默认、allowedHosts、labels 与资源限制配置
- 闭环设计 Review 阻塞项
- 补齐 @yuants/app-http-proxy 的 package.json 与编译配置
- 实现 HTTP Proxy 启动入口与环境变量校验（ALLOWED_HOSTS/ALLOW_INSECURE_WS 等）
- 完成 labels/options 映射并注册 HTTP Proxy 服务
- 增加 HOST_URL 协议校验、默认并发/排队上限与数值范围校验
- 移除未使用的 @yuants/utils 依赖
- 安全审查阻塞项已闭环
- 构建验证通过：`rushx build`（apps/http-proxy），未出现 tsc 报错（仅提示 Node 版本未测试与项目未注册警告）
- 移除 apps/http-proxy/tsconfig.json 中无效的 heft-jest 类型引用以修复构建失败
- 根据 apps/http-proxy/src/index.ts 更新 RFC/spec-dev/spec-test/spec-obs/report-walkthrough/pr-body 文档
- 完善 graceful shutdown：信号只处理一次、5s 超时强制退出、异常兜底
- 按你的 rxjs 流重写 graceful shutdown，去掉 timeout/promise 并在 RxJS tap 中完成清理
- 同步更新 spec-dev/spec-obs 文档
- 用 RxJS race+timer 实现 shutdown 超时，保持在流内处理并更新 spec-dev/spec-obs 文档
- 完成 RFC metrics 对抗性审查，结论 NEEDS_CHANGES，输出 review-rfc-metrics.md
- 修订 RFC metrics：补齐 URL 解析优先级、allowedHosts 语义、基数上限、result 映射、回滚细则与最小验证
- RFC metrics 复审完成，结论 NEEDS_CHANGES，输出 review-rfc-metrics.md。
- 修订 rfc-metrics.md：allowedHosts 禁止 IP、IP 字面量固定为 `ip` 且不进入白名单；绝对 URL 优先并忽略 Host 头冲突。
- RFC metrics 复审完成（结论 NEEDS_CHANGES）：新增问题聚焦 IP 请求阻断语义、写回失败 result 映射、Host 解析失败边界，输出 review-rfc-metrics.md。
- 修订 rfc-metrics.md：IP 字面量请求强制 blocked、写回失败映射 result=error、Host 头解析失败边界与反例、移除 unknown 占位符并补充基数上限依据。
- RFC metrics 复审完成（结论 NEEDS_CHANGES），问题聚焦：invalid_url 的 target_host 规则、scheme 解析失败回退、空 hostname 处理。
- 修订 rfc-metrics.md：invalid_url 目标主机固定为 invalid 且不进白名单，含 scheme 解析失败不回退 host_header，空 hostname 视为解析失败。
- RFC metrics 对抗复审完成（结论 NEEDS_CHANGES），关键争议：CONNECT/authority-form 支持一致性、blocked/invalid_url 写回失败优先级、allowedHosts 为空语义。
- 修订 rfc-metrics.md：CONNECT/star-form 视为 invalid_url、写回失败优先级为 error、allowedHosts 为空时不注册目标域名指标。
- RFC metrics 复审完成（结论 NEEDS_CHANGES，更新 review-rfc-metrics.md）。
- RFC metrics 对抗复审完成（结论 NEEDS_CHANGES，更新 review-rfc-metrics.md）。
- RFC metrics 复审完成（结论 NEEDS_CHANGES）：需对齐 allowedHosts 为空语义与 host_header 校验边界，输出 review-rfc-metrics.md。
- 修订 rfc-metrics.md：allowedHosts 为空 fail-fast；host_header 严格校验（LDH/IPv6/禁用非法字符）；absolute-form userinfo 视为 invalid_url。
- RFC metrics 复审完成（结论 NEEDS_CHANGES，更新 review-rfc-metrics.md）。
- 修订 rfc-metrics.md：absolute-form 仅接受 `scheme://` 且 hostname 必须为 ASCII LDH/IPv6，ip_literal 识别使用 `net.isIP` 或 `:`/`%` 规则并补充测试用例。
- RFC metrics 复审完成（结论 NEEDS_CHANGES）；关键争议：Host 头大小写匹配、ip_literal 识别过宽、scheme 支持范围不清；建议：收敛校验规则并补充测试。
- RFC metrics 复审完成（结论 NEEDS_CHANGES，更新 review-rfc-metrics.md）。
- 修订 rfc-metrics.md：host_header 先小写化、允许尾点并按大小写不敏感 LDH 校验；ip_literal 识别收敛并明确 `%` 规则；absolute-form 仅允许 http/https。

- RFC metrics 复审完成（结论 NEEDS_CHANGES，关键问题：allowedHosts 端口匹配语义缺失、host_header 尾点+端口边界未定义。）
- RFC metrics 复审完成（结论 NEEDS_CHANGES，更新 review-rfc-metrics.md）。

- 修订 rfc-metrics.md：明确 host_header 端口范围、allowedHosts 匹配忽略端口、fail-fast 基线说明。
- RFC metrics 复审完成（结论 NEEDS_CHANGES，更新 review-rfc-metrics.md）。

- 修订 rfc-metrics.md：端口缺省允许且存在时限制 1..65535，scheme 白名单固定 http/https，host_header ASCII 校验先于小写化。
- RFC metrics 复审完成（结论 NEEDS_CHANGES），关键争议：非 ASCII hostname 可验证性、host_header IPv6/percent 边界、allowedHosts 空白名单基线证据。
- RFC metrics 复审完成（结论 NEEDS_CHANGES，更新 review-rfc-metrics.md）。
- 修订 rfc-metrics.md：hostname 以解析结果为准并允许 punycode、host_header IPv6 禁止 `%`/IPvFuture、allowedHosts fail-fast 基线来自 ALLOWED_HOSTS 必填。
- RFC metrics 复审完成（结论 NEEDS_CHANGES，输出 review-rfc-metrics.md）
- 修订 rfc-metrics.md：host_header 规范化唯一步骤与 URL 构造顺序、指标解析复用 SSRF/请求解析结果、allowedHosts 为空时不注册目标域名指标（不改变既有服务行为）。
- 简化 rfc-metrics.md：仅支持 absolute-form，移除 host_header/origin-form 规则；allowedHosts 仅在配置存在时参与指标统计，缺失/非法/超限仅告警且不注册指标。
- 完成 RFC metrics 对抗复审（结论 NEEDS_CHANGES）。
- 识别关键争议：absolute-form-only 与现有解析一致性、allowedHosts 缺失/非法时启动行为、IP 字面量判定来源。
- RFC metrics 复审完成（结论 NEEDS_CHANGES，更新 review-rfc-metrics.md）。
- 完成 rfc-metrics.md 对抗复审，结论 NEEDS_CHANGES（待落盘报告）
- 识别关键争议：absolute-form-only 证据不足、parse_result 复用来源不明、allowedHosts 启动语义与 metrics_enabled 关系未固定
- RFC metrics 复审完成（结论 NEEDS_CHANGES，更新 review-rfc-metrics.md）。
- 完成 rfc-metrics.md 对抗复审草稿（结论 NEEDS_CHANGES），梳理必须修正点与可选优化项。
- 修订 rfc-metrics.md：删除 scheme 白名单、IP 不默认 blocked、allowedHosts 仅规范化匹配、result 仅依赖 handler 返回/抛错、Goals/Non-Goals 收敛。
- 设计门禁确认：RFC 已存在且用户已批准（HTTP Proxy 目标域名指标）。
- 在 /Users/c1/Work/Yuan/libraries/http-services 运行 `rushx build`，构建与测试通过（Jest 23/23）。
- 安全审查完成：review-security-metrics.md（结论 FAIL，存在 blocking）。
- 按用户选择记录风险接受：允许 allowedHosts 为空与 timeout 无上限风险，仅要求部署隔离与上游限流。
- 安全审查复审完成：review-security-metrics.md 结论 FAIL。
- 安全阻塞标记为 wontfix（按用户选择 2）。
- 实现完成：新增 target_host 指标与最小单测，修复 INVALID_URL 映射并通过 rushx build。
- review 完成：code review 通过；security review FAIL 但按用户选择标记为 wontfix。
- 报告完成：生成 report-walkthrough-metrics.md 与 pr-body-metrics.md。
- 处理 rfc-metrics review：指标不依赖 allowedHosts，新增 target_path 维度并更新 RFC/实现/测试。
- 已响应 rfc-metrics review 并调整 RFC/代码：指标统计覆盖所有 host+path，target_path 标签落地。
- 重新运行 /Users/c1/Work/Yuan/libraries/http-services 的 rushx build，测试通过（23/23）。
- 按 review 意见改码：新增 target_path 维度、移除 allowedHosts gating、删除未用函数并补充单测。
- 重跑 /Users/c1/Work/Yuan/libraries/http-services 的 rushx build，测试通过（25/25）。
- 完成子代理 code/security 复审并输出报告。
- 记录高基数风险的预留方案：target_path 归一化/前缀过滤/分层指标。
- 移除 unused warnedAllowedHostsWithPort 逻辑并更新测试/RFC/plan。
- 运行 /Users/c1/Work/Yuan/libraries/http-services 的 rushx build，测试通过（24/24）。

### 🟡 进行中

- 按用户要求执行子代理 code/security 复审。

### ⚠️ 阻塞/待定

(暂无)

---

## 关键文件

(暂无)

---

## 关键决策

| 决策                                                                                                    | 原因                                                                   | 替代方案                                                   | 日期       |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------- | ---------- |
| 采用单一入口 `src/index.ts` 作为胶水层启动 HTTP Proxy 服务                                              | 需求明确要求简单实现，仅需启动 terminal 并注册服务                     | 引入多模块或复杂配置系统以扩展功能；本次不采用，避免复杂化 | 2026-01-28 |
| 默认要求配置 ALLOWED_HOSTS，且非本地 ws:// 需显式允许                                                   | 避免开放代理与明文链路风险，满足安全审查要求                           | 默认放开 allowedHosts 或允许任何 ws://；已弃用             | 2026-01-28 |
| 为 CONCURRENT/MAX_PENDING_REQUESTS/ MAX_RESPONSE_BODY_SIZE 设置默认值与范围校验                         | 满足安全审查的 secure-by-default 要求并避免资源耗尽                    | 完全不设默认值，依赖调用方；已弃用                         | 2026-01-28 |
| 测试阶段采用包内构建验证（rushx build）作为最小可运行检查                                               | @yuants/app-http-proxy 仅定义 build 脚本且无测试脚本，优先执行编译验证 | 运行全仓 `rush build` 或集成测试；成本更高且不必要         | 2026-01-28 |
| graceful shutdown 设置 5s 超时强制退出                                                                  | 避免 dispose/terminal.dispose 卡住导致进程悬挂                         | 不设置超时，依赖事件循环自行退出；已弃用                   | 2026-01-28 |
| graceful shutdown 保持在 RxJS 流内处理，去掉 timeout/promise                                            | 与当前实现风格一致，避免额外控制流                                     | 保留超时与 async 清理；本次不采用                          | 2026-01-28 |
| 使用 RxJS race(timer, cleanup$) 提供 shutdown timeout 能力                                              | 保持 shutdown 逻辑完全在 RxJS 流内，同时具备超时保障                   | setTimeout 或 Promise 逻辑；不采用                         | 2026-01-28 |
| 目标域名指标仅对白名单主机打 label，非白名单/无白名单/无效 URL 使用占位符                               | 避免 Prometheus 高基数与敏感信息泄露，保持可控指标维度                 | 直接使用 hostname 或记录 IP；已弃用                        | 2026-02-03 |
| 目标域名解析优先级采用“绝对 URL 优先，其次 Host 头拼接”，解析失败归入 invalid_url                       | 兼容代理请求绝对/相对 URL 形态，确保指标可实现可验证                   | 仅解析绝对 URL；已弃用                                     | 2026-02-03 |
| allowedHosts 限定精确匹配且设置数量上限，非法或超限配置失败启动                                         | 避免高基数与实现分歧，保持可控与一致性                                 | 允许通配或不设上限；已弃用                                 | 2026-02-03 |
| 回滚时同时删除指标注册与采集点                                                                          | 避免指标空值残留造成误读                                               | 仅删除采集点保留注册；已弃用                               | 2026-02-03 |
| allowedHosts 禁止 IP 字面量，遇到 IP 目标时 `target_host` 固定为 `ip` 且不走白名单                      | 消除 IP 与白名单命中规则冲突并避免泄露 IP                              | 允许 IP 并匹配白名单；已弃用                               | 2026-02-03 |
| 绝对 URL 与 Host 头冲突时忽略 Host，不做一致性校验                                                      | 简化实现与测试，明确解析优先级                                         | 冲突视为 invalid_url；未采用                               | 2026-02-03 |
| 保留状态机章节仅用于 `result` 映射与测试断言说明                                                        | 确保规范可验证且不要求显式状态机实现                                   | 移至附录或删除；未采用                                     | 2026-02-03 |
| IP 字面量请求统一映射为 `blocked` 且 `target_host=ip`                                                   | 与现有 SSRF 规则一致，避免通过指标泄露 IP 或绕过阻断                   | 仅归一化为 `ip` 但允许继续请求；已弃用                     | 2026-02-03 |
| 写回失败/中断映射为 `result=error`，`ok` 仅在写回成功时设置                                             | 使结果可验证且计数点唯一，覆盖客户端断连等写回异常                     | fetch 成功即 `ok`；已弃用                                  | 2026-02-03 |
| Host 头解析失败边界统一为 `invalid_url`（含空白或 `/`）                                                 | 确保解析规则单一、可测试                                               | 允许宽松解析或分支规则；已弃用                             | 2026-02-03 |
| 移除 `unknown` 占位符，保留固定占位符集合                                                               | 配置已强制非空与合法，`unknown` 无可达触发条件                         | 保留 `unknown` 作为兜底；已弃用                            | 2026-02-03 |
| invalid_url 时 `target_host=invalid` 且不进白名单，scheme 解析失败不回退 Host                           | 明确失败边界与回退规则，确保实现与测试一致                             | 允许回退 Host 或保留白名单匹配；已弃用                     | 2026-02-03 |
| CONNECT/authority-form 与 star-form 视为 invalid_url 并尝试写回错误响应                                 | 与现有服务能力一致，避免引入未支持的 CONNECT 语义                      | 支持 CONNECT 或特殊解析；已弃用                            | 2026-02-03 |
| 写回失败统一优先映射为 `result=error`                                                                   | 确保结果与指标可验证，避免写回失败仍显示 blocked/invalid_url           | 保持 blocked/invalid_url 不变；已弃用                      | 2026-02-03 |
| allowedHosts 为空时不注册目标域名指标                                                                   | 对齐现有行为并避免无白名单时的高基数风险                               | 为空时 fail-fast；已弃用                                   | 2026-02-03 |
| raw_url 以 `//` 开头视为 invalid_url，且不回退 Host                                                     | 避免 network-path reference 引入歧义与绕过解析边界                     | 视为 `http:` 解析；已弃用                                  | 2026-02-03 |
| host_header 拼接仅支持 origin-form（raw_url 必须以 `/` 开头且不以 `//` 开头）                           | 限定解析分支，保证可实现且可测试                                       | 对任意相对路径回退 Host；已弃用                            | 2026-02-03 |
| 写回成功判定以 `finish` 为准且不得先 `error/close/destroy`                                              | 给出最小可检测语义，确保 result 可验证                                 | 仅以无异常为成功；已弃用                                   | 2026-02-03 |
| allowedHosts 仅接受 ASCII LDH + 可选端口，IDN 必须 punycode                                             | 统一配置与匹配规则，避免非 ASCII 解析差异                              | 放宽为非 ASCII；已弃用                                     | 2026-02-03 |
| host_header 端口仅允许 1-5 位十进制且范围 1..65535                                                      | 统一端口边界与错误语义，避免解析歧义                                   | 放宽端口格式或忽略非法端口；已弃用                         | 2026-02-03 |
| allowedHosts 匹配仅使用 hostname，端口永不参与                                                          | 消除匹配歧义并与指标维度一致                                           | 允许端口参与匹配；已弃用                                   | 2026-02-03 |
| allowedHosts 为空 fail-fast 属于既有服务基线                                                            | 避免开放代理；本 RFC 仅记录现有行为                                    | 将其视为新行为或允许空白名单；已弃用                       | 2026-02-03 |
| allowedHosts 为空时 fail-fast（启动失败）                                                               | 安全默认对齐，避免开放代理与无约束指标                                 | 为空时不注册指标；已弃用                                   | 2026-02-03 |
| host_header 先小写化并允许尾点，且仅允许 LDH/IPv6 语法并拒绝非法字符与 userinfo                         | 对齐 Host 头语义并降低大小写分歧，避免歧义与注入                       | 要求严格小写或拒绝尾点；已弃用                             | 2026-02-03 |
| absolute-form 仅接受 `scheme://` 且仅允许 `http/https`                                                  | 避免解析歧义与回退逻辑不一致，确保规则可测试                           | 允许更多 scheme 或回退 Host；已弃用                        | 2026-02-03 |
| absolute-form hostname 必须为 ASCII LDH 或 IPv6 字面量                                                  | 统一解析与 IDN 处理边界，避免非 ASCII 差异                             | 允许非 ASCII hostname；已弃用                              | 2026-02-03 |
| ip_literal 识别收敛为 `net.isIP` 或 hostname 含 `:`，`%` 仅在 IPv6 zone 且含 `:` 时成立                 | 避免 `%` 误判并保持 IPv6 zone 可检测                                   | 只依赖 `net.isIP` 或对 `%` 一概当作 IP；已弃用             | 2026-02-03 |
| scheme 白名单固定仅允许 `http/https`，不引入额外配置                                                    | 避免行为漂移与配置歧义，确保实现与测试一致                             | 允许配置扩展 scheme；已弃用                                | 2026-02-03 |
| host_header ASCII 校验先于小写化，避免非 ASCII 变换歧义                                                 | 明确校验顺序，保持规则可实现且可测试                                   | 先小写化再校验；已弃用                                     | 2026-02-03 |
| host_header 端口缺省允许，存在时必须 1..65535                                                           | 与 RFC 解析分支一致，避免缺省端口误判                                  | 缺省端口视为错误或忽略端口格式；已弃用                     | 2026-02-03 |
| hostname 以 URL 解析后的值为准，允许 punycode，解析后非 ASCII 视为 invalid_url                          | 对齐 URL 解析真实输出，允许 IDN 的 ASCII 表达并保持可测                | 原始非 ASCII 一律 invalid；已弃用                          | 2026-02-03 |
| host_header IPv6 仅允许 `[IPv6]` 且 `net.isIP==6`，拒绝 `%`/IPvFuture                                   | 统一 absolute/origin IPv6 规则，避免 zone/IPvFuture 解析歧义           | 允许 zone 或 IPvFuture；已弃用                             | 2026-02-03 |
| allowedHosts 为空 fail-fast 视为既有 http-proxy 基线（ALLOWED_HOSTS 必填）                              | 对齐现有服务约束并避免开放代理                                         | 作为新行为或允许空白名单；已弃用                           | 2026-02-03 |
| absolute-form 仅使用 raw_url 解析，R10 作为唯一最终 hostname 校验                                       | 避免 Host 头干扰与重复校验，规则可实现且可测试                         | 在 R12 复用 hostname 校验；已弃用                          | 2026-02-03 |
| ldh_hostname 补齐 RFC 1035/1123 长度边界（label 1..63，总长度 <=253）                                   | 统一 DNS 约束，避免过长标签导致解析差异                                | 仅依赖 URL 解析成功；已弃用                                | 2026-02-03 |
| allowedHosts fail-fast 为全局基线，与 metrics_enabled 无关                                              | 与既有安全基线一致，避免禁用指标时绕过白名单校验                       | metrics_enabled=false 时跳过校验；已弃用                   | 2026-02-03 |
| host_header 规范化采用单一有序流程并以 R10 作为最终 hostname 校验                                       | 消除 R12/R14 歧义，确保可实现与可测试                                  | 分散在多条规则中校验；已弃用                               | 2026-02-03 |
| 指标解析复用现有 SSRF/请求解析结果（parse_result）                                                      | 避免解析分歧与安全绕过，确保指标与请求处理一致                         | 指标独立解析 raw_url/Host；已弃用                          | 2026-02-03 |
| allowedHosts 为空时不注册目标域名指标，且不改变既有服务允许空白名单与否的行为                           | 对齐“约定大于配置”，避免新增 fail-fast 行为，同时控制指标基数          | 为空时 fail-fast；已弃用                                   | 2026-02-03 |
| 仅支持 absolute-form（`req.url` 必须为完整 URL），不再解析 host_header/origin-form                      | 对齐现有实现并简化解析路径，避免分支歧义                               | 继续支持 origin-form/Host 头；已弃用                       | 2026-02-03 |
| allowedHosts 缺失/非法/超限时仅告警并不注册指标，不影响请求处理                                         | 不改变既有行为并控制指标基数                                           | 失败即中止服务或强制 fail-fast；已弃用                     | 2026-02-03 |
| absolute-form-only 证据来自 `server.ts` 的 `new URL(req.url)` 路径，非 absolute-form 触发 `INVALID_URL` | 与现有解析路径一致，避免新增分支与实现偏差                             | 以 schema 或其他校验作为依据；已弃用                       | 2026-02-03 |
| parse_result 定义为 handler 内 `urlObj`（`new URL(req.url)` 结果），指标不得重新解析                    | 避免解析分歧与安全绕过，确保指标与请求处理一致                         | 指标独立解析 raw_url；已弃用                               | 2026-02-03 |
| allowedHosts 校验与请求处理不受 `metrics_enabled` 影响；缺失/非法仅告警不 fail-fast                     | 对齐 `server.ts` 现状（无 fail-fast），且 metrics 仅控制注册与输出     | 视 metrics_enabled 决定是否校验或 fail-fast；已弃用        | 2026-02-03 |
| 删除 scheme 白名单，完全依赖 `new URL(req.url)` 解析结果                                                | 避免新增请求行为约束，保持与现有 handler 一致                          | 保留 http/https 白名单；已弃用                             | 2026-02-04 |
| IP 字面量 `target_host=ip`，`result` 仅在 SSRF 实际阻断时为 `blocked`                                   | 不假设 SSRF 必拒绝 IP，避免指标语义与实际行为冲突                      | 一律将 IP 视为 blocked；已弃用                             | 2026-02-04 |
| allowedHosts 仅做“ASCII 小写 + 去尾点”规范化匹配，不新增上限或校验                                      | 运维侧控制基数，避免引入新配置约束                                     | 增加上限或严格校验；已弃用                                 | 2026-02-04 |
| result 完全基于 handler 返回/抛错，不再判定写回成功                                                     | 与现有实现一致，降低可观测分歧                                         | 写回成功作为判定条件；已弃用                               | 2026-02-04 |
| 抛错时 `result` 由 `error.code`/等价信号映射（含 INVALID_URL），未知码为 `error`                        | 对齐现有错误码语义，避免“抛错=error”与 INVALID_URL 冲突                | 一律抛错映射为 error；已弃用                               | 2026-02-04 |
| 解析成功但 hostname 为空统一视为 `invalid_url`，`target_host=invalid`                                   | 明确 file/mailto 等边界，避免落入白名单匹配                            | 允许空 hostname 继续匹配或视为 disallowed；已弃用          | 2026-02-04 |
| allowedHosts 仅允许 hostname，含 `:` 不做自动拆分且仅告警一次                                           | 保持现状匹配失败语义，避免自动修正规则导致分歧                         | 自动拆分端口并匹配；已弃用                                 | 2026-02-04 |
| timeout/blocked 仅绑定到 error.code 或等价信号来源                                                      | 确保语义可检测、可测试且与错误码一致                                   | 依据其他时序或写回状态推断；已弃用                         | 2026-02-04 |
| 移除状态机章节，仅保留事件->result 映射表与最小用例                                                     | 减少误导性抽象，保持规范最小可实现                                     | 保留状态机作为说明；已弃用                                 | 2026-02-04 |

---

## 快速交接

**下次继续从这里开始：**

1. 如需提交 PR，可运行 /legion-pr。

**注意事项：**

- warnedAllowedHostsWithPort 已删除，相关测试与 RFC 已更新。

---

_最后更新: 2026-02-03 by OpenCode_
围限定在 http-services 指标采集与对应单测。

**注意事项：**

- RFC 路径：/Users/c1/Work/Yuan/.legion/tasks/http-proxy-app-implementation/docs/rfc-metrics.md

---

_最后更新: 2026-02-03 by OpenCode_
