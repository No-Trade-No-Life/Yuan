# @yuants/app-host

`@yuants/app-host` 是 Yuan 体系中的 Host 管理服务，负责在中心节点上托管多个交易终端（Terminal）连接，并负责在各终端之间转发报文、处理外部 HTTP 请求以及输出监控指标。程序通过 CLI 入口运行，可部署在本地服务器、Docker 或 Kubernetes 集群中。

## 功能概览

- 维持与多个终端的 WebSocket 会话，并在它们之间转发消息。
- 支持通过 `/external/*` 路径将外部 HTTP 请求转交给终端侧自定义处理逻辑。
- 内置 Prometheus 指标上报能力，便于监控运行状态。
- 支持自定义端口与 TLS 证书配置，便于在多种网络环境中部署。

## 快速开始

1. 安装依赖并构建：
   ```bash
   pnpm install
   pnpm --filter @yuants/app-host run build
   ```
2. 启动服务（默认监听 8888 端口）：
   ```bash
   pnpm --filter @yuants/app-host exec node lib/cli.js
   ```
3. 终端侧按照 `@yuants/protocol` 定义建立 WebSocket 连接，即可接入 Host。

在生产环境中，也可以直接使用发布在容器镜像仓库中的 `ghcr.io/no-trade-no-life/app-host` 镜像，或通过 `@yuants/extension` 提供的部署模板生成 Docker Compose / Kubernetes 配置。

## 环境变量

| 变量名          | 默认值  | 说明                                                                                                                                                                  |
| --------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HOST_TOKEN`    | 未设置  | 启用后要求客户端在连接时通过查询参数、`Authorization: Bearer` 字段或 `host_token` 头部传入同名令牌，不匹配将拒绝连接，适用于简单共享密钥认证。src/host-manager.ts:257 |
| `MULTI_TENANCY` | 未设置  | 当设为 `ED25519` 时，Host 会要求连接方提供 `public_key` 与 `signature` 查询参数，并校验签名后以公钥区分租户，实现多租户隔离。src/host-manager.ts:261                  |
| `PORT`          | `8888`  | HTTP / WebSocket 监听端口。若未设置则使用默认值。src/host-manager.ts:332                                                                                              |
| `SSL_KEY_PATH`  | 未设置  | 指向 PEM 格式的私钥文件。与 `SSL_CERT_PATH` 同时配置时，Host 会额外开启 HTTPS / WSS 监听。src/host-manager.ts:333                                                     |
| `SSL_CERT_PATH` | 未设置  | 指向 PEM 格式的证书文件。需与 `SSL_KEY_PATH` 搭配使用。src/host-manager.ts:333                                                                                        |
| `SSL_PORT`      | `18888` | HTTPS / WSS 监听端口，仅当配置了证书与私钥时生效。src/host-manager.ts:338                                                                                             |

> 提示：在容器或 Kubernetes 场景中，可以利用 `apps/host/src/extension.ts` 的部署模板自动注入上述环境变量与端口映射。

## 认证与安全

- **共享密钥模式**：设置 `HOST_TOKEN` 后，客户端需在连接参数中携带相同令牌，否则会收到 401 响应并断开连接。src/host-manager.ts:257
- **多租户模式**：设置 `MULTI_TENANCY=ED25519` 时，Host 会校验 `public_key` 与 `signature` 参数，确保连接来自可信实体，并以公钥作为租户标识。src/host-manager.ts:261
- **TLS 加密**：同时设置 `SSL_KEY_PATH` 与 `SSL_CERT_PATH` 可启用 TLS，加密 HTTP/WSS 流量。src/host-manager.ts:333

## 外部 HTTP 请求转发

所有以 `/external/` 开头的 HTTP 请求会被封装后转发给 Host Terminal，由终端侧自定义逻辑处理响应。可以利用这一机制暴露 REST API、指标或健康检查接口。src/host-manager.ts:290

## 监控

Host 通过 `MetricsMeterProvider` 注册多项指标（如连接建立数量、消息大小直方图等），并在终端通道中发布，便于 Prometheus 或其他监控系统拉取。src/host-manager.ts:37

## 开发与调试

- 使用 `pnpm --filter @yuants/app-host run build` 触发 Heft + API Extractor 构建流程。
- 若需调试源代码，可运行 `pnpm --filter @yuants/app-host exec ts-node src/index.ts`（需本地安装 `ts-node`）。
- 建议在启用认证与 TLS 后再对外提供服务，避免明文传输。

如需进一步集成或扩展，可参考 `apps/host/src/extension.ts`，了解如何接入 `@yuants/extension` 的部署生态。
