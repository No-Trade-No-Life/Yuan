# Node Unit

Node Unit 是一个轻量级的分布式计算调度器，专注于 Node.js 应用的资源管理和任务调度。它能够高效利用分布式集群中的计算资源，为需要跨机器运行的应用提供简单可靠的解决方案。

Node Unit 定位为 Kubernetes 的轻量级替代方案，同时提供比 pm2, nodemon 或 forever 更强的分布式能力。它特别适合那些不需要复杂容器隔离，但需要跨机器调度 Node.js 应用的场景。

**为什么需要 Node Unit？**

1. **跨地域部署需求**

   - 需要从不同 IP 地址获取数据的任务
   - 需要在全球不同地域运行以降低延迟的任务

2. **成本优化**

   - 利用低配廉价云服务器或闲置私人机器运行任务
   - 避免 Kubernetes 的资源浪费和复杂性

3. **多用户协作**

   - 不同用户可以共享计算资源组成更大的集群
   - 保护隐私的同时实现资源共享

4. **跨域组网**

   - 规避 Kubernetes 要求节点在同一局域网内的限制
   - 支持动态 IP 地址的节点加入和离开

### 与 Kubernetes 的对比

Kubernetes 提供了强大的容器编排能力，但其复杂性往往超出实际需求。Node Unit 在以下方面提供了更优的解决方案：

- **资源利用效率**：避免容器隔离带来的资源浪费，节点内的进程之间可以更灵活地共享资源
- **运维复杂度**：相比 Kubernetes 大幅简化部署和维护流程，因为我们有与 Yuan 生态结合的专门 GUI 工具
- **成本效益**：实际使用中相比 Kubernetes 可节省 50% 以上的运维和机器成本
- **隐私保护**：支持多用户管理，用户可以在保护策略代码的同时共享计算能力

与 Kubernetes 的能力互补：可以利用 Kubernetes 的弹性伸缩机制，在集群中通过 DaemonSet 运行 Node Unit，从而实现更大规模的分布式计算。Node Unit 不会涉及主动伸缩节点的能力，例如向云服务商 IaaS 平台申请更多的机器或者释放机器，而是专注于节点内的资源调度和任务管理。不过目前在我们官方团队的使用场景中，固定数量的节点配合 Node Unit 已经足够满足需求，更大规模的场景有待探索和验证。

## 核心特性

- **分布式调度**：支持主从节点模式，实现计算资源的水平扩展
- **轻量级架构**：相比 Kubernetes 大幅简化，专注于 Node.js 应用场景
- **安全沙盒**：提供容器化部署和权限限制，确保代码执行安全
- **协议支持**：原生支持 HTTP/HTTPS 和 WebSocket 协议
- **包管理**：通过信任机制控制可执行的代码包
- **身份认证**：基于 ED25519 算法的节点身份认证

## 配置

主 / 从节点模式:

根据环境变量 `HOST_URL` 的配置情况，节点可以运行在两种模式之一:

- 主节点模式: 创建主机，供从节点(和其他各种终端)连接，提供 HTTP / WS / HTTPS / WSS 服务。必须不配置 `HOST_URL`。
- 从节点模式: 连接主节点，提供附加的计算资源支持。必须配置 `HOST_URL`。

主 / 从节点模式都支持的环境变量:

| 变量名                 | 说明                                                                                          | 默认值                                            |
| ---------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| NODE_UNIT_NAME         | 节点的名字 (任意字符串)，用于身份标识和加密通信，可以明文传输                                 | `os.hostname()`                                   |
| NODE_UNIT_PASSWORD     | 节点的密码 (任意字符串)，用于身份标识和加密通信，需要妥善保存                                 | `randomUUID()`                                    |
| NODE_UNIT_CLAIM_POLICY | 抢占策略：`deployment_count`、`resource_usage` 或 `none`（不区分大小写）                      | `deployment_count`                                |
| POSTGRES_URI           | PostgreSQL 连接字符串，如果非空将创建本地的 PG 连接服务                                       | `''`                                              |
| TRUSTED_PACKAGE_REGEXP | 信任的包名正则表达式，允许从节点运行这些包的代码，正则表达式会检验字符串 `${name}@${version}` | `'^@yuants/'` (信任 @yuants 下的所有包的所有版本) |
| ENABLE_CUSTOM_COMMAND  | 是否启用自定义命令功能，如果启用，将允许自定义命令 (建议仅在容器沙盒的安全环境使用)           | `'false'`                                         |
| PG_PACKAGE_VERSION     | `@yuants/app-postgres-storage` 的版本号，仅对 POSTGRES_URI 的本地 PG 连接服务有效             | `'latest'`                                        |

