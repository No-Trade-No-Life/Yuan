# RFC 对抗审查报告 - http-services terminalInfos$ 就绪等待

RFC Path: `.legion/tasks/http-services-terminalinfos-ready/docs/rfc.md`
Output Path: `.legion/tasks/http-services-terminalinfos-ready/docs/review-rfc.md`

## 结论

- 迁移验收闭环已具备可执行检查（rg 校验 + 允许保留同步基准调用 + async 调用点约束），满足可验证性。
- 必须修正：无。
- 可实现/可验证/可回滚：满足。实现路径与回滚路径清晰可落地。

## 必须修正

- 无。

## 可选优化（逐条质疑与最小化建议）

1. 固定 30 秒等待是否必要

- 质疑：假设所有 USE_HTTP_PROXY=true 的场景都能容忍 30s 等待，但无代理环境可能长期空等。
- 最小化建议：在迁移验收中补一句“调用点必须保证 USE_HTTP_PROXY=true 或已确认存在 proxy”，作为运行前置条件，避免无意义等待。

2. terminalInfos$ 不可用即 empty_pool 的边界假设

- 质疑：假设该分支只用于非标准 Terminal/测试双场景，但未定义如何识别。
- 最小化建议：测试计划增加一条“terminalInfos$ 不可用场景”用例，明确该分支只服务 stub/测试，避免误用。

3. 仅 timeout 记录日志的可观测性假设

- 质疑：假设 empty_pool 分支不需要可观测，但当 terminalInfos$ 结构被破坏时可能静默失败。
- 最小化建议：仅在 empty_pool 分支增加一次性 debug/trace 级日志（不含 ip 字段），保持最小噪音。

4. 迁移验收的扫描完整性假设

- 质疑：仅靠 `rg "selectHTTPProxyIpRoundRobin"` 可能漏掉别名 re-export 或包装函数。
- 最小化建议：补充 `rg "selectHTTPProxyIpRoundRobinAsync"` 确认无多参数调用与 `rg "from '@yuants/http-services'"` 复核导入口径，作为可选增强验证。

5. async 化对调用链的隐性风险

- 质疑：假设所有调用点都被正确 await，若漏 await 将回退为未等待的旧行为。
- 最小化建议：迁移验收增加一次 TypeScript 编译或 lint 检查，确认无未 await 的 Promise 泄漏。

## 回滚性检查

- 回滚策略清晰：恢复同步调用点并移除/停用 async 导出。无额外不可逆依赖。
