# 数据建模

为了统一全球市场，我们需要一个通用的数据模型来表示市场数据。这个数据模型可以帮助我们在不同的市场之间进行数据转换和映射。

数据建模中包含了 TS 类型、utils 等公共代码。

## 核心数据模型

### [@yuants/data-product](libraries/data-product)

市场中可交易的产品。

### [@yuants/data-ohlc](libraries/data-ohlc)

OHLC(V) 数据。OHLC 是 Open、High、Low、Close 的缩写，是一种常用的市场数据格式，也称为 K 线。

### [@yuants/data-quote](libraries/data-quote)

Level-1 报价数据，具体是指产品的最新价格和最优报价等信息。

### [@yuants/data-interest-rate](libraries/data-interest-rate)

利率数据。利率是指交易者持有头寸经过结算点时产生的利息。它通常用于外汇交易和差价合约 (CFD) 交易，同时也适用于永续合约的资金费率。

### [@yuants/data-account](libraries/data-account)

账户和持仓信息。

### [@yuants/data-order](libraries/data-order)

订单数据。订单是指交易者在市场中提交的买入或卖出指令。

### [@yuants/data-trade](libraries/data-trade)

成交数据。成交是指订单在市场中被执行的结果。

另外，不需要在包之间共享的私有数据建模，我们会放在对应领域的包中。

## 数据特性

我们发现，数据有两种非常有用的性质：层级属性和时间序列性。

### 层级属性

- 产品的层级性来源于不同的市场、不同门类的品种
- 账户信息的层级来源于不同的券商、母子账户关系、基金组件关系等
- 可以通过层级属性，存储并管理好非常大量的数据
- 层级性非常方便理解，每次只需要在一个子目录中完成工作

### 时间序列性

- 数据通常是按照时间产生的，按照时间周期连续聚合的
- 例如 OHLC 数据，我们可以利用时间序列的特性，进行不同时间切片上的数据管理
- 按照周期，从数据提供商处抓取数据，存储到数据库中
- 时间序列数据的存储和查询非常高效

## 设计优势

- 统一的数据模型支持全球市场
- 层级结构便于数据组织和管理
- 时间序列特性优化数据存储和查询
- 模块化设计便于扩展和维护

<p align="right">(<a href="../../README.md">返回 README</a>) | <a href="architecture-overview.md">架构概述</a></p>
