# Cross-Language Interoperability Guide

:::info[You Might Not Need to Read This Guide]
If the provider SDK's language is not JavaScript or a common application layer protocol like HTTP, things can get quite complex.

If your scenario is not this complex, please skip this guide.
:::

For the sake of illustration, let's assume the SDK's language is **X**.

Before we begin, let's make some basic assumptions:

- The developer (that's you) has a basic but not in-depth understanding of the X language, aiming to minimize the development complexity of the X language part.
- Yuan has provided a series of JS libraries to help you quickly integrate with the X SDK and handle various chores.

From these assumptions, we can draw some inferences:

- Direct communication with the host network using the X language is not considered.
- Packaging the X SDK into WASM to run in the JS Runtime is not considered.
- Direct cross-language calls to the X SDK from the JS side via memory binding are not considered.

These assumptions are made to minimize the complexity of integration, improve efficiency and quality, and avoid unnecessary overhead.

Of course, you can modify the integration approach yourself, as long as you follow Yuan's [Technical Protocol](../protocol/introduce.md), you can integrate with Yuan like other providers.

## Architecture

Based on these assumptions, we can derive a simple architecture consisting of two processes: the "JS side" and the "X side".

- The JS side is heavier, responsible for communication with the host, asynchronous process scheduling, calling the X side, and various chores.
- The X side is lighter, responsible for calling the SDK and executing business logic.
- Both processes run in a single container.

## REPL Style

It is recommended to encapsulate the X side into a REPL (Read-Eval-Print Loop) style, which can greatly simplify the complexity of the X side. All programming languages, all computational statements can be categorized into: call (CALL), return (RETURN), throw exception (THROW), or callback (CALLBACK).

1. The X side does not need to support loops and branch jump structures, nor does it need to save history.

Use JSON for input and output encoding:

```ts
interface IMessage {
  trace_id: string;
  type: 'call' | 'return' | 'throw' | 'callback';
  method?: string; // for call
  params?: any[]; // for call and callback
  value?: any; // for return
  message?: string; // for throw
}
```

1. The structure may be nested, it is recommended to use JSON for serialization.

Or use a simpler encoding:

1. Each message occupies a single line, if there are newline characters \n within the message, they must be escaped as \\n.
2. Start with the message ID, followed by a space; then the type of the message, which is one of CALL, RETURN, THROW, CALLBACK; the subsequent parts are freely agreed upon and can be any structure.

```
> ID CALL METHOD PARAM1 ... PARAM_N
< ID RETURN VALUE
< ID THROW ERROR
< ID CALLBACK PARAM1 ... PARAM_N
```

:::note[Why Use a Simpler Encoding?]

1. The X side may not have a suitable JSON library; binding JSON may not be a good choice if structure transmission is not involved.
2. PARAM, VALUE, ERROR can all be internally encoded as JSON without conflict.
3. Any language can easily interpret and execute this simple encoding.

:::

:::info[Why Design as REPL Style?]

1. The X side may have high costs for handling asynchronous or multithreaded operations.
2. The X side may encounter performance bottlenecks or throttling from the SDK more quickly.

:::

The design requires the JS side to actively restart the X side process if it fails to respond in time, because:

1. The X side may fail to respond to the JS side due to known or unknown reasons.
2. When a program does not respond for a long time in REPL, humans will actively Ctrl-C to exit and retry. The JS side thinks the same way.

:::note[Why Need CALLBACK Interface?]

1. The X side may provide real-time subscription interfaces or asynchronous interfaces, so it needs to actively push to the JS side.

:::

## Infrastructure

To meet the logical complexity of a specific business logic system, it cannot be completely eliminated, only absorbed through logical reuse. Yuan's maintained libraries will absorb some logic in the JS side, thereby reducing the logical complexity of the JS side, ultimately making the integration process easier.

### Communication Middleware ZMQ

The JS side and the X side use ZeroMQ as the message middleware for communication.

:::info[Why Use Message Middleware?]

1. The X side may not provide a STDIO interface and must communicate between processes through other means.

:::

:::info[Why Not Use TCP Directly?]

1. ZMQ supports TCP automatic reconnection, high-performance asynchronous IO, memory overflow limits, etc. It is recommended to read [ØMQ is just Sockets! - zeromq](http://wiki.zeromq.org/topics:omq-is-just-sockets).

:::

:::info[Why Use ZMQ Instead of Other Frameworks?]

1. ZMQ is simple, only doing transport protocols and message patterns, leaving the application layer protocol blank, not involving serialization and deserialization issues, with no extra stuff, and less overhead.
2. gRPC, Thrift, Protobuf are based on DSL, require pre-preparation of corresponding protocols, and have a higher toolchain startup cost. Suitable for heavier logic scenarios.

:::

It is recommended to use ZMQ's PAIR-PAIR mode:

1. The JS side acts as PAIR-SERVER, the X side as PAIR-CLIENT, with the X side actively connecting to the JS side.
2. For debugging, the JS side opens an additional external port.

:::info[Why Recommend Using ZMQ's PAIR-PAIR Mode?]

1. PAIR-PAIR only needs to use one port, which is the simplest full-duplex solution.
2. Load balancing issues are not handled within a single container.
3. Debugging issue: The X side cannot accept two connections, so entering the container cannot debug the X side's functionality, but an additional port can be listened to on the JS side for debugging purposes.

:::

### Reactive Programming Paradigm Reactive JS (RxJS)

To handle complex asynchronous logic, Yuan extensively uses Rx to build the system, and most interfaces are Rx Style. Rx itself is a cross-language programming approach, but it is limited by the syntax characteristics of each language, and its development status varies.

We recommend using Rx on the JS side and not using Rx on the X side.

:::info[Why Not Recommend Using Rx on the X Side?]

1. Languages with difficult anonymous function constructions may not have a good Rx implementation. For example, Python, C.
2. It will add unnecessary complexity to the X side.
3. From the perspective of comparative advantage, Rx should be used on the JS side to handle asynchronous scheduling.

:::

## Some Miscellaneous Points

Tips:

1. The X side may not provide real-time subscription interfaces, requiring the JS side to actively poll.
2. The X side may be missing some interfaces, but they can be synthesized indirectly through other interfaces, which may be quite complex.
3. During development, it is often necessary to manually call the X side's functionality for debugging.

Recommendations:

1. Use UUID in each message and print it in both sides' logs.
2. It is recommended to use JSON for communication, if there is no JSON library in the X ecosystem, it can be downgraded to a CSV-like encoding format.
3. Provide a Batch mechanism, as some provider APIs are low in performance (only occupying one synchronous thread) and must be batch processed.
4. The X side's code design should 尽量 align with the X language's API naming semantics, handle as little as possible, and keep the logic thin, which helps in troubleshooting. If possible, generate template code corresponding to the SDK API used by the X side.
5. Reuse and test the JS side's code to improve the efficiency and quality of provider integration.
6. If possible, build corresponding libraries for commonly used X languages.
