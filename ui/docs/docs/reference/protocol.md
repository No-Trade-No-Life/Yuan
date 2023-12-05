# Protocol

:::warning[Working In Progress]
Writing is working in progress. The content might be largely changed later.
:::

:::info[Technical Reference]
This is a technical reference for the protocol used by the system. It is intended for developers and system administrators.

Our official npm package `@yuants/protocol` have implemented the protocol. You can use it directly.
:::

We define a protocol as a set of rules that govern the exchange of messages between two or more parties. The protocol is the foundation of the system and is responsible for the following:

| Layer                 | Participants                     | Responsibility                                |
| --------------------- | -------------------------------- | --------------------------------------------- |
| Transport Layer       | TCP Sockets                      | Reliable delivery of messages                 |
| Message Layer[^1]     | Host, Terminal                   | Networking and routing, basic secure boundary |
| Message Pattern Layer | Client/Server, Provider/Consumer | Load balance, candidate election              |
| Business Layer        | Specified by method              | Specified by method                           |

[^1]: Yes, we are reinventing the network layer of the Internet. We have to do this because we need to support peer connection between terminals. In traditional network model, browser can actively connect to server but cannot be passively serve others. Host seems to have built a virtual private network. But building a virtual private network is hard and risky in practice.

## Message Layer

Host is a WebSocket server that listens for incoming connections from terminals. Terminals are WebSocket clients that connect to the host.

Host can usually be access by Internet and Terminals are usually located in a local network and are not accessible from the Internet.
So terminals can connect to the host and transmit messages to each other through the host. Terminals are peers and can be considered as a P2P network.

Host is dumb component and only forwards messages between terminals. While terminals are smart components and can process messages.

### Security

Host usually can be accessed from Internet. It's recommend to deploy a TLS certificate to encrypt the communication between terminals and host. We have done this in our official artifacts.

And Host has a basic token authentication mechanism to prevent unauthorized access from Internet. When terminal connects to the host, it needs to provide a token. The token is a string that is pre-defined when the host deployed.

Terminal need to provide the host_token in the query string of the URL when connecting to the host. For example:

```
wss://api.ntnl.io/hosts?host_id=amazing_host&host_token=very_long_token&terminal_id=your_terminal_id
```

There's always trade-off between security and efficiency.
We choose to sacrifice inside-host security for efficiency.
Because efficiency is directly related to machine cost.
Higher efficiency means save your money.

Host is the secure boundary of the system. Assume that the host is secure and trusted.
Terminal will default trust other terminals in the host and will not verify the identity.

:::warning
Never leak the host token to the others. Everyone who knows the host token can connect to the host and send messages to terminals.
It may cause serious security problems and loss your money and secrets.
:::

:::tip
A terminal process can connect to multiple hosts at the same time. It's useful when you want to share data with partner.
Host is very lightweight and you can deploy a shared host for your sharing purpose.

```mermaid
graph LR
    A[Your Personal Host] <--> B[Your Terminal]
    B <--> C[Shared Host]
    C <--> D[Partner's Terminal]
    D <--> E[Partner's Personal Host]
```

:::

### Terminal Info

Terminal should declare its terminal info when connecting to the host. Terminal info is a JSON object:

```ts
export interface ITerminalInfo {
  terminal_id: string;
  // others is ellipsis
}
```

- terminal_id is the unique ID of the terminal. It should be unique in the host.
- Terminal Info usually contains the service information of the terminal. For example, the terminal can declare that it provides the service of account information.
- Terminal Info is used for message pattern layer, we will introduce it later.

### Message Structure

All messages are JSON encoded and have the following structure:

```ts
export interface ITerminalMessage {
  source_terminal_id: string;
  target_terminal_id: string;

  // other fields are used for message pattern layer, introduce later.
}
```

- source_terminal_id is the terminal ID of the sender.
- target_terminal_id is the terminal ID of the receiver.
- Host will read the target_terminal_id and forward the message to the target terminal.
- Other fields are used for message pattern layer, we will introduce it later.

### P2P Direct Connection

We can use WebRTC to establish a P2P connection between 2 terminals. WebRTC is a peer-to-peer technology that allows terminals to directly exchange message. It's a perfect choice for our purpose. No need to transfer messages through the host. It's faster and less traffic cost. When a P2P connection is established, the host will stop forwarding messages between the 2 terminals. Actually, the terminal will not send messages to the host anymore. The behavior of the host never changed. However, if the P2P connection is broken, the host will resume forwarding messages between the 2 terminals.

Host will also forward the ICE candidates (offers and answers) between the 2 terminals. So the 2 terminals can establish a P2P connection. Host is both STUN server and TURN in-role.

