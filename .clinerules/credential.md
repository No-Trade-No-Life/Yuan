# 基于 Credential 的规则

本规则文件定义了如何使用 Credential（凭证）来管理和应用访问控制策略。通过配置不同的 Credential，可以实现对资源的细粒度控制，确保只有授权用户能够访问特定的资源。

Credential 用于进行外部 API 调用时的身份验证和授权。每个 Credential 包含必要的认证信息，如 API 密钥、令牌或用户名和密码。

Credential vs TypedCredential

1. Credential 具体的结构由 vendor 定义，不同的 vendor 可能有不同的字段和格式。
2. TypedCredential 是一种经过包装的 Credential，包含了类型信息，便于区分不同类型的凭证，并且自动路由这些凭证到相应的处理逻辑中。

外部服务提供商 vendor 在使用 Credential 时需要遵循以下规则：

1. vendor 负责定义 Credential 的具体结构和字段。
2. vendor 负责包装外部 API 变为 Yuan Service，其请求参数中必须包含 credential: TypedCredential 字段。type 字段与 vendor 名字一致，用于路由。
3. vendor 是无状态的服务，不负责 Credential 的存储和管理，这些职责由 Yuan 系统的其他部分承担。
4. vendor 不能自行调用自身服务，在无外部请求时，必须保持静默，不占用资源。
5. vendor 可以使用 cache (from @yuants/cache) 来优化性能。

外部服务商 vendor 的实现层级次分为：设备层、API 层和服务层。

设备层: 负责处理底层的网络请求。很多情况下可以忽略这层。如有，代码全部放入 `src/device` 目录下。

1. 设备层负责发送 HTTP 请求、建立 WebSocket 连接，或者建立其他类型的网络连接。
2. 实现了自定义设备层的 vendor，需要向 Terminal 注册自身的公网 IP，以便 client 进行访问。
3. 设备层需要处理 IP，对于外部系统而言，IP 可能会影响访问权限和速率限制。
4. 设备层对于根据 IP 进行速率限制的 API 特别关键。
5. 如果外部服务限制了必须从某个 IP 范围访问，甚至锁定了设备指纹，设备层需要确保请求从正确的设备发出。
6. 如果是非 HTTP、WebSocket 协议，设备层需要额外处理细节。

API 层: 负责根据 vendor 要求的应用层协议进行通讯。不与 Terminal 直接交互。代码全部放入 `src/api` 目录下。

1. 公共 Req/Res API 层: 负责发送请求到外部服务，无需鉴权，
   - 函数签名类型 `(params: {...}) => Promise<...>`
2. 私有 Req/Res API 层: 比公共 API 层的函数要额外处理鉴权逻辑
   - 函数的第一个参数为 Credential
   - 函数签名类型 `(credential: Credential, params: {...}) => Promise<...>`。
3. 公共 Subscribe API 层: 如果涉及到订阅类型的 API，例如 WebSocket API:
   - 函数签名类型 `(params: {...}) => Observable<{ ... }>`
   - 要求使用 RxJS 库来实现响应式编程。
   - 必须确保在订阅结束后正确关闭连接，避免资源泄漏。
4. 私有 Subscribe API 层: 如果涉及到订阅类型的 API，并且需要鉴权，例如 WebSocket API:
   - 函数签名类型 `(credential: Credential, params: {...}) => Observable<{ ... }>`
   - 要求使用 RxJS 库来实现响应式编程。
   - 必须确保在订阅结束后正确关闭连接，避免资源泄漏。

服务层: 服务层的代码会开始和 Terminal 进行交互，使用 terminal.server.provideService 方法来注册服务。代码全部放入 `src/services` 目录下。

对于交易所 vendor 而言，服务层需要区分三类服务：

1. 公共数据服务，Free Style，完全不涉及 Credential
2. 账户相关服务，通过 Credential 进行鉴权和授权，集成 `@yuants/data-account` 中的 `provideAccountActionsWithCredential` 方法。
   - listAccounts: 列出 Credential 下的所有账户
   - getAccountInfo: 获取特定 (Credential, account_id) 的账户信息 (资金、持仓)
3. 交易相关服务，通过 Credential 进行鉴权和授权，集成 `@yuants/data-order` 中的 `provideOrderActionsWithCredential` 方法。
   - submitOrder: 提交订单
   - modifyOrder: 修改订单
   - cancelOrder: 取消订单
   - listOrders: 获取活跃的订单列表

非交易所 vendor 的服务层可以根据实际需求进行设计，但必须确保所有需要鉴权的操作都通过 Credential 进行。

- 例如 Email 服务商的服务层可能只包含发送邮件 (SMTP)，和 接收邮件 (IMAP/POP3) 的功能。
- 例如 Feishu 服务商的服务层会包含非常多的 API 服务，同样需要通过 Credential 进行鉴权。
- 例如 AI 服务商的服务层会包含文本生成、图像生成等 API 服务，同样需要通过 Credential 进行鉴权。

通过以上规则，Credential 可以有效地管理和控制对外部资源的访问，确保系统的安全性和可靠性。
