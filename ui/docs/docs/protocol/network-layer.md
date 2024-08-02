---
sidebar_position: 2
---

# Network Layer

The Host is a WebSocket server that listens for incoming connections from Terminals.

The Terminal is a WebSocket client that connects to the Host.

**This document describes how Hosts and Terminals establish connections and how Terminals exchange information with each other.**

Hosts are typically accessible over the internet, while Terminals are usually located within local networks and are not accessible from the internet. Therefore, Terminals can connect to Hosts and transmit messages to each other through the Host.

Terminals are peer-to-peer and can be considered as a P2P network.

The Host is a dumb component that merely forwards messages between Terminals. Terminals, on the other hand, are intelligent components that can process messages.

### Security

Hosts are typically accessible over the internet.

It is strongly recommended to deploy TLS certificates and use the WSS protocol to encrypt communications between Terminals and Hosts.

The Host has a basic token authentication mechanism to prevent unauthorized internet access.

When a Terminal connects to a Host, it needs to provide a token. The token is a predefined string when the Host is deployed.

The Terminal needs to provide the `host_token` in the query string of the URL when connecting to the Host, along with its own `terminal_id`. For example:

```
wss://api.ntnl.io/hosts?host_id=amazing_host&host_token=very_long_token&terminal_id=your_terminal_id
```

Security and efficiency are often at odds. More stringent security means more verification calculations, which will inevitably lead to a decrease in communication efficiency.
We choose to sacrifice internal security of the Host to improve efficiency. Higher efficiency means saving your startup capital.

The Host is the security boundary of the system. It is assumed that the internal of the Host is secure and trustworthy.
Terminals default to trust other Terminals within the Host and do not need to verify their identities.

The best practice is that a Host should be miniaturized and simplified. There should not be too many Terminals within a Host.

:::warning
Never leak the Host token to others. Anyone who knows the Host token can connect to the Host and send messages to Terminals.
This can lead to serious security issues and loss of your funds and secrets.
:::

:::tip
A process can create multiple Terminals to connect to multiple Hosts simultaneously.
This is very useful when you want to share data with others but do not want to reveal all your secrets.
Hosts are very lightweight, and you can create a shared Host for a specific purpose at any time.
We will introduce how to share information in a limited way later.

```mermaid
graph LR
    A[Your Personal Host] <--> B[Your Terminal]
    B <--> C[Shared Host]
    C <--> D[Other's Terminal]
    D <--> E[Other's Personal Host]
```

:::

### Terminal Information

Terminals should declare their Terminal information when connecting to a Host. Terminal information is a JSON object:

```ts
export interface ITerminalInfo {
  terminal_id: string;
  // Other fields omitted
}
```

- `terminal_id` is the ID of the Terminal. It should be unique within the Host. This is similar to an IP address.
- Terminal information usually includes service information of the Terminal. For example, a Terminal can declare that it provides account information services.
- Terminal information is used for the Service Mode Layer, which we will introduce later.
- The Host is responsible for broadcasting Terminal information to all Terminals in a timely manner.

### Message Structure

All messages are JSON-encoded and have the following structure:

```ts
export interface ITerminalMessage {
  source_terminal_id: string;
  target_terminal_id: string;

  // Other fields for the Service Mode Layer, to be introduced later.
}
```

- `source_terminal_id` is the ID of the sender Terminal.
- `target_terminal_id` is the ID of the recipient Terminal.
- The Host reads the `target_terminal_id` and forwards the message to the target Terminal.
- Other fields are used for the Service Mode Layer, which we will introduce later.

## Optimization

The following optimizations are not required by the protocol but implementing them can improve system performance. They are recommended.

### Optimization: P2P Direct Connection

We can use WebRTC to establish a P2P connection between two Terminals. WebRTC is a peer-to-peer technology that allows Terminals to exchange messages directly. It is a perfect choice for our purpose. Messages do not need to be transmitted through the Host. It is faster and incurs lower traffic costs. When a P2P connection is established, the Host will stop forwarding messages between the two Terminals. In fact, Terminals will no longer send messages to the Host. The operation of the Host has never changed. However, if the P2P connection is interrupted, the Host will resume forwarding messages between the two Terminals.

The Host will also forward ICE candidates (offers and answers) between the two Terminals. Therefore, the two Terminals can establish a P2P connection. The Host acts both as a STUN server and a TURN server.

Peer connections are established implicitly. When a Terminal sends a message to another Terminal, the Terminal will check if there is a P2P connection with the target Terminal. If not, the Terminal will attempt to establish a P2P connection with the target Terminal. If a P2P connection is established, the Terminal will send the message through the peer connection. If the P2P connection is interrupted, the Terminal will resume sending messages through the Host.

### Optimization: Local Loopback

If the target Terminal of a message points to the Terminal itself, then this message should not be sent over the network but directly to the Terminal's own message channel.

This is beneficial for Terminals to subscribe to channels provided by themselves or consume their own services, promoting design decoupling.
