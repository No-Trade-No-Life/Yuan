---
sidebar_position: 3
---

# Message Mode Layer

Overall, we want Terminals to interact in an orderly and polite manner, so when dividing responsibilities, the goal is to **minimize the total communication cost within the Host**.

There are two types of message modes: Client/Server and Publisher/Subscriber.

1. Client/Server mode: The client sends a request to the server, and the server sends a response to the client.
2. Publish/Subscribe mode: The publisher pushes messages to subscribers.

## Client/Server Mode

We use this mode to implement request/response services.

The client sends a request to the server, and the server sends a response to the client.
The client and server are two Terminals within the same Host.
Requests and responses are Terminal messages.

Services are identified by method names.

The core process is:

1. Define a method to identify the format and behavior of the request and response.
1. The server should declare in its Terminal information that it provides the service.
1. The client should discover the server and send a request to the server.
1. The server should process the request and send a response to the client.

More details:

- The server can send multiple messages before sending a response.
- The session is the process from request to response, identified by the `trace_id` field in the message.
- The server should declare the methods it supports. The discriminator is the method name and JSON Schema.
- The client should check if the server supports the method and validate the request through JSON Schema before sending the request.
- If there are multiple valid candidate servers, the client should choose one server to send the request. It is recommended to use a load balancing algorithm to select the server.
- The server should send the first message within 30 seconds after receiving the request. If the server does not send a response within 30 seconds, the client should throw a timeout error.
- The server should not continue to send messages to the client after sending a response. If there are any, the client should ignore them.

How to use this mode:

**Server-side**:

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
    // Return an RxJS Observable / Promise / AsyncIterable / Iterable
  },
);
```

**Client-side**:

```ts
// message$ is the stream of messages (AsyncIterable) returned by the server
const message$ = terminal.client.requestService('SubmitOrder', {
  account_id: 'MyAccountId',
  // ... other fields omitted
});
```

## Publish/Subscribe Mode

We use this mode to implement real-time message push.

Subscribers subscribe to certain channels, and then publishers need to push messages to subscribers in real time.
Subscribers and publishers are two Terminals within the same Host.
There are many publishers and subscribers within the same Host.

Subscription is a ternary relationship: (`channel_id`, `provider_terminal_id`, `consumer_terminal_id`).

A channel is identified by a string `channel_id`, whose format is defined by the business layer.
For example, `"AccountInfo/Some-Account-ID"` is used to transmit real-time account information.

The core process is:

1. Define a channel to identify the channel and its payload message.
1. The publisher should declare in its Terminal information that it provides data for the channel.
1. The subscriber should declare in its Terminal information that it subscribes to the channel from the publisher.
1. The publisher should discover the subscribers and send payload messages to them.

More detailed rules:

- The subscriber should check if the publisher supports the channel before subscribing.
- The publisher should collect all subscribers of the channel and send messages to them.
- The publisher should stop sending messages to the subscriber after the subscriber goes offline.
- If there are multiple valid candidate publishers, the subscriber should decide which publisher to subscribe to. It is recommended to use a load balancing algorithm to select the publisher.
- If subscribing to the same channel from multiple publishers, the subscriber should handle conflicts.
- The publisher should multicast messages to all subscribers by itself.
- If it is difficult to enumerate all channels, the publisher can define matching patterns to match channels.
- If the current publisher does not send a message within 60 seconds, the subscriber should switch to another candidate publisher.

How to use this mode:

**Publisher-side**:

```ts
terminal.provideChannel<IAccountInfo>({ const: 'AccountInfo/MyAccountID' }, () => {
  // Return an RxJS Observable / Promise / AsyncIterable / Iterable
});
```

**Subscriber-side**:

```ts
const message$ = terminal.consumeChannel<IAccountInfo>('AccountInfo/MyAccountID');
```

1. `message$` is an asynchronous message stream, an AsyncIterable object. You can consume it to receive payload messages.
2. The subscriber matches candidate publishers based on the `channel_id` it needs to subscribe to.
3. The subscriber selects a publisher and declares the subscription. If there are multiple publishers, select one through load balancing.
4. The publisher sends payload messages to the subscriber based on the subscription relationship.
5. When the subscriber unsubscribes, it should promptly delete the subscription declaration.
6. If the current publisher does not send a message within 60 seconds, switch to another candidate publisher.

**Defining Matching Patterns**

If it is difficult to enumerate all channels, the publisher can define a matching regular expression string to match channels.

The only difference is that the publisher should declare the matching pattern instead of a constant `channel_id`.

```ts
// JSON Schema
terminal.provideChannel(
  {
    pattern: '^Period/Y/',
  },
  (channel_id) => {
    // Return an RxJS Observable / Promise / AsyncIterable / Iterable
  },
);
```
