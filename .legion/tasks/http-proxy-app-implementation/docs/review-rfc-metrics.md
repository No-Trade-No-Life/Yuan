# RFC 复审报告：rfc-metrics.md

结论：**NEEDS_CHANGES**

## 必须修正

1. absolute-form-only 假设证据不足，可能与现有处理不一致

- 质疑/风险：R5 直接规定非 absolute-form 视为 invalid_url，但证据仅引用 schema `format: uri`。若现有链路仍接受 origin-form/CONNECT，指标会把有效请求标成 invalid_url，违反“仅影响指标、不改变行为”的前提，且不可验证。
- 最小修改建议：补充“现有解析已拒绝非 absolute-form”的明确证据（代码路径/行为说明）并给出 1 条验证用例；或把 R5 改为“以 parse_result 的解析形态为准”，将 absolute-form 作为前置条件而非强制规则。

2. parse_result 复用的来源/字段不明，易迫使重新解析

- 质疑/风险：R6 要求“复用现有 parse_result 与 parsed_url”，但 RFC 未指定 parse_result 的生产位置/字段结构/可见性。实现侧若拿不到该对象，只能重解析，直接违背 R6 并引入解析分歧。
- 最小修改建议：在 Protocol/Plan 中明确“指标计数点可访问 parse_result 的具体位置/对象”（例如 server.ts 中某函数的返回值或请求上下文字段），并要求指标逻辑直接读取该对象；补 1 条“同一对象复用”的验证说明。

3. allowedHosts 缺失/非法时的启动语义未固定，导致不可验证

- 质疑/风险：R15 说“服务启动行为完全复用既有逻辑”，R18 又写“服务 MAY 继续运行并告警”。若既有实现 fail-fast，则“继续运行+告警”不可达；反之若继续运行，R17/R18 的条件必须更明确。当前语义无法验证。
- 最小修改建议：明确既有行为是“fail-fast”还是“继续运行”，并据此调整 R17/R18（包含是否记录告警、是否还能暴露其他指标）；补 1 条启动行为验证用例。

4. metrics_enabled 与 allowedHosts 校验/启动关系未定义

- 质疑/风险：R16 只管指标注册，但未说明 metrics_enabled=false 时是否仍执行 allowedHosts 校验。若 allowedHosts 校验被跳过，将改变现有安全基线，且与“不改变行为”冲突。
- 最小修改建议：明确“allowedHosts 校验与启动行为不受 metrics_enabled 影响”，metrics_enabled 仅影响指标注册与输出；补 1 条验证说明。

## 可选优化

- 合并 R1-R4 的重复前置条件：先定义注册条件，再统一描述计数规则，减少冗余。
- 明确 allowedHosts 匹配与 normalized_host 使用同一规范化流程（大小写/尾点/IDN），避免实现侧出现二次规范化分支。

## 可实现/可验证/可回滚性

- 当前版本在问题 1-4 上不可验证或存在实现歧义，需先修正后才能稳定落地。
- R39 的回滚描述可保留，但应基于上述修正后的统一行为测试。
