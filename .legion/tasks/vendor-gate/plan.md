# vendor-gate 理财账户实现

## 目标

为 vendor-gate 实现理财账户，从 Gate.io 理财 API 获取用户币种理财列表，并按照 vendor-okx 的模式提供账户信息服务

## 要点

- 分析 Gate.io 理财 API 接口
- 参考 vendor-okx 的 earning 账户实现模式
- 实现账户信息服务
- 集成到 vendor-gate 的服务注册中

## 范围

- apps/vendor-gate/src/services/accounts/earning.ts（新建）
- apps/vendor-gate/src/services/account-actions-with-credential.ts（修改注册）
- apps/vendor-gate/src/api/private-api.ts（可能需要新增 API 函数）

## 阶段概览

1. **发现** - 1 个任务
2. **设计** - 1 个任务
3. **实现** - 3 个任务
4. **验证** - 2 个任务

---

_创建于: 2026-01-24 | 最后更新: 2026-01-24_

## Review

> [REVIEW:blocking] 无阻塞问题。
>
> [RESPONSE] 确认无阻塞问题，所有安全审查问题已修复。任务进展顺利，进入最终验证阶段。
> [STATUS:resolved] > [REVIEW:suggestion] `account-actions-with-credential.ts` 中的 `listAccounts` 只返回理财账户，可能导致其他账户类型不可见。建议整合所有账户类型（unified、spot、futures、earning）到同一个提供者中，或确保 exchange 服务与账户服务的一致性。
>
> [RESPONSE] 这是一个合理的架构建议。当前实现保持与 vendor-okx 相同模式，为理财账户提供独立服务。这种设计简化了实现，并且与 Gate.io 理财 API 的独立性保持一致。未来如果需要统一账户视图，可以在上层通过账户组合器（account-composer）整合多个账户提供者，而不是修改底层服务。
> [STATUS:resolved] > [REVIEW:suggestion] `earning.ts` 中的 `freeVolume` 计算应考虑冻结金额大于总额的边缘情况，使用 `Math.max(0, +balance.amount - frozen)`。
>
> [RESPONSE] 已修复。在 `earning.ts` 第 87 行使用了 `Math.max(0, +balance.amount - frozen)` 确保 free_volume 不为负数。
> [STATUS:resolved] > [REVIEW:suggestion] 测试文件中有重复的 `TC4` 标签，应重命名为 `TC5`。
>
> [RESPONSE] 已修复。将重复的 `TC4` 标签重命名为 `TC5`，保持测试标签的唯一性。
> [STATUS:resolved] > [REVIEW:suggestion] `getSpotPrice` 可能需要扩展特殊币种映射，但当前已处理 SOL2 和 GTSOL。
>
> [RESPONSE] 已处理。在 `earning.ts` 的 `getSpotPrice` 中实现了特殊币种映射：SOL2 和 GTSOL 都映射到 SOL_USDT 对。
> [STATUS:resolved]

