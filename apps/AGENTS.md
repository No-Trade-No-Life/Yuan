name: yuan-apps
description: 面向 apps/ 目录的 Credential 架构准则，是 vendor 服务实现的唯一来源。

---

# apps/ 目录 Agent 指南（Credential 版）

> 本文档约束所有 vendor / service 类型的 app 如何声明、传递与使用 TypedCredential。

---

## 1. 你的角色

- 你负责把业务能力封装成 Yuan Terminal 可调用的独立 app，可能是 vendor、copier、转账、监控、CLI 或其他服务。
- 对所有 app：凡涉及鉴权，必须统一使用 `TypedCredential` 透传凭证，并保持实现无状态。
- (vendor only) 你把外部服务（交易所、消息渠道、链上节点等）包装成统一的账户/下单/行情/转账服务，为 `trade-copier`、转账链路等提供一致体验。

---

## 2. 推荐目录结构（vendor only）

```
src/
├── index.ts                        # 仅负责 import 各类 services，入口无业务逻辑
├── cli.ts                          # （选）只 `import './index'`
├── device/                         # （选）封装自研连接/代理/速率控制
├── api/
│   ├── public-api.ts               # 无需凭证的 REST/WebSocket helper
│   └── private-api.ts              # (vendor only) 显式接收 credential 的 helper
├── services/
│   ├── legacy.ts                   # 兼容旧入口的聚合层
│   ├── account-actions-with-credential.ts
│   ├── order-actions-with-credential.ts
│   ├── orders/                     # submit/cancel/list 等 handler 拆分存放
│   ├── markets/
│   │   ├── product.ts              # 公共产品目录写入/发布
│   │   ├── quote.ts                # 行情频道、SQL 写入
│   │   └── interest-rate.ts        # 资金费率/市场数据
│   └── transfer.ts                 # 转账/提现状态机（如需）
└── e2e/                            # 提交订单、转账等验收脚本
```

> 可按 app 职责裁剪，但需满足：入口只聚合、逻辑模块化、API/设备/服务分层，并让 CLI 与常驻进程复用 `services/*`。

---

## 3. Credential 总览

1. **Credential**：由具体 vendor 或服务定义的原始字段集合（API Key、地址、Token 等）。
2. **TypedCredential**：在 Credential 外层附加 `type` 字段（通常与 app/vendor 名一致），供 Terminal 路由与校验。
3. 所有 `provideService`/`provideAccountActionsWithCredential`/`provideOrderActionsWithCredential` 都只能接收 TypedCredential，禁止绕过。

### 3.1 通用规则

- 每个 app 自行定义/导出 Credential 结构体，并在 handler 中做 schema 校验。
- 服务请求参数必须显式包含 `credential: TypedCredential`，方便多账户/多租户复用。
- app 保持无状态：不持久化 Credential，响应结束后清理缓存/连接。
- 闲置时不得自发调度任务；只有在 Terminal 或 CLI 调用时才占用资源。
- 可以通过 `@yuants/cache` 缓存外部响应，但 key 至少包含 Credential + 请求参数，确保隔离。

---

## 4. 三层实现架构

### 4.1 设备层 (`src/device`, 可选)

- 封装原始网络访问：HTTP 客户端、WebSocket 管理、代理、速率限制、固定出口 IP 等。
- (vendor only) 若交易所要求指定 IP 或设备指纹，需在此层处理并在 `SESSION_NOTES` 记录依赖。

### 4.2 API 层 (`src/api`)

- **公共请求/响应**：`(params) => Promise<Result>`，无需 Credential。
- **私有请求/响应**：`(credential, params) => Promise<Result>`，第一个参数永远是 Credential。
- **公共订阅**：`(params) => Observable<Event>`，用 RxJS 管理生命周期。
- **私有订阅**：`(credential, params) => Observable<Event>`，订阅结束必须关闭连接，防止泄漏。
- 建立 API 层时，鼓励使用柯里化技术，将 Credential 作为最后一层参数进行封装，例如：
  ```typescript
  const createApi =
    (baseURL: string) =>
    <TReq, TRes>(method: string, endpoint: string) =>
    (credential: ICredential, params: TReq) =>
      request<TRes>(credential, method, baseURL, endpoint, params);
  ```

