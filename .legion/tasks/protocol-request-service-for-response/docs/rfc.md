# RFC：在 @yuants/protocol 增加 `requestServiceForResponse` HTTP 工具

## 摘要 / 动机

当前调用方若要通过 Host 的 `POST /request` 调用内部 service，需要重复处理三件事：拼装 HTTP 请求、逐行解析 NDJSON、提取最终 `res`。这导致接入成本高且错误语义不一致。

本 RFC 提议在 `@yuants/protocol` 新增 `requestServiceForResponse`，以最小 API 完成“入参即 credential + 请求体，出参即 `res`”的调用闭环；不创建 `Terminal`，只走 `fetch(host_url + /request)`。

## Goals / Non-Goals

### Goals

1. 暴露通用 util：`requestServiceForResponse(credential, { method, req }) => Promise<IResponse<TRes>>`。
2. 内部实现只允许 `fetch` 调用 Host `/request`。
3. 兼容 Host NDJSON 输出，提取并返回首个 `res`。
4. 当未收到 `res` 时，返回与 `TerminalClient.requestForResponse` 一致的默认值：
   - `code: 'NO_RESPONSE'`
   - `message: 'No Response Received'`

### Non-Goals

1. 不处理流式 frame（仅忽略 `frame`，不向外暴露）。
2. 不引入 Terminal / WebSocket / 服务发现逻辑。
3. 不改 Host 协议与 `/request` 路由行为。
4. 不引入新依赖。

## 定义

- **credential**：当前至少包含 `host_url` 的对象；后续可扩展鉴权字段。
- **request envelope**：`{ method, req }`，用于描述服务方法与请求体。
- **NDJSON**：每行一个 JSON 对象；每个对象可能包含 `res` 或 `frame`。

## 方案设计（端到端流程与边界）

### 组件边界

1. `request-service-for-response.ts`（新增）
   - 职责：参数校验、HTTP 调用、NDJSON 解析、`res` 抽取、错误归一。
2. `index.ts`（修改）
   - 职责：导出新 util（公共 API）。
3. `protocol.api.md`（构建产物）
   - 职责：反映新导出签名。

### 端到端流程

1. 校验 `credential.host_url`、`method`。
2. 按固定算法拼接 URL：`new URL('/request', host_url)`，发送 `POST`，body 为 `{ method, req }`。
3. 校验 HTTP 状态码：非 2xx 立即失败。
4. 将响应 body 按 NDJSON 固定规则解析为 JSON 行对象。
5. 遇到对象含 `res` 字段时立即返回该 `res`。
6. 到流结束仍无 `res` 时，返回默认 `NO_RESPONSE`。

> 约定优于配置：默认 `Content-Type: application/json`；不在本阶段开放可配置 headers。

### NDJSON 解析固定规则（MUST）

1. 解析输入按 `\n` 分行。
2. 每行先去掉末尾 `\r`（兼容 CRLF）。
3. 空行直接跳过（含末尾换行产生的空行）。
4. 仅当“非空行 JSON.parse 失败”时抛 `PROTOCOL_PARSE_ERROR`。
5. 行顺序保持原始顺序，遇到首个包含 `res` 的行即返回。

## 备选方案

### 方案 A（采用）：独立 HTTP util（函数式）

- 优点：实现最小、无连接状态、无 Terminal 依赖、易测试。
- 缺点：功能覆盖仅限单次请求响应。

### 方案 B（不采用）：复用/包装 `TerminalClient.requestForResponse`

- 放弃原因：会隐式创建 Terminal 或依赖终端路由，违反“不得创建 Terminal 对象”约束；接入面更重。

## 数据模型 / 接口

```ts
export interface IRequestServiceCredential {
  host_url: string;
  [k: string]: unknown; // 预留鉴权扩展
}

export interface IRequestServiceReq<TReq = unknown> {
  method: string;
  req: TReq;
}

export declare function requestServiceForResponse<TReq = unknown, TRes = void>(
  credential: IRequestServiceCredential,
  req: IRequestServiceReq<TReq>,
): Promise<IResponse<TRes>>;
```

约束与兼容策略：

1. `credential.host_url` 必填且为非空字符串。
2. `credential.host_url` 必须是 **origin 形态**（仅 `http(s)://host[:port]`），包含 path/query/hash 直接视为非法参数。
3. 传输安全默认策略（MUST）：默认仅允许 `https:`；`http:` 仅允许 `localhost` / `127.0.0.1` / `::1`。
4. 最终请求地址必须按 `new URL('/request', host_url)` 计算，禁止其它拼接方式。
5. `req.method` 必填且为非空字符串。
6. `req` 字段必须存在（允许 `null`，不允许缺失）。
7. 发送前必须执行 `JSON.stringify({ method, req })` 预检；若序列化失败（如循环引用）抛 `INVALID_ARGUMENT`。
8. 未来新增 credential 字段时，仅扩展 `IRequestServiceCredential`，不改函数参数结构（保持二段式入参）。