主节点环境专用变量表:

| 变量名               | 说明                                                    | 默认值     |
| -------------------- | ------------------------------------------------------- | ---------- |
| HOST_TOKEN           | 主节点模式下，设置认证令牌                              | `''`       |
| PORT                 | 主节点模式的 HTTP / WS 监听端口                         | `'8888'`   |
| SSL_PORT             | 主节点模式的 HTTPS / WSS 监听端口                       | `'18888'`  |
| SSL_KEY_PATH         | 主节点模式的 HTTPS / WSS 私钥文件路径，留空时不启动 TLS | `''`       |
| SSL_CERT_PATH        | 主节点模式的 HTTPS / WSS 证书文件路径，留空时不启动 TLS | `''`       |
| HOST_PACKAGE_VERSION | `@yuants/app-host` 的版本号                             | `'latest'` |

从节点环境专用变量表:

| 变量名   | 说明                         | 默认值 |
| -------- | ---------------------------- | ------ |
| HOST_URL | 从节点模式，连接主节点的地址 | 必填   |

## 调度策略与 deployment 类型

- `deployment.type=deployment`：使用 `address` 绑定与抢占逻辑，行为与现有版本一致。
- `deployment.type=daemon`：不参与抢占且不绑定 `address`，启用后每个 node-unit 都会运行一个实例。
- `NODE_UNIT_CLAIM_POLICY=none`：调度循环继续运行但不执行 `claim`/`assign`，不会写入 `deployment.address`。

## Docker 部署

Node Unit 支持通过 Docker 容器化部署，这为运行环境提供了更好的隔离性和安全性。

### 快速启动

```bash
# 主节点模式
docker run -d \
  --name node-unit-master \
  -p 8888:8888 \
  -p 18888:18888 \
  -e NODE_UNIT_NAME="master-node" \
  -e NODE_UNIT_PASSWORD="your-secure-password" \
  -e HOST_TOKEN="your-host-token" \
  ghcr.io/no-trade-no-life/node-unit:latest

# 从节点模式
docker run -d \
  --name node-unit-worker \
  -e NODE_UNIT_NAME="worker-node" \
  -e NODE_UNIT_PASSWORD="your-secure-password" \
  -e HOST_URL="ws://your-master-host:8888" \
  ghcr.io/no-trade-no-life/node-unit:latest
```

### 安全模式部署

在需要运行第三方扩展或需要环境隔离的场景下，强烈推荐使用 Docker 的安全模式部署：

```bash
# 安全模式 - 启用沙盒环境
docker run -d \
  --name node-unit-secure \
  --security-opt=no-new-privileges \
  --cap-drop=ALL \
  --read-only \
  --tmpfs /tmp \
  -p 8888:8888 \
  -e NODE_UNIT_NAME="secure-node" \
  -e NODE_UNIT_PASSWORD="your-secure-password" \
  -e ENABLE_CUSTOM_COMMAND="true" \
  -e TRUSTED_PACKAGE_REGEXP="^@yuants/" \
  ghcr.io/no-trade-no-life/node-unit:latest
```

#### 安全模式特性

- **环境隔离**: 容器化部署确保运行环境与宿主机完全隔离
- **权限限制**: 通过 `--cap-drop=ALL` 和 `--no-new-privileges` 限制容器权限
- **文件系统保护**: 使用 `--read-only` 和临时文件系统保护系统文件
- **包信任机制**: 通过 `TRUSTED_PACKAGE_REGEXP` 控制可执行的包范围
- **自定义命令沙盒**: 仅在容器环境中才建议启用 `ENABLE_CUSTOM_COMMAND`

#### 推荐使用场景

1. **第三方扩展运行**: 当需要运行不受信任的第三方包时
2. **多租户环境**: 在共享环境中为不同用户提供隔离的计算资源
3. **开发测试环境**: 快速部署和销毁测试环境，避免污染主机
4. **生产环境安全**: 在生产环境中提供额外的安全隔离层

## Kubernetes DaemonSet

在 k8s 集群中，Node Unit 将以 DaemonSet 的形式运行在每个节点上，提供计算资源支持。

Node Unit 会根据 k8s 节点的名字作为种子，生成唯一的 ED25519 私钥，从而保证每个节点的身份唯一且稳定。

但是请注意，当 k8s 节点被删除并重新创建时，节点名字可能会变化，从而导致生成的私钥变化，进而导致节点身份变化。

节点身份的变化，可能会导致某些部署在该节点上的服务无法识别新的节点身份，从而影响服务的正常运行。
