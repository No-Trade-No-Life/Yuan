# RFC 对抗审查报告（剃刀原则）

结论: PASS
Blocking: 无
原因: 递归根因与规避路径清晰，改动局部且可回滚；测试条款可映射；USE_HTTP_PROXY 边界与 public IP 用途已声明。

## 必须修正

- 无

## 可选优化（逐条质疑与最小建议）

1. 【必要性】public IP 仅用于观测，是否值得保留外部依赖？建议: 若无强需求，直接移除 public IP 获取与 public_ip 标签；或明确“允许永久为空”并在日志中不视为异常。
2. 【假设】USE_HTTP_PROXY 仅接受 'true'，部署若使用 '1'/'TRUE' 会失效并可能复现递归。建议: 明确在启动时对非 'true' 的 truthy 值报警，或接受 '1'/'TRUE'（保持最小改动为日志报警）。
3. 【边界】globalThis.\_\_yuantsNativeFetch 的所有权与类型未约束，第三方写入非函数会导致异常。建议: 读取前校验 typeof === 'function'，否则视为不可用并跳过 public IP。
4. 【复杂度】双来源 nativeFetch + marker 逻辑仍依赖加载顺序。建议: 在 terminal.ts 先判定 globalThis.fetch 是否带 marker，若是则直接跳过 public IP（减少对缓存时机的依赖）。
5. 【替代方案】方案 2 的“禁用 public IP”开关可能足以解决递归且更直观。建议: 保持不实现，但在 Open Questions 中明确不做的理由与触发条件（例如后续观测需求变化）。
6. 【可验证/可回滚】当前 Testability 以条款描述为主，缺少最小可执行验证步骤。建议: 补一条手工验证步骤（USE_HTTP_PROXY=true 调用一次 http-services fetch，断言无递归且 publicIP 为空），并在回滚中说明无需清理 \_\_yuantsNativeFetch。

## 可实现/可验证/可回滚评估

- 可实现: 是，改动限于 http-services 与 terminal.ts。
- 可验证: 是，R1-R7 可映射到单测或手工验证。
- 可回滚: 是，回退两个文件改动即可；可选补充无需清理 globalThis.\_\_yuantsNativeFetch。
