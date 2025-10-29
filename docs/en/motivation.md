# Project Motivation

Yuan is a "Personal Investment Operating System" that includes all the basic software and infrastructure needed for various personal investment activities.

We have many quantitative trading projects ourselves, and these projects require a foundational platform - this is Yuan. We use the revenue from these projects to maintain Yuan's development, and contribute part of the code from these projects back to the Yuan project to enhance the platform's capabilities.

## Core Principles

**Self-development is the security bottom line**. In fact, many open source predecessors have created excellent projects, such as VNPY, Zipline, BackTrader, Qlib, etc. So why do we need to create another similar project? **Security is more important than efficiency**. Rather than finding angles to criticize them to prove our superiority, we believe we need to develop as much as possible ourselves to ensure every aspect is under our control. The more technologies we reference, the more problems we overlook, and the more technical debt we accumulate. Once problems occur, the systems we relied on to save development costs will become our downfall.

**Yuan does not restrict commercial use**. You can use Yuan for legitimate commercial purposes, secondary development based on Yuan, packaging profitable applications, etc. are all permitted.

**Yuan does not assume user responsibility**. Do not casually use Yuan in production environments, we open source under the MIT license and disclaim liability. We strongly recommend fully understanding and agreeing with our design before use. We prefer to exchange and learn with you.

**Yuan does not seek venture capital**. Yuan itself is not profitable, and venture capitalists cannot obtain returns.

## Pain Points in Quantitative Trading Industry

### 1. Privacy Security

Quantitative model code is the user's core asset and risks being stolen. Many products on the market require uploading strategy code to servers, and these products can fully evaluate and steal the code with user's code. If users' strategies can be mastered by potential competitors, users will be at a disadvantage. Therefore, there are also some products on the market that allow private deployment. We have designed a local workspace for users to protect their privacy from being stolen by anyone, including the Yuan project team. And we have completed the open source, supervised by the open source community, and will not do anything in the code that harms users' interests.

**Our choice: Model code never leaves the user's trusted device.**

### 2. Market Coverage

Users invest and trade in different markets. We hope the same strategy code can be applied to different market varieties, which shouldn't require any additional cost. We also hope platform products can support various types of markets. However, market products, due to regional laws and regulations and some of their own business limitations, usually only support part of the markets, forcing users to use different platforms in different markets. Through architectural design, we decouple and separate specific market modules, not only improving software quality but also overcoming compliance obstacles, paving the way for product globalization.

**Our choice: Design standard models for trading scenarios, support global markets, pursue high coverage. Non-commercial product, for learning and communication only.**

### 3. Cross-platform

We hope to run our products on desktop and mobile, on any platform and any device, without restrictions. After all, the market won't accommodate users' locations. Users can engage in work at any time, in any scenario, and interact with the market. Some products in the industry require users to run on specific operating systems or require specific hardware support. We believe users should not be limited to specific platforms, nor should they pay extra for multi-platform use.

**Our choice: Support cross-platform UI through browser WebUI.**

### 4. Usage Costs

Industry initial licensing fees are often thousands, not to mention high additional and maintenance costs. We believe these costs are partly due to bundling sales to offset development costs, partly due to inefficiency, and partly due to profiteering. As a product for individual investors rather than enterprises, we must consider the consumption capacity of ordinary investors. For investors, the most important aspects of tools are affordability and durability. Whether it's personal computers or server clusters, our products can run effectively.

**Our choice: Completely free, no commercial services provided, no costs transferred to users, assist users in controlling machine costs.**

### 5. Programming Barrier

Without programming skills, quantitative trading is impossible. For most people, programming is a high-barrier skill. Many people have simple original trading strategies but find it difficult to convert them into programmatic strategies, let alone test their performance. If outsourcing strategy development, users worry about their strategies being stolen, worry that the other party doesn't understand their intentions, and each modification cycle takes hours to days. Without programming ability, users cannot develop quantitative trading strategies and cannot become industry insiders. Additionally, many products provide special programming dialects (DSL), requiring users to learn new programming languages or syntax without providing sufficient community support, good documentation, or learning materials.

**Our choice: Reject niche dialects, use modern TypeScript language, provide AI assistant support for strategy generation, achieve rapid strategy iteration.**

---

<p align="center">
  <a href="README.md">Back to Documentation Home</a>
</p>
