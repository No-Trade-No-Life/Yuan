# Agents

An agent is a trading bot / strategy program. It can automatically execute trading strategies and make decisions based on market data and account information. Agents can perform backtesting on historical data and execute live trading on real-time data. You can customize the behavior and strategies of agents.

## Core Components

### [@yuants/kernel](./packages/@yuants-kernel.md)

Provides a time series simulation environment. Can be combined with modules to achieve different purposes.

### [@yuants/agent](./packages/@yuants-agent.md)

Trading bot based on Kernel. Agent contains the core trading strategy.

### [@yuants/app-agent](./packages/@yuants-app-agent.md)

This deploys a standalone terminal as a daemon service for Agent. You can run Agent in **real mode**. It can automatically correct historical data errors. It can also automatically restart when the Agent crashes.

## Agent Features

### Time Series Simulation Environment

- Provides realistic time series simulation
- Supports historical data backtesting
- Supports real-time data trading
- Configurable simulation parameters

### Strategy Development

- Modern programming language based on TypeScript
- Supports complex trading logic
- Provides rich market data interfaces
- Supports multiple trading strategy types

### Operating Modes

- **Backtesting Mode**: Test strategy performance on historical data
- **Live Trading Mode**: Execute real trading on live data
- **Simulation Mode**: Test strategies in a simulated environment

## Agent Daemon Service

### Automatic Error Correction

- Automatically detects and corrects historical data errors
- Ensures data consistency and accuracy
- Provides data quality monitoring

### Automatic Restart

- Automatically restarts when Agent crashes
- Maintains continuous strategy operation
- Provides runtime status monitoring

### State Management

- Maintains Agent runtime state
- Records execution logs and error information
- Provides runtime statistics and performance metrics

## Use Cases

- **Strategy Backtesting**: Validate strategy effectiveness on historical data
- **Live Trading**: Execute trading strategies in real markets
- **Strategy Optimization**: Optimize strategy parameters based on backtest results
- **Risk Management**: Monitor and manage trading risks

## Development Advantages

- **Rapid Iteration**: Supports fast strategy development and testing
- **Flexible Configuration**: Configurable runtime parameters and environment
- **Reliable Operation**: Features automatic error correction and restart mechanisms
- **Performance Monitoring**: Provides detailed runtime statistics and monitoring

<p align="right">(<a href="../../README.md">Back to README</a>) | <a href="architecture-overview.md">Architecture Overview</a></p>