## 错误语义（可恢复性 / 重试语义）

错误抛出采用统一最小契约（MUST）：

```ts
type RequestServiceErrorCode = 'INVALID_ARGUMENT' | 'HTTP_ERROR' | 'PROTOCOL_PARSE_ERROR' | 'NETWORK_ERROR';

type RequestServiceError = Error & { code: RequestServiceErrorCode };
```

允许实现方式：

```ts
throw Object.assign(new Error(message), { code: 'INVALID_ARGUMENT' as const });
```

具体语义：

1. **参数错误（不可重试）**：`host_url`/`method` 缺失或非法、`req` 缺失、序列化失败，抛 `INVALID_ARGUMENT`。
2. **HTTP 非 2xx（条件可重试）**：抛 `HTTP_ERROR`（附带 `status/statusText`）；5xx 可重试，4xx 默认不重试。
3. **网络异常（可重试）**：`fetch` 失败抛 `NETWORK_ERROR`（附带 method/host 上下文）。
4. **NDJSON 解析失败（通常不可重试）**：响应格式不合法时抛 `PROTOCOL_PARSE_ERROR`。
5. **无 res（可按业务重试）**：不抛错，返回 `{ code: 'NO_RESPONSE', message: 'No Response Received' }`。
6. **超时/响应体超限（条件可重试）**：
   - 默认请求超时 30s，超时抛 `NETWORK_ERROR`。
   - 默认响应体上限 1 MiB，超限抛 `HTTP_ERROR`。

## 安全性考虑

1. **输入校验**：严格校验 `host_url` 与 `method`，避免无效 URL/空方法名导致误请求。
2. **滥用防护**：仅允许目标路径 `/request`，避免被 credential 注入任意路径。
3. **资源耗尽**：默认 30s 请求超时 + 1 MiB 响应体上限，防止慢响应/超大响应导致资源占用。
4. **敏感信息保护**：错误上下文不返回原始 URL 凭证（userinfo），仅记录脱敏 host 信息。
5. **最小权限**：不在库中持久化 credential，不读取环境变量凭证。

## 向后兼容、发布与回滚

1. **向后兼容**：新增导出，不改现有 API 行为，属于向后兼容扩展。
2. **发布方式**：合入后按 `@yuants/protocol` 常规版本流程发布（含 API Extractor 报告更新）。
3. **灰度策略**：先在单一调用方替换手写 `/request` 逻辑，验证通过后再推广。
4. **回滚策略**：若出现兼容问题，可直接撤回新导出与实现文件；既有 Terminal 路径不受影响。

## 验证计划（行为到测试映射）

1. **成功路径**：Host 返回 NDJSON 含 `res` → 返回该 `res`。
2. **frame 干扰**：先返回若干 `frame` 后才有 `res` → 仍正确返回 `res`。
3. **HTTP 错误**：返回 4xx/5xx → 抛 `HTTP_ERROR` 且可断言 `error.code`。
4. **无响应**：流结束无 `res` → 返回 `NO_RESPONSE` 默认值。
5. **格式异常**：NDJSON 某行非 JSON → 抛 `PROTOCOL_PARSE_ERROR` 且可断言 `error.code`。
6. **参数校验**：缺失 `host_url`、`host_url` 含 path/query/hash、空 `method`、缺失 `req` → 抛 `INVALID_ARGUMENT`。
7. **序列化异常**：`req` 为循环引用对象 → 抛 `INVALID_ARGUMENT`。
8. **兼容行边界**：CRLF/空行/末尾换行输入可正常解析。
9. **传输安全策略**：`http://example.com` 拒绝；`https://example.com` 通过；本地回环 `http://localhost` 可通过。
10. **资源保护策略**：慢响应触发超时、超大响应触发 body-limit 错误。
11. **公共导出**：`index.ts` 导出可被 API Extractor 捕获。

## Open Questions

1. 若未来需要鉴权 header，是否统一约定 credential 字段到 header 的映射规则？

## Plan（落地执行清单）

### 文件变更点

1. `libraries/protocol/src/request-service-for-response.ts`
   - 新增主函数与本地类型定义、NDJSON 解析与错误处理。
2. `libraries/protocol/src/index.ts`
   - 导出 `requestServiceForResponse`。
3. `libraries/protocol/etc/protocol.api.md`
   - 构建后更新 API 报告（自动产物）。

### 验证步骤

1. 在 `libraries/protocol` 执行构建：`npm run build`（或等价 Rush 流程）。
2. 确认 API Extractor 无新增错误，`protocol.api.md` 出现新函数签名。
3. 运行新增/现有测试，覆盖上述 6 条关键行为。