> [REVIEW:security]
>
> ## 安全审查报告
>
> **审查时间**: 2026-01-24
> **审查文件**:
>
> - `apps/vendor-gate/src/api/private-api.ts`
> - `apps/vendor-gate/src/api/http-client.ts`
> - `apps/vendor-gate/src/services/accounts/earning.ts`
> - `apps/vendor-gate/src/services/account-actions-with-credential.ts`
>
> **结论**: FAIL
>
> **Blocking 列表**:
>
> 1. **日志泄露敏感认证信息** - `http-client.ts` 第 118 行 `console.info` 打印完整 headers，包含 `KEY` (access_key) 和 `SIGN` (HMAC 签名)。即使 access_key 不视为秘密，在生产日志中暴露认证凭据仍违反最小权限原则，且 SIGN 可能被用于重放攻击（结合相同时间戳）。
> 2. **缺乏请求超时控制** - `fetch` 调用未设置超时，恶意或故障的 API 端点可能导致挂起请求累积，最终耗尽 Node.js 的可用连接/内存资源。
> 3. **并发请求未限制** - `earning.ts` 中 `Promise.all(balances.map(...))` 会对每个余额并发调用 `getSpotPrice`，若用户持有大量币种（如 >50），将瞬间发起大量 HTTP 请求，可能触发服务端限流或本地资源耗尽。
> 4. **错误响应日志可能包含敏感数据** - `http-client.ts` 第 60-66 行在 JSON 解析失败时记录整个响应文本，若响应体包含用户隐私信息（如余额、地址等），会在非 DEBUG 环境下仍被输出。
> 5. **输入验证缺失** - `private-api.ts` 中 `getEarnBalance` 等函数的参数（如 `limit`、`page`）未做合理性校验，允许传入极大值（如 limit=10000），可能导致服务端负载过高或响应数据过大耗尽内存。
>
> **修复建议**:
>
> 1. **敏感信息日志过滤** - 在 `http-client.ts` 的 `console.info` 中移除 `KEY` 和 `SIGN` 头部的输出，或使用掩码（如 `KEY: ***`）。建议仅记录请求方法、路径和 timestamp。
> 2. **添加请求超时** - 使用 `AbortController` 为 `fetch` 设置超时（例如 30 秒），超时后取消请求并抛出明确错误。
> 3. **限制并发数** - 在 `earning.ts` 中使用 `p-limit` 或自定义并发池，将 `getSpotPrice` 的并发数限制为合理值（如 5-10）。
> 4. **错误日志脱敏** - 在非 DEBUG 环境下，错误响应日志应只记录状态码和错误摘要，而非完整响应体。可增加环境变量开关控制敏感日志输出。
> 5. **输入参数校验** - 对 `limit`、`page` 等参数添加范围检查（例如 limit ∈ [1, 1000]），对 `currency` 等字符串参数验证格式（只允许字母数字）。
> 6. **路径遍历防护** - 对 `quote_currency`、`settle` 等用于构建 URL 路径的参数进行严格校验，只允许预定义的枚举值或匹配正则 `^[A-Za-z0-9]+$`。
> 7. **安全默认配置** - 建议默认关闭 DEBUG 日志，生产环境必须设置 `LOG_LEVEL` 非 DEBUG 以避免敏感信息泄露。
>
> **非 Blocking 问题**:
>
> - 凭证权限过大：理财账户仅需只读权限，但当前使用的 `access_key`/`secret_key` 可执行提现、交易等高危操作。建议文档中说明应使用仅限读取理财余额的子账户 API 密钥（如支持）。
> - 时钟偏移风险：签名使用本地时间戳，若服务器时钟不同步可能导致认证失败。可考虑在失败时重试并自动校准时间戳。
> - 依赖版本风险：定期更新 `@yuants/utils` 等依赖以获取安全补丁。
>
> **SUBTREE_ROOT 合规性检查**: 所有代码改动均在 `apps/vendor-gate/` 目录内，未发现越界改动。
>
> **后续步骤**: 建议在合并前修复上述 Blocking 问题，尤其是日志泄露和超时控制。
>
> _安全审查完成_
>
> [RESPONSE] 已修复所有 blocking 安全问题：
>
> 1. **日志泄露**：修改 `http-client.ts`，过滤 KEY 和 SIGN 头部为 `***`。
> 2. **请求超时**：为 `requestPrivate` 和 `requestPublic` 添加 30 秒超时控制（使用 AbortController）。
> 3. **并发限制**：在 `earning.ts` 中实现并发限制器，将 `getSpotPrice` 并发数限制为 5。
> 4. **错误日志脱敏**：修改 `parseJSON`，非 DEBUG 模式下只打印响应摘要（前 100 字符）。
> 5. **输入验证**：在 `getEarnBalance` 中添加参数校验（currency 格式、page 正整数、limit 范围 1-1000）。
>
> 此外，修复了 `free_volume` 计算使用 `Math.max(0, amount - frozen)` 防止负数。
>
> 修复已通过 TypeScript 类型检查，确保向后兼容。
> [STATUS:resolved]
