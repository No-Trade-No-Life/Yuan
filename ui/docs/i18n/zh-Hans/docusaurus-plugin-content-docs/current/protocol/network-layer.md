---
sidebar_position: 2
---

# 网络层

主机 (Host) 是一个 WebSocket 服务器，监听来自终端的传入连接。

终端 (Terminal) 是连接到主机的 WebSocket 客户端。

**本文介绍了主机和终端是如何建立连接的，以及终端和终端之间是如何交换信息的。**

主机通常可以通过互联网访问，而终端通常位于本地网络中，无法从互联网访问。因此，终端可以连接到主机并通过主机相互传输消息。

终端是对等的，可以被视为一个 P2P 网络。

主机是一个傻组件，仅在终端之间转发消息。而终端是智能组件，可以处理消息。

### 安全性

主机通常可以通过互联网访问。

强烈建议部署 TLS 证书，使用 WSS 协议以加密终端和主机之间的通信。

主机有一个基本的令牌认证机制，以防止未经授权的互联网访问。

当终端连接到主机时，需要提供一个令牌。令牌是一个在部署主机时预定义的字符串。

终端在连接到主机时需要在 URL 的查询字符串中提供 `host_token`，并且提供自身的 `terminal_id`。例如：

```
wss://api.ntnl.io/hosts?host_id=amazing_host&host_token=very_long_token&terminal_id=your_terminal_id
```

安全性和效率不可得兼。
更严格的安全性意味着更多的验证计算，势必会导致沟通效率下降。
我们选择牺牲主机内部的安全性以提高效率。
而更高的效率意味着节省您的启动资金。

主机是系统的安全边界。假设主机内部是安全的且可信的。
终端默认信任主机中的其他终端，不需要验证其身份。

最佳实践是，一个主机是小型化的，简单化的。主机内不应该有过多的终端。

:::warning
切勿将主机令牌泄露给他人。知道主机令牌的任何人都可以连接到主机并向终端发送消息。
这可能会导致严重的安全问题并损失您的资金和秘密。
:::

:::tip
一个进程可以创建多个终端，以同时连接多个主机。
当您想与其他人共享数据，但不想告知其全部秘密时，这非常有用。
主机非常轻量级，您可以随时为某种目的去创建一个共享主机。
后续我们会单独介绍如何进行有限地信息共享。

```mermaid
graph LR
    A[您的个人主机] <--> B[您的终端]
    B <--> C[共享主机]
    C <--> D[其他人的终端]
    D <--> E[其他人的个人主机]
```

:::

### 终端信息

终端在连接到主机时应声明其终端信息。终端信息是一个 JSON 对象：

```ts
export interface ITerminalInfo {
  terminal_id: string;
  // 其他字段省略
}
```

- `terminal_id` 是终端的 ID。它在主机中应该是唯一的。这类似于一个 IP 地址。
- 终端信息通常包含终端的服务信息。例如，终端可以声明它提供账户信息服务。
- 终端信息用于服务模式层，我们将在后面介绍。
- 主机负责及时向所有终端广播终端信息。

### 消息结构

所有消息都是 JSON 编码的，并具有以下结构：

```ts
export interface ITerminalMessage {
  source_terminal_id: string;
  target_terminal_id: string;

  // 其他字段用于服务模式层，稍后介绍。
}
```

- `source_terminal_id` 是发送者的终端 ID。
- `target_terminal_id` 是接收者的终端 ID。
- 主机会读取 `target_terminal_id` 并将消息转发到目标终端。
- 其他字段用于服务模式层，我们将在后面介绍。

## 优化

以下优化并不是协议必需的，但是实现如下优化可以提升系统的性能。建议实现。

### 优化：P2P 直连

我们可以使用 WebRTC 在两个终端之间建立 P2P 连接。WebRTC 是一种点对点技术，允许终端直接交换消息。它是我们目的的完美选择。无需通过主机传输消息。它更快，流量成本更低。当建立 P2P 连接时，主机将停止在两个终端之间转发消息。实际上，终端将不再向主机发送消息。主机的操作从未改变。但是，如果 P2P 连接中断，主机将恢复在两个终端之间转发消息。

主机还将在两个终端之间转发 ICE 候选（提议和应答）。因此，两个终端可以建立 P2P 连接。主机既是 STUN 服务器又是 TURN 服务器。

对等连接是隐式建立的。当一个终端向另一个终端发送消息时，终端将检查是否与目标终端有 P2P 连接。如果没有，终端将尝试与目标终端建立 P2P 连接。如果建立了 P2P 连接，终端将通过对等连接发送消息。如果 P2P 连接中断，终端将恢复通过主机发送消息。

### 优化：本地环回

如果消息的目标终端指向终端自身，那么此消息应当不通过网络发送，而是直接发送到终端自身的消息通道。

这有利于终端订阅自身提供的频道或者消费自身的服务，促进设计解耦。