### 4.3 服务层 (`src/services`)

- 所有 Terminal 接口通过 `terminal.server.provideService` 暴露，只负责编排与参数校验。
- 按领域拆分 `services/<domain>`（accounts/orders/markets/transfer/diagnostics 等），便于复用与测试。
- (vendor only) 至少划分三类服务：
  1. **公共数据**：提供行情/产品/资金费率 Channel，不需要 Credential；
  2. **账户服务**：对接 `@yuants/data-account` 的 `provideAccountActionsWithCredential`，输出账户快照、持仓、权益等；
  3. **订单服务**：对接 `@yuants/data-order` 的 `provideOrderActionsWithCredential`，实现 `submit/modify/cancel/list` 并记录完整日志。
- 非交易类 app 也要让所有需要鉴权的操作以 Credential 参数显式传入，例如邮箱、IM、AI、内部 RPC。

---

## 5. (vendor only) 服务接口要求速览

| 模块                 | 核心接口/要求                                                            | 关键点                                                                             |
| -------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| 运行期与 API 分层    | `src/index.ts` 仅聚合；`api/public-api.ts` / `api/private-api.ts` 区分   | 私有 API 首参是 Credential，helper 注明官方文档链接；禁止 `any`                    |
| 账户快照             | `provideAccountInfoService`                                              | 覆盖所有账户，字段含方向/持仓量/可用/权益；按限频刷新并 `addAccountMarket`         |
| 挂单列表             | `providePendingOrdersService`                                            | 直接调用官方未成交 API，`product_id` 用 `encodePath`，刷新 ≤5 秒                   |
| 品种目录             | `provideQueryProductsService` 或 SQL writer                              | 至少每小时刷新，写入 `product` 表并保持 `datasource_id` 一致                       |
| 公共行情             | `quote/{datasource_id}/{product_id}` Channel + 可选 SQL 写入             | WebSocket 异常降级 REST，Channel 包含 `last/bid/ask/open_interest/updated_at`      |
| 交易 RPC（默认账户） | 通过缓存凭证注册 `Submit/Cancel`                                         | 记录原始与翻译参数，返回 `{code:0}` 结构，可放在 `services/legacy.ts`              |
| 交易 RPC（凭证化）   | `order-actions-with-credential.ts` + `provideOrderActionsWithCredential` | Schema 校验 `account_id`、`credential.type`，支持多账户/多租户扩展                 |
| 转账接口             | `services/transfer.ts`                                                   | 注册 `addAccountTransferAddress`，实现链上/内部划转状态机，覆盖提现/母子互转       |
| CLI & 运维           | `Terminal.fromNodeEnv()`、统一开关                                       | `cli.ts` 只 import index，沿用 `WRITE_QUOTE_TO_SQL`、`DISABLE_TRANSFER` 等特性开关 |

> 更多速率、命名、UID 生成及验证步骤，请参阅 `docs/zh-Hans/vendor-guide/implementation-checklist.md` 并逐条落实。

---

## 6. Checklist（每次改动前后自检）

- [ ] 是否定义/复用了符合模块命名且有 schema 校验的 `TypedCredential`？
- [ ] API 层函数签名是否把 Credential 放在首参，并提供类型/官方文档引用？
- [ ] 服务层是否按领域拆分，并说明公共/账户/订单（如不适用需注明原因）？
- [ ] 是否避免在 app 内持久化 Credential 或缓存凭证明文？
- [ ] 所有订阅是否在取消/错误时关闭连接并释放资源？
- [ ] 复杂设备层需求（固定 IP、速率限制、代理）是否记录在 `SESSION_NOTES`？
- [ ] (vendor only) 是否完成 implementation checklist 的账户/订单/行情/转账/CLI 验证和 e2e 用例？

---

> `.clinerules/credential.md` 只会引用/摘录本文件的内容，若两者不一致以本文件为准。

```

```
