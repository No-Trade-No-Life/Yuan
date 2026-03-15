# Walkthrough：`requestServiceForResponse` 实现报告

## 1) 目标与范围（绑定 scope）

本任务目标是在 `@yuants/protocol` 提供一个无需创建 `Terminal` 的 HTTP util：
`requestServiceForResponse(credential, { method, req })`，用于直接调用 Host 的 `POST /request` 并返回最终 `res`。

本次改动严格限定在以下 scope：

- `libraries/protocol/src/request-service-for-response.ts`
- `libraries/protocol/src/index.ts`
- `libraries/protocol/etc/protocol.api.md`

## 2) 设计摘要（RFC 链接）

设计依据：

- RFC：`.legion/tasks/protocol-request-service-for-response/docs/rfc.md`
- RFC 审查：`.legion/tasks/protocol-request-service-for-response/docs/review-rfc.md`

落地遵循 RFC 主路径：

1. 校验 `credential.host_url` 与请求 envelope（`method`、`req`）。
2. 使用 `fetch(new URL('/request', host_url))` 发起 `POST`。
3. 读取并按 NDJSON 逐行解析响应，命中首个 `res` 即返回。
4. 若流结束未出现 `res`，返回 `{ code: 'NO_RESPONSE', message: 'No Response Received' }`。
5. 统一错误语义：`INVALID_ARGUMENT` / `NETWORK_ERROR` / `HTTP_ERROR` / `PROTOCOL_PARSE_ERROR`。

## 3) 改动清单（按模块/文件）

### A. `libraries/protocol/src/request-service-for-response.ts`（新增核心实现）

- 新增公开类型：
  - `IRequestServiceCredential`（当前至少含 `host_url`，保留扩展位）
  - `IRequestServiceReq<TReq>`（`method` + `req`）
- 新增主函数：
  - `requestServiceForResponse<TReq, TRes>(credential, req): Promise<IResponse<TRes>>`
- 实现关键能力：
  - `host_url` origin-only 校验（拒绝 path/query/hash）
  - 传输策略：默认 `https`，仅放行本地回环 `http`
  - `req` 结构校验与 `JSON.stringify` 可序列化预检
  - 请求超时控制（30s）
  - 响应体字节上限保护（1 MiB，按流累计）
  - NDJSON 行解析（兼容 CRLF/空行，遇首个 `res` 返回）
  - 无 `res` 默认返回 `NO_RESPONSE`
  - 错误码与上下文字段统一封装

### B. `libraries/protocol/src/index.ts`（公共导出）

- 新增导出：`export * from './request-service-for-response';`
- 使新 util 进入 `@yuants/protocol` 公共 API 面。

### C. `libraries/protocol/etc/protocol.api.md`（API 报告）

- API Extractor 报告已更新，包含：
  - `IRequestServiceCredential`
  - `IRequestServiceReq`
  - `requestServiceForResponse` 函数签名

## 4) 如何验证（命令 + 预期）

验证依据文档：`.legion/tasks/protocol-request-service-for-response/docs/test-report.md`

- 执行命令：
  - `workdir=/Users/zccz14/Projects/Yuan/libraries/protocol npm run build`
- 预期结果：
  1. 命令退出码为 0（PASS）。
  2. build/test/api-extractor/post-build 全链路完成。
  3. API Extractor 无阻断错误，`protocol.api.md` 出现新导出签名。
  4. 测试阶段允许 `No tests found, exiting with code 0`（本次无失败用例）。

补充评审参考：

- 代码审查：`.legion/tasks/protocol-request-service-for-response/docs/review-code.md`（PASS）
- 安全审查：`.legion/tasks/protocol-request-service-for-response/docs/review-security.md`（PASS）

## 5) 风险与回滚

### 风险

- 风险等级：**Medium**（公共 API 扩展）。
- 主要风险点：
  - 新增导出被外部依赖后，错误细节字段或安全策略调整需保持兼容。
  - 当前按“首个含 `res` 即返回”，未来若协议扩展为多阶段响应需避免语义漂移。

### 回滚

若上线后出现兼容问题，可执行最小回滚：

1. 移除 `src/request-service-for-response.ts` 新增实现。
2. 回退 `src/index.ts` 导出。
3. 重新构建并同步回退 `etc/protocol.api.md`。

该回滚不影响既有 Terminal 路径。

## 6) 未决项与下一步

未决项：

1. 是否在 util 层增加 `res` 最小结构校验（如 `code/message`）以减少误解析。
2. 是否在错误详情中补充机器可判定字段（如 `isTimeout`、`reason`）。
3. 是否为调用链预留 `requestId/traceId` 透传能力。

下一步建议：

1. 以当前实现先合入（review-code / review-security 均为 PASS）。
2. 在后续增量任务中处理非阻塞建议，并补充对应测试用例。
3. 在 README/API 文档显式声明 `host_url` 安全约束（origin-only、默认 HTTPS）。
