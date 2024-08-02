---
sidebar_position: 1
---

# Introduction

:::info[Technical Reference]
This is the technical reference for the protocols used by the system. It is intended to provide guidance for developers and system administrators.

Our official npm package `@yuants/protocol` has already implemented this protocol.

If you are in a JavaScript environment, you can use it directly.

If you need support for other programming languages, you can implement the protocol in the corresponding language yourself.
:::

We define the protocol as a set of rules for regulating message exchange between two or more parties. The protocol is the foundation of the system and includes the following:

| Layer               | Members                             | Responsibilities                                      |
| ------------------- | ----------------------------------- | ----------------------------------------------------- |
| Network Layer[^1]   | Hosts, Terminals                    | Network and routing, basic security boundaries        |
| Service Mode Layer  | Client/Server, Publisher/Subscriber | Service discovery, load balancing, candidate election |
| Business Mode Layer | Defined by specific methods         | Defined by specific methods                           |

[^1]: Yes, we are redesigning the network layer of the internet. We have to do this because we need to support peer-to-peer connections between terminals. In traditional network protocols, browsers can actively connect to servers but cannot passively serve other terminals. Hosts seem to establish a virtual private network. However, in practice, setting up a virtual private network (VPN) is difficult and risky.
