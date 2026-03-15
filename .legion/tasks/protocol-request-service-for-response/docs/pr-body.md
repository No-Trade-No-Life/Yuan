## What

- 在 `@yuants/protocol` 新增 `requestServiceForResponse`，提供 `credential + { method, req }` 的最小 HTTP 调用入口。
- 新增实现文件并在 `src/index.ts` 导出，`protocol.api.md` 已同步反映公共签名。
- 行为语义与设计保持一致：解析 Host `/request` 的 NDJSON，命中首个 `res` 返回；无 `res` 返回 `NO_RESPONSE`。

## Why

- 解决调用方重复手写 fetch + NDJSON 解析的问题，降低接入成本与重复实现。
- 统一错误语义与默认返回，避免各调用点行为不一致。
- 在不引入 Terminal 对象的前提下，提供更轻量的 service 请求能力。

## How

- 新增 `libraries/protocol/src/request-service-for-response.ts`：
  - 参数校验（`host_url`、`method`、`req`）
  - `fetch(new URL('/request', host_url))` 调用
  - NDJSON 逐行解析与 `res` 提取
  - 超时（30s）与响应体大小上限（1 MiB）保护
- 修改 `libraries/protocol/src/index.ts` 公开导出。
- 通过构建更新 `libraries/protocol/etc/protocol.api.md`。

## Testing

- 测试报告：`.legion/tasks/protocol-request-service-for-response/docs/test-report.md`
- 执行命令：`workdir=/Users/zccz14/Projects/Yuan/libraries/protocol npm run build`
- 结果：PASS（build/test/api-extractor/post-build 完整通过，API Extractor 无阻断错误）。

## Risk / Rollback

- 风险：Medium（新增公共 API，后续需关注错误细节与协议语义兼容）。
- 回滚：删除新增 util 与 index 导出，重新构建并同步回退 `protocol.api.md`；不影响既有 Terminal 路径。

## Links

- Plan: `.legion/tasks/protocol-request-service-for-response/plan.md`
- RFC: `.legion/tasks/protocol-request-service-for-response/docs/rfc.md`
- Review RFC: `.legion/tasks/protocol-request-service-for-response/docs/review-rfc.md`
- Review Code: `.legion/tasks/protocol-request-service-for-response/docs/review-code.md`
- Review Security: `.legion/tasks/protocol-request-service-for-response/docs/review-security.md`
- Walkthrough: `.legion/tasks/protocol-request-service-for-response/docs/report-walkthrough.md`
