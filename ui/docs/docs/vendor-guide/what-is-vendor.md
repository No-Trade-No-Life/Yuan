---
sidebar_position: 1
---

# What is a Vendor

A Vendor is an extension program in Yuan that connects Yuan to external systems, acting as a bridge between Yuan and these external systems.

Vendors map Yuan's standard concepts to those of external systems, enabling interaction between Yuan and these systems.

Developing a vendor requires the developer to understand both Yuan's standard concepts and the concepts and corresponding APIs of the external system.

Typically, a vendor specifically refers to an Exchange and a Data Source. Many exchanges are also data sources, so a vendor program can serve as both an exchange and a data source.

This guide will introduce the basic concepts of vendors and how to write a vendor.

## Responsibilities of a Vendor

A vendor program can be responsible for multiple products and multiple accounts.

- [Provide product specifications](./vendor-product)
- [Provide real-time market data](./vendor-realtime-market-data)
- [Provide historical market data](./vendor-historical-market-data)
- [Provide real-time account information](./vendor-account-info)
- [Provide historical order information](./vendor-historical-order)
- [Provide trading interfaces (placing orders, modifying orders, canceling orders)](./vendor-trading-interfaces)
- [Provide transfer interfaces (sending, receiving)](./vendor-transfer)

:::info[Single Account Principle]

When integrating with accounts, ensure that one container corresponds to one account, using environment variables to set account authorization.

Do not use one container to maintain the authorization of multiple accounts, because:

1. Authorization information is insecure

   If someone has control over the vendor's deployment, they can inevitably access this deployment environment and obtain authorization information for the environment and vendor API through some dump method, which is equivalent to having the account authorization. Therefore, to ensure that account authorization does not leak, users must have control over the vendor's deployment.
   Controlling the environment means controlling the authorization, so environment variables are the simplest channel for authorization transmission.

2. It reduces availability

   If a program anomaly occurs with an account, such as OOM, it will affect other accounts in the same container, leading to restarts and reinitializations, resulting in significantly reduced availability. Sacrificing availability for the potential benefit of more efficient resource allocation is clearly not worthwhile.

3. It complicates program structure

   If a container needs to manage multiple accounts, it inevitably requires setting up an account pool, with each step needing to retrieve the corresponding state from the account pool, which imposes higher requirements on program design.
   Typically, a vendor process holds only one API authorization key and should not hold multiple API authorization keys.

:::

## Types of External System Interfaces

External system interfaces come in various types, but they can generally be categorized into the following:

1. HTTP API (including WebSocket, as WebSocket is based on the HTTP protocol)

   HTTP-based APIs offer the best compatibility, as almost all programming languages have HTTP request libraries. Moreover, they can be used in browsers.

2. Node.js Lib (e.g., requiring the use of Raw Socket, C++ Addon, or N-API bindings)

   Libraries that can only be used by Node.js programs, usually based on C++ Addons, or using N-API for bindings with other languages.

   The difficulty is moderate; it only requires installing an additional npm package to integrate.

3. Cross-language interoperability SDK (e.g., C++ DLL)

   Some external systems may only provide a C++ SDK, and writing bindings can be challenging. In such cases, it is recommended to use an embedded message queue like [ZeroMQ](https://zeromq.org/) for cross-language interoperability.

   The difficulty is high; it is advisable to read our best practices - [Cross-Language Interoperability Guide](./cross-language-interoperability).

4. Graphical User Interface (including Web GUI, Native GUI)

   Some external systems may only provide a graphical user interface, requiring the use of automation testing tools for simulated operations. However, this method has high resource consumption and may involve infringement on the external system. It is only recommended when no other solutions are available. You can learn about automation testing tools like Puppeteer, Selenium, and WinAppDriver.
