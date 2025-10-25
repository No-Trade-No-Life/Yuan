# @yuants/protocol

`@yuants/protocol` 定义了 Yuan 体系的终端通信协议、数据模型与运行时，封装 WebSocket / WebRTC 渠道、请求路由与指标采集，帮助业务终端以统一方式接入 Host。

- **统一抽象**：`Terminal` 将连接、服务、频道、指标等能力整合为一个可插拔容器，业务只需少量代码即可上线。
- **智能寻址**：`TerminalClient` 基于 JSON Schema 自动筛选可用终端，内建随机负载均衡与断线重试逻辑。
- **自描述生态**：`TerminalServer` 通过 `IServiceInfo` 广播接口契约，Host 即时感知终端能力，实现零配置编排。
- **双通道容错**：同时支持 WebSocket 与 WebRTC，自动降级回退，保障大流量与跨网络场景稳定。
- **可观测性先行**：默认集成 Prometheus，终端伸缩、性能瓶颈一目了然。

## 快速上手

```ts
import { Terminal } from '@yuants/protocol';
import { JSONSchema7 } from 'json-schema';
import { interval } from 'rxjs';

const terminal = Terminal.fromNodeEnv(); // 需预先配置 HOST_URL、TERMINAL_ID 等环境变量

type PingRequest = { message: string };
const schema: JSONSchema7 = {
  type: 'object',
  required: ['message'],
  properties: { message: { type: 'string' } },
};

terminal.server.provideService<PingRequest, { echo: string }>('Ping', schema, async (msg) => {
  return [{ res: { code: 0, message: 'OK', data: { echo: msg.req.message } } }];
});

terminal.channel.publishChannel('Heartbeat', { const: '' }, () => interval(1000));

(async () => {
  const res = await terminal.client.requestForResponseData<PingRequest, { echo: string }>('Ping', {
    message: 'hello',
  });
  console.log(res.echo);
})();
```

## 功能模块

### 核心运行时

- `Terminal`：终端进程的核心容器，负责管理与 Host 的双向隧道、维护 `input$` / `output$` 流、同步 `terminalInfo`、导出 `client`、`server`、`channel` 等子模块，并提供 `dispose()`、`dispose$` 与 `Terminal.fromNodeEnv()` 等辅助能力。
- `TerminalServer`：驻留在终端侧的服务注册器，通过 `provideService()`/`addService()` 管理业务服务，并维护限流、排队与处理状态。
- `TerminalClient`：面向终端内部的请求发起器，提供 `request()`、`requestService()`、`requestForResponse()`、`requestForResponseData()`、`resolveTargetTerminalIds()` 等方法，用于向其它终端或自身服务发起 RPC。
- `TerminalChannel`：频道管理器，使用 `publishChannel()` 发布可订阅数据流，以 `subscribeChannel()` 实现多播与断线重连的订阅。

### 连接与传输

- `IConnection`：抽象终端与 Host 之间的输入、输出、连接状态与重连通知流，可被自定义传输层复用。
- `createConnectionWs()`：创建带自动重连与消息缓冲的 WebSocket 连接，并以 `IConnection` 接口暴露。
- `createConnectionJson()`：基于 `createConnectionWs()` 进行 JSON 序列化封装，让输入输出直接以对象形式传递。

### 数据模型与类型

- `IServiceInfo`：描述服务的 `service_id`、`method` 与 JSON Schema，用于在终端间广播能力声明。
- `ITerminalInfo`：终端对外发布的元信息集合，包括 `terminal_id`、`serviceInfo`、`tags` 等。
- `IServiceOptions`：定义服务层的并发、排队与令牌桶限流策略。
- `IServiceHandler`：服务处理函数签名（内部使用），接收请求上下文并返回响应/流帧。
- `IServiceInfoServerSide`：终端内部保存的服务运行态（内部使用），包含校验器与处理选项。
- `IServiceCandidateClientSide`：客户端侧缓存的服务候选信息（内部使用），用于请求分发。
- `ITerminalMessage`：终端之间传输的统一消息结构，包含 `trace_id`、`req`、`res`、`frame` 等字段。
- `IResponse`：带有 `code`、`message`、`data` 的标准响应体，广泛用于有副作用的操作。

### 指标与监控

- `GlobalPrometheusRegistry`： 全局 Prometheus 指标注册表，预定义多项终端与服务相关指标，供终端实例直接使用。
- `terminal.metrics`：终端实例的 Prometheus 指标集合，终端私有指标可通过该对象创建并注册。
- `PromRegistry`：历史遗留的 Prometheus 注册表（已标记为弃用），保留给旧版代码渐进迁移。

### 安全握手与密钥协商

- `setupHandShakeService()`：在终端侧注册 `HandShake` 服务，支持使用 ED25519 私钥验证身份并协商 X25519 对称密钥，返回缓存的共享密钥映射。
- `requestSharedKey()`：向远端终端发起握手请求，验证返回签名后获取双向的 X25519 公私钥与 Base58 编码的共享密钥。

## 使用建议

- 建议通过环境变量配置 `HOST_URL`、`TERMINAL_ID` 等参数，并统一使用 `Terminal.fromNodeEnv()` 创建终端实例。
- 为保证类型安全，请在 `provideService()` 时提供完整的 JSON Schema，终端客户端会利用它自动选择匹配的服务实例。
