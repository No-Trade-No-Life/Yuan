# RPC Framework

Yuan implements communication between terminals in a distributed system through an RPC framework. It natively supports browser and NodeJS environments. It uses a star topology where all terminals connect to a central node host (Host). Terminals can send messages to other terminals through the Host. The Host is responsible for forwarding messages. Meanwhile, terminals utilize WebRTC to establish peer-to-peer connections for more efficient communication, reducing the load on the Host. The Host acts as a signaling service to help terminals establish peer-to-peer connections.

## Core Components

### [@yuants/protocol](./packages/yuants-protocol.md)

Network protocols, service definitions, and infrastructure.

### [@yuants/app-host](./packages/yuants-app-host.md)

Ultra-lightweight in-memory message broker and service discovery. Terminals connected to the same host can send messages to each other. Supports connection permission control through the `HOST_TOKEN` environment variable. Supports enabling multi-tenant environment through the `MULTI_TENANCY=ED25519` environment variable, which can automatically accept terminals with valid ED25519 signatures, and terminals don't need to send private keys to the host.

### [@yuants/app-portal](./packages/yuants-app-portal.md)

This deploys a service that allows sharing existing services (and channels) in the host with other hosts. It's a middleman that can forward messages from one host to another. It's a very powerful tool that can help you build data sharing scenarios.

## Communication Patterns

1. **Star Topology**: All terminals connect to the central Host
2. **Message Forwarding**: Host is responsible for routing messages between terminals
3. **Peer-to-Peer Connection**: Establish direct connections through WebRTC
4. **Service Discovery**: Automatically discover and register available services

## Security Features

- Connection token verification support
- Multi-tenant environment support
- ED25519 signature verification
- Private key protection mechanism

<p align="right">(<a href="../../README.md">Back to README</a>) | <a href="architecture-overview.md">Architecture Overview</a></p>
