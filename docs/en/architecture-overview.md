# Architecture Overview

Yuan is a "Personal Investment Operating System" that adopts a distributed architecture design, using an RPC framework to enable communication between components. The system uses a star topology where all terminals connect to a central node host (Host).

## Core Design Philosophy

- **Privacy and Security**: Model code never leaves user-trusted devices
- **Market Coverage**: Standard models designed for trading scenarios, supporting global markets
- **Cross-Platform**: Cross-platform UI support through browser WebUI
- **Usage Cost**: Completely free, no costs passed on to users
- **Programming Accessibility**: Uses modern TypeScript language with AI assistant support

## Main Components

- **RPC Framework**: Implements communication between terminals in distributed systems
- **Database**: Data storage based on PostgreSQL + TimeScaleDB
- **Monitoring and Alerting**: System monitoring using Prometheus
- **Data Modeling**: Unified general data models for global markets
- **Data Collection**: Collection and storage of time series data
- **Service Providers**: Connectors to external systems
- **Agents**: Trading bots and strategy programs
- **Trading Execution**: Account portfolio and copy trading execution

## Technical Features

- Native support for browser and NodeJS environments
- WebRTC peer-to-peer connection support
- Serverless architecture
- Cloud-native design
- AI-powered

<p align="right">(<a href="../../README.md">Back to README</a>)</p>
