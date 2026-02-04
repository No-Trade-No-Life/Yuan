# HTTP Proxy App Implementation - 任务清单

## 快速恢复

**当前阶段**: 阶段 2 - Implementation
**当前任务**: (none)
**进度**: 10/10 任务完成

---

## 阶段 1: Design ✅ COMPLETED

- [x] Create RFC / Protocol Specification | 验收: RFC document created at docs/rfc.md
- [x] Create Dev, Test, Bench, and Obs Specifications | 验收: Spec documents created at docs/spec-\*.md
- [x] Perform Design Self-Check | 验收: Design self-check report added to context and user approval requested
- [x] 设计审批通过（用户确认） | 验收: 用户在 tasks.md 勾选“设计审批通过（用户确认）”

---

## 阶段 2: Implementation 🟡 IN PROGRESSD

- [x] Initialize package @yuants/app-http-proxy | 验收: Package structure created and dependencies added
- [x] Implement core logic | 验收: Application starts and registers HTTP service
- [x] Walkthrough 报告生成完成 | 验收: docs/report-walkthrough-metrics.md 与 docs/pr-body-metrics.md 已生成

---

## 发现的新任务

- [x] 测试执行（构建验证）失败已修复：移除 tsconfig 中 `heft-jest` 类型引用并通过 `rushx build` | 来源: 测试阶段
- [x] RFC 生成完成（简化版） | 验收: `.legion/tasks/http-proxy-app-implementation/docs/rfc-metrics.md` 已生成
- [x] RFC metrics 修订完成（收敛版） | 验收: `.legion/tasks/http-proxy-app-implementation/docs/rfc-metrics.md` 已更新
- [x] RFC metrics 修订：result 映射与 hostname/allowedHosts/timeout 语义更新 | 验收: `.legion/tasks/http-proxy-app-implementation/docs/rfc-metrics.md` 已覆盖修订
- [x] RFC metrics：明确 URL 解析来源优先级与失败边界（绝对 URL vs Host 头拼接） | 来源: RFC 对抗审查
- [x] RFC metrics：定义 allowedHosts 匹配语义（精确/通配/大小写/尾点/IDN） | 来源: RFC 对抗审查
- [x] RFC metrics：补齐 result 映射闭合规则与典型错误示例 | 来源: RFC 对抗审查
- [x] RFC metrics：消除 IP 字面量与 allowedHosts 命中规则冲突 | 来源: RFC 复审 NEEDS_CHANGES
- [x] RFC metrics：明确绝对 URL 与 Host 头冲突处理规则 | 来源: RFC 复审 NEEDS_CHANGES
- [x] RFC metrics 复审完成（结论 NEEDS_CHANGES，输出 review-rfc-metrics.md） | 来源: RFC 复审
- [x] RFC metrics 修订：明确 IP 请求必须 blocked 的语义与 result=blocked 映射 | 来源: RFC 复审
- [x] RFC metrics 修订：补齐写回失败 result=error 与计数落点规则 | 来源: RFC 复审
- [x] RFC metrics 修订：明确 Host 头解析失败边界与反例测试 | 来源: RFC 复审
- [x] RFC metrics 复审完成（结论 NEEDS_CHANGES，输出 review-rfc-metrics.md） | 来源: RFC 复审
- [x] RFC metrics：明确 invalid_url 时 target_host=invalid 且不进白名单 | 来源: RFC 复审 NEEDS_CHANGES
- [x] RFC metrics：raw_url 含 scheme 但解析失败时不回退 host_header | 来源: RFC 复审 NEEDS_CHANGES
- [x] RFC metrics：绝对 URL 解析成功但 hostname 为空视为 invalid_url | 来源: RFC 复审 NEEDS_CHANGES
- [x] RFC metrics 复审完成（结论 NEEDS_CHANGES，输出 review-rfc-metrics.md） | 来源: RFC 复审
- [x] RFC metrics 修订：明确 CONNECT/authority-form 与 star-form 行为一致性 | 来源: RFC 复审 NEEDS_CHANGES
- [x] RFC metrics 修订：定义 blocked/invalid_url 写回失败优先级为 result=error | 来源: RFC 复审 NEEDS_CHANGES
- [x] RFC metrics 修订：澄清 allowedHosts 为空语义或强制非空 | 来源: RFC 复审 NEEDS_CHANGES
- [x] RFC metrics：定义“无需写回”或移除该语义并统一写回判定 | 来源: RFC 复审 NEEDS_CHANGES
- [x] RFC metrics：对齐 CONNECT/star-form 处理与现有实现并补充测试断言 | 来源: RFC 复审 NEEDS_CHANGES
- [x] RFC metrics：定义 raw_url 以 "//" 开头的处理规则 | 来源: RFC 复审 NEEDS_CHANGES
- [x] RFC metrics：限定 host_header 拼接仅支持 origin-form（raw_url 以 "/" 开头） | 来源: RFC 复审 NEEDS_CHANGES
- [x] RFC metrics：明确写回成功判定以保证 result 可验证 | 来源: RFC 复审 NEEDS_CHANGES
- [x] RFC metrics 修订：对齐 allowedHosts 为空的 fail-fast 语义并更新指标注册条件 | 来源: RFC 复审
- [x] RFC metrics 修订：补充 host_header 非法字符拒绝规则（userinfo/fragment 等） | 来源: RFC 复审
- [x] RFC metrics：明确 absolute-form 非 ASCII/IDN 处理规则并补测试 | 来源: RFC 复审 NEEDS_CHANGES
- [x] RFC metrics：定义 ip_literal 识别算法（含 IPv6 zone/IPvFuture） | 来源: RFC 复审 NEEDS_CHANGES
- [x] RFC metrics：要求 absolute-form 严格 scheme:// 并补测试 | 来源: RFC 复审 NEEDS_CHANGES
- [x] RFC metrics 修订：Host 头匹配需大小写不敏感或先小写化 | 来源: RFC 对抗复审 NEEDS_CHANGES
- [x] RFC metrics：收敛 ip_literal 识别规则，避免 '%' 误判 | 来源: RFC 复审 NEEDS_CHANGES
- [x] RFC metrics：明确 allowedHosts 匹配忽略端口并补规范/测试 | 来源: RFC 复审 NEEDS_CHANGES
- [x] RFC metrics：删除 scheme 额外配置假设或定义配置项 | 来源: RFC 对抗复审
- [x] RFC metrics：补齐非 ASCII hostname 处理（明确 raw_url 级 ASCII 校验或允许 punycode）并同步示例/测试 | 来源: RFC 复审 NEEDS_CHANGES
- [x] RFC metrics：明确 host_header IPv6/percent/zone/IPvFuture 的拒绝规则并统一与 absolute-form | 来源: RFC 复审 NEEDS_CHANGES
- [x] RFC metrics：补充 allowedHosts 为空 fail-fast 的现状证据或改为新行为并完善兼容/rollout | 来源: RFC 复审 NEEDS_CHANGES
- [x] RFC metrics：收紧 host_header IPv6 规则（拒绝 zone/IPvFuture/%） | 来源: RFC 复审 NEEDS_CHANGES
- [x] RFC metrics 修订：明确 R10/R12 校验作用域或合并校验路径；补齐 ldh_hostname 长度边界或改为 URL 解析判定；澄清 allowedHosts fail-fast 与 metrics_enabled 的关系并更新兼容/rollout。 | 来源: RFC 复审 NEEDS_CHANGES
- [ ] RFC metrics 对抗复审完成（结论 NEEDS_CHANGES，输出 review-rfc-metrics.md） | 来源: RFC 复审
- [x] RFC metrics：明确 host_header 预处理顺序与 URL 构造字符串，消除 R12/R14 歧义 | 来源: RFC 复审 NEEDS_CHANGES
- [x] RFC metrics：声明指标解析必须复用现有 SSRF/请求解析结果或引用同一解析函数，避免解析分歧 | 来源: RFC 复审 NEEDS_CHANGES
- [ ] 写入 review-rfc-metrics.md（输出对抗复审报告） | 来源: RFC 对抗复审
- [x] RFC metrics：明确 IP 字面量判定来源（复用 parse_result 或现有 SSRF 判定函数）并补测试 | 来源: RFC 对抗复审
- [x] RFC metrics：明确 IP 判定复用 parsed_url + net.isIP，并补用例 | 来源: RFC 复审 NEEDS_CHANGES
- [x] RFC metrics：补充 absolute-form-only 现有行为证据或改为以 parse_result 判定为准 | 来源: RFC 复审 NEEDS_CHANGES
- [x] RFC metrics：明确 parse_result 的生产位置/字段与指标复用方式，避免重解析 | 来源: RFC 复审 NEEDS_CHANGES
- [x] RFC metrics：固定 allowedHosts 缺失/非法时启动语义，并明确与 metrics_enabled 的关系与验证用例 | 来源: RFC 复审 NEEDS_CHANGES
- [x] RFC metrics：明确 parse_result 来源/字段与复用位置 | 来源: RFC 复审 NEEDS_CHANGES
- [x] RFC metrics：固定 allowedHosts 启动语义与 metrics_enabled 关系 | 来源: RFC 复审 NEEDS_CHANGES
- [ ] RFC metrics：对齐 allowedHosts 缺失/非法时启动语义与实际实现，并补兼容/回滚说明 | 来源: RFC 对抗复审
- [x] 设计审批通过（用户确认）- HTTP Proxy 目标域名指标 RFC | 来源: 用户确认选择 1（接受设计并进入实现）
- [x] 测试执行（libraries/http-services `rushx build`）失败：invalid_url 结果映射错误需修复 | 来源: 测试阶段 ← CURRENT
- [ ] 修复安全阻塞：allowedHosts 为空时开放代理风险（需 fail-fast/强限制） | 来源: review-security-metrics.md blocking
- [ ] 修复安全阻塞：req.timeout 缺少上限导致 DoS 风险 | 来源: review-security-metrics.md blocking
- [ ] 记录风险接受：allowedHosts 为空与 timeout 无上限的隔离前提（RFC R27a/R27b） | 来源: 用户选择方案 2
- [x] 处理安全阻塞或明确 wontfix：allowedHosts 为空开放代理风险 | 来源: review-security-metrics.md FAIL
- [x] 处理安全阻塞或明确 wontfix：req.timeout 无上限 DoS 风险 | 来源: review-security-metrics.md FAIL
- [x] 处理 rfc-metrics review：去除 allowedHosts gating，新增 target_path 指标并同步实现与测试 | 来源: 用户 review
- [x] 按 review 意见改码并补充单测（target_path + labels） | 来源: 用户要求子代理复审后修改
- [ ] 评估 target_path 高基数风险：路径归一化/前缀过滤/分层指标方案 | 来源: 用户要求预留方案
- [x] 移除 warnedAllowedHostsWithPort 并更新测试/RFC/plan | 来源: 用户反馈 unused

---

_最后更新: 2026-02-03_
6-02-03*
�: 2026-02-03*
6-02-03*
3*
_
3_
-03*
3*
\_

-03*
3*
\_

-03*
3*
\_

-03*
3*
_
-03_
3\_
_
3_
\_