The peer connection is established implicitly. When a terminal sends a message to another terminal, the terminal will check if there's a P2P connection with the target terminal. If not, the terminal will try to establish a P2P connection with the target terminal. If the P2P connection is established, the terminal will send message through the peer connection. If the P2P connection is broken, the terminal will resume sending messages through the host.

## Message Pattern Layer

There're 2 types of message pattern: Client/Server and Provider/Consumer.

1. Client sends request to Server and Server sends response to client.
2. Provider push messages to Consumer.

### Client/Server Pattern (Service Pattern)

We use this pattern to implement request/response service.

Client sends request to server and server sends response to client.
The client and the server are 2 terminals in the same host.
The request and response are terminal messages.

Service is identified by the method name.

The core procedure is:

1. Define a method to identify the request and response format and behavior.
1. The server should declare in its terminal info that it provides the service.
1. The client should discover the server and send request to the server.
1. The server should process the request and send response to the client.

And more detail rules:

- Server can send multiple messages before sending response.
- Session is the process from request to response, which is identified by the trace_id field in the message.
- Server should declare the methods it supports. Discriminators are the method name and JSON Schema.
- Client should check if the Server supports the method and validate the request by the JSON Schema before sending request.
- Client should select a Server to send request if there're multiple valid candidates. It's recommended to use load balance algorithm to select a Server.
- Server should send first message in 30 seconds after receiving request. If Server doesn't send response in 30 seconds, Client should throw an timeout error.
- Server should never send messages to Client after sending response. If any, Client should ignore them.

How to use this pattern:

**Server side**:

```ts
terminal.provideService(
  'SubmitOrder',
  {
    type: 'object',
    properties: {
      account_id: { const: 'MyAccountId' },
    },
  },
  (msg) => {
    // return a RxJS observable of terminal messages
  },
);
```

**Client side**:

```ts
// message$ is a RxJS Observable returned by the server
const message$ = terminal.requestService('SubmitOrder', {
  account_id: 'MyAccountId',
  // ... other fields are ellipsis
});
```

### Provider/Consumer Pattern (Channel Pattern)

We use this pattern to implement real-time message push.

Consumer subscribes some channel, and then the provider need to push messages to the consumer in real-time.
The consumer and the provider are 2 terminals in the same host.
And there're many providers and consumers in the same host.

Subscription is a 3-ary relation: (channel_id, provider_terminal_id, consumer_terminal_id).

Channel is identified by the channel_id, its format is defined by business layer.
For example, channel_id `encodePath('AccountInfo', account_id)` is used to transmit real-time account information.
It's recommended to use `encodePath` to generate channel_id, and `decodePath` to parse channel_id. Because it's easy and human-readable.
However, you can use any format you like. It's not the concern of message pattern layer.

The core procedure is:

1. Define a channel to identify the channel and its payload messages.
1. The provider should declare in its terminal info that it provides the data of the channel.
1. The consumer should declare in its terminal info that it subscribes channel from the provider.
1. The provider should discover the consumer and send payload messages to the consumer.

And more detail rules:

- The consumer should check if the provider supports the channel before subscribing.
- The provider should collect all consumers that subscribe the channel and send messages to them.
- The provider should stop sending messages to the consumer after the consumer is offline.
- The consumer should decide which provider to subscribe if there're multiple valid candidates. It's recommended to use load balance algorithm to select a provider.
- The consumer should handle the conflict if it subscribe the same channel from multiple providers.
- The provider should multicast messages to all consumers by itself.
- The provider might define a matching pattern to match the channel if it's hard to enumerate all channels.
- The consumer should switch to another candidate provider if the current provider doesn't send messages in 60 seconds.

How to use this pattern:

**Provider side**:

```ts
terminal.provideChannel<IAccountInfo>({ const: 'AccountInfo/MyAccountID' }, () => {
  // return a RxJS Observable of payload messages
});
```

**Consumer side**:

```ts
// message$ is a RxJS Subject returned by the provider
const message$ = terminal.consumeChannel<IAccountInfo>('AccountInfo/MyAccountID');
```

1. message$ is a RxJS Subject. You can subscribe it to receive payload messages.
2. match the channel_id and find the candidate providers.
3. select one provider and declare the subscription.
4. receive payload messages from the provider.
5. unsubscribe the channel if message$ is unsubscribed.
6. switch to another candidate provider if the current provider doesn't send messages in 60 seconds

**Define a matching pattern**

The provider might define a matching regexp string to match the channel if it's hard to enumerate all channels.

The only difference is that the provider should declare the matching pattern instead of the constant channel_id.

```ts
// JSON Schema
terminal.provideChannel(
  {
    pattern: '^Period/Y/.+/.+$',
  },
  (channel_id) => {
    // return a RxJS Observable by channel_id
  },
);
```

## Further Reading

You can read the source code of our official npm package `@yuants/protocol` to learn more about the protocol.

You can read the business layer (TODO) specification to learn more about the business.
