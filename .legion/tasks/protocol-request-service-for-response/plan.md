# protocol-request-service-for-response

TITLE: 在 @yuants/protocol 增加 requestServiceForResponse HTTP util
SLUG: protocol-request-service-for-response

## 问题定义

当前如果要通过 Host 的 `POST /request` 调用内部 service，需要调用方自行拼装 fetch 请求与 NDJSON 解析逻辑。目标是在 `@yuants/protocol` 提供一个通用 util，支持直接传入 `credential`（当前含 `host_url`）和 `{ method, req }`，返回最终 `res`，且不创建 `Terminal` 对象。

## 验收标准

1. 在 `libraries/protocol` 暴露 `requestServiceForResponse`。
2. 方法签名满足：第一个参数为 `credential`（至少含 `host_url`），第二个参数为 `{ method, req }`。
3. 内部仅使用 `fetch` 调用 `host_url + /request`，不创建 `Terminal`。
4. 能从 Host 的 NDJSON 响应中提取并返回 `res`（暂不处理流式 frame）。
5. 协议包构建通过（含 API Extractor）。

## 假设

- Host `/request` 的返回格式保持为每行一个 JSON message（NDJSON）。
- 当前 `host_url` 由调用方提供为可直接调用的 host origin；未来新增鉴权字段时仅扩展 `credential` 类型，不改函数主流程。

## 约束

- Scope 仅限 `libraries/protocol/**` 与任务文档。
- 不改 Host 端协议与路由行为。
- 不引入新依赖。

## 风险分级

- **等级：Medium**
- **理由：** 本次新增的是 `@yuants/protocol` 公共 API（共享库对外契约变更），虽然实现简单可回滚，但仍涉及对外接口扩展与错误语义约定。

## 目标

提供一个最小、可复用的 HTTP util，降低调用 `/request` 的接入成本，并与 `requestForResponse` 的返回语义保持一致。

## 要点

- 入参分为 `credential` 与 `req` 两块，保留未来 credential 扩展位。
- 只关心最终 `res`，忽略 frame 流。
- 异常场景（HTTP 非 2xx、无 res）给出明确错误/默认返回。

## 范围（允许改动）

- `libraries/protocol/src/**`
- `libraries/protocol/etc/protocol.api.md`（由构建自动更新时）
- `.legion/tasks/protocol-request-service-for-response/**`

## Design Index

- RFC: `.legion/tasks/protocol-request-service-for-response/docs/rfc.md`
- RFC Review: `.legion/tasks/protocol-request-service-for-response/docs/review-rfc.md`

## 阶段概览

1. 设计（RFC + review-rfc）
2. 实现（engineer）
3. 验证（run-tests）
4. 代码评审（review-code，必要时 review-security）
5. 报告产出（report-walkthrough + pr-body）

---

_创建于: 2026-03-15 | 最后更新: 2026-03-15_
