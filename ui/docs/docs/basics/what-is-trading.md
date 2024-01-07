---
sidebar_position: 1
---

# Elementary Math in Trading

:::info[Prerequisite Knowledge]
You need to have **elementary algebra** knowledge to understand this article.
Ensure that you can understand [these math concepts](https://en.wikipedia.org/wiki/Elementary_algebra) before reading this article.

It's very important to understand the basic math concepts, because the trading is based on these concepts.

Now, let's start step by step to construct the solid trading concept system.
:::

Trading is the process of buying and selling products. Products could be anything that can be traded, such as stocks, bonds, foreign exchange, commodities, crypto, options, etc.

We usually use our own money to buy products, and then sell them at a higher price to make a profit. This is the most basic trading method.

Define the price notation from $x$ to $y$ at time $t$: $P(x, y, t) = \frac{\text{unit value}(x, t)}{\text{unit value}(y, t)}$

Obviously, we have $P(x, y, t) \times P(y, x, t) = P(x, x, t) = 1$

And we have $P(x, y, t) \times P(y, z, t) = P(x, z, t)$

Follow the principle of Equivalent Exchange:

$$
\text{unit value}(x, t) \times \text{amount}(x) = \text{unit value}(y, t) \times \text{amount}(y)
$$

We can infer the following formula:

$$
\text{amount}(y) = \frac{\text{unit value}(x, t)}{\text{unit value}(y, t)} \times \text{amount}(x, t) = P(x, y, t) \times \text{amount}(x)
$$

The above formula is the basis for calculating the volume of trading.

## Trading Spot

:::info[Example - Stock Spot]
For example, if you want to buy 100 shares of Apple stock, and the price is $P(\text{AAPL}, \text{USD}, t_1) = 100$, then you need to pay $100 \times 100 = 10000$ USD.

And if you want to sell 100 shares of Apple stock, and the price is $P(\text{AAPL}, \text{USD}, t_2) = 110$, then you will get $110 \times 100 = 11000$ USD.

Finally you will get a profit of $11000 - 10000 = 1000$ USD.

| Time       | $t_1$  | $t_2$  | Summary |
| ---------- | ------ | ------ | ------- |
| USD        | -10000 | +11000 | +1000   |
| AAPL Stock | +100   | -100   | 0       |

The magic of trading is that you can make money without producing anything. You can make money by buying and selling products.

All derived financial instruments (futures and options) are based on the spot.
:::

To symbolize the above process, we can use the following formula:

if our currency is $A$, we buy $V$ volume of $B$ at time $t_1$, and sell $V$ volume of $B$ at time $t_2$, then we will get a profit of:

| Time | $t_1$                    | $t_2$                    | Summary                                   |
| ---- | ------------------------ | ------------------------ | ----------------------------------------- |
| A    | $-V \times P(B, A, t_1)$ | $+V \times P(B, A, t_2)$ | $V \times (P(B, A, t_2) - P(B, A, t_1)) $ |
| B    | $+V$                     | $-V$                     | 0                                         |

<a name="formula-1"></a>

So we can get the formula 1:

$$
\text{PnL} = V \times (P(B, A, t_2) - P(B, A, t_1))
$$

:::info[Example - Short Selling]
Assume that you want to short sell 100 shares of Apple stock, and the price is $P(\text{AAPL}, \text{USD}, t_1) = 100$, then you will get $100 \times 100 = 10000$ USD.

And if you want to buy 100 shares of Apple stock, and the price is $P(\text{AAPL}, \text{USD}, t_2) = 90$, then you need to pay $90 \times 100 = 9000$ USD.

Finally you will get a profit of $10000 - 9000 = 1000$ USD.

Actually, you need to **borrow** 100 shares of Apple stock from the exchange, and then sell them at $t_1$, and then buy them back at $t_2$, and finally return them to the exchange.

| Time       | $t_1$  | $t_2$ | Summary |
| ---------- | ------ | ----- | ------- |
| USD        | +10000 | -9000 | +1000   |
| AAPL Stock | -100   | +100  | 0       |

let $V = -100, P(\text{AAPL}, \text{USD}, t_1) = 100, P(\text{AAPL}, \text{USD}, t_2) = 90$, The [formula 1](#formula-1) is still valid.

:::

## Trading Contract

If we will finally sell all the product back to our currency, why not just trade on contract directly?

It's time to introduce the concept of **contract**.

Contract is a kind of financial instrument, which is a derivative of spot. When you buy or sell a contract, you are actually buying or selling ownership of spot. So the PnL of contract is based on spot.

Perhaps you have heard of futures, options, CFD, etc. They are all contracts.

- **Delivery contract** is a kind of contract that has an expiration date. Futures and options are delivery contracts. When the contract expires, the contract will be settled, and the contract will be settled at the spot price at the time of expiration. You can also choose to close the contract before the expiration date. You can also choose to roll over the contract before the expiration date. You can also choose to deliver the contract spot after the expiration date.
- **Perpetual contract** is a kind of contract that has no expiration date. CFD is a kind of perpetual contract. You can choose to close the contract at any time. You can never choose to deliver the contract by spot product. Perpetual contracts are usually settled daily, and the settlement price is the spot price at the time of settlement.

The contract has a **value scale**. For example, if the value scale is 100, when you buy 1 contract, you have ownership of 100 spot.

:::info[Example - Commodity Futures Contract]
For example, you have USD account, and you want to buy 1 contract of Gold Futures, and the contract is based on Gold, and one contract valued as 100 ounces. the market only shows that the price of Gold Futures ($P(\text{Gold Future}, \text{USD}, t)$).

When you buy 1 contract of Gold Futures, you have ownership of 100 ounces of Gold.

Assume $V=100$, if we are trading gold spot, then we will get a profit of:

$$
\text{PnL} = 100 \times (P(\text{Gold Spot}, \text{USD}, t_2) - P(\text{Gold Spot}, \text{USD}, t_1))
$$

As well known, the price of Gold Futures is usually very closed to Gold Spot but not the same.

Actually, you buy 1 contract of Gold Futures. Maybe the following formula is more reasonable:

$$
\text{PnL} = 1 \times (P(\text{Gold Future}, \text{USD}, t_2) - P(\text{Gold Future}, \text{USD}, t_1))
$$

But it will be very strange and anti-intuitable if we treat the price of Gold Futures as 100 times of Gold Spot.

So we need to introduce the multiple of **value scale**.

$$
\text{PnL} = 1 \times \text{value scale} \times (P(\text{Gold Future}, \text{USD}, t_2) - P(\text{Gold Future}, \text{USD}, t_1))
$$

:::

:::info[Example - Options Contract]
Options are a kind of contract that gives you the right to buy or sell a product at a certain price.
The buyer of the option has the right, but not the obligation, to buy or sell the product. The seller of the option has the obligation to buy or sell the product.
Options are usually divided into two types: call option and put option.
Options have independent prices, which are determined by the market supply and demand relationship.
So its PnL formula is similar to commodity futures.

For example, you have USD account, and you want to buy 1 contract of AAPL Call@200 Option, and the contract is based on Apple Stock, and one contract valued as 100 shares. the market only shows that the price of Apple Call@200 Option ($P(\text{AAPL Call@200 Option}, \text{USD}, t)$).

When you buy 1 contract of Apple Call@200 Option, you have the right to buy 100 shares of Apple Stock. Each share is priced 200 USD.

$$
\text{PnL} = 1 \times 100 \times (P(\text{AAPL Call@200 Option}, \text{USD}, t_2) - P(\text{AAPL Call@200 Option}, \text{USD}, t_1))
$$

:::

:::info[Example - Bond Spot / Futures]
Bond is a kind of contract that gives you the right to receive a fixed amount of money at a certain time in the future.
The buyer of the bond has the right, but not the obligation, to receive the money. The seller of the bond has the obligation to pay the money.
Bond is usually divided into two types: coupon bond and zero-coupon bond.
Bond has independent prices, which are determined by the market supply and demand relationship.
So its PnL formula is similar to commodity futures.

For example, you have USD account, and you want to buy 1 contract of US 10Y Bond, and the contract is based on USD, and one contract valued as 100,000 USD. the market only shows that the price of US 10Y Bond ($P(\text{US 10Y Bond}, \text{USD}, t)$).

When you buy 1 contract of US 10Y Bond, you have the right to receive 100,000 USD at 10 years later.

The price of bond is usually around 100. So the value scale of bond is 1000 (1% of 1 contract value).

$$
\text{PnL} = 1 \times 1000 \times (P(\text{US 10Y Bond}, \text{USD}, t_2) - P(\text{US 10Y Bond}, \text{USD}, t_1))
$$

:::

<a name="formula-2"></a>

Very cool, we can get the formula 2:

$$
\text{PnL} = V \times \text{Value Scale} \times (P(B, A, t_2) - P(B, A, t_1))
$$

We can treat the spot as a special contract, and the value scale of spot is 1.

## Trading Foreign Currency

We may face a situation where we want to buy a product, but the product is quoted by another currency or the product can be only traded by another currency.

For example,

- Foreign Exchange CFD
- Crypto's Coin-Margined Contract (aka Inverse Contract)
- Buy a foreign stock in your own currency

They are trading by a chain mechanism.

1. At the beginning, buy
   1. Buy the middle currency by your currency.
   2. Use the middle currency to buy the product.
2. At the end, sell
   1. Sell the product and gain the middle currency.
   2. Sell the middle currency and gain your currency.

It looks complex. But we can simplify it.

We can simply pretend that we have enough middle currency, and then buy the product directly. And finally exchange the middle currency back to our currency.

:::info[Example - Buy Foreign Stock]
For example, you have USD account, and you want to buy some shares of Tencent stock, and the stock is based on HKD. the market only shows that the price of Tencent stock ($P(\text{Tencent}, \text{HKD}, t)$) and USD/HKD ($P(\text{USD}, \text{HKD}, t)$).

First, calculate the profit in HKD:

$$
\text{PnL in HKD} = V \times (P(\text{Tencent}, \text{HKD}, t_2) - P(\text{Tencent}, \text{HKD}, t_1))
$$

Then, exchange the profit in HKD to USD:

$$
\text{PnL in USD} = \text{PnL in HKD} \times P(\text{HKD}, \text{USD}, t_2) \\
                  = \text{PnL in HKD} \times \frac{1}{P(\text{USD}, \text{HKD}, t_2)} \\
                  = V \times (P(\text{Tencent}, \text{HKD}, t_2) - P(\text{Tencent}, \text{HKD}, t_1)) \times \frac{1}{P(\text{USD}, \text{HKD}, t_2)}
$$

The only difference is that we need to exchange the profit in HKD to USD at the end.

What if we need to exchange the profit from USD to another currency? Just exchange the profit from USD to the other currency at the end. It's the magic trick of chain mechanism.

:::

So we infer the following formula 3:

$$
\text{PnL} = V \times \text{Value Scale} \times (P(B, C, t_2) - P(B, C, t_1)) \times P(C, A, t_2)
$$

The formula 2 is a special case of formula 3, when $A = C$.

:::info[Example - Foreign Exchange CFD (Direct Rate)]

For example, you have USD account, and you want to buy 1 contract of EUR/USD, and the contract is based on EUR, and one contract valued as 100,000 EUR. the market only shows that the price of EUR/USD ($P(\text{EUR}, \text{USD}, t)$).

When you buy 1 contract of EUR/USD, means you sell some USD and buy 100,000 EUR.

Let A = USD, B = EUR, C = USD, V = 1, Value Scale = 100000:

$$
\text{PnL} = 1 \times 100000 \times (P(\text{EUR}, \text{USD}, t_2) - P(\text{EUR}, \text{USD}, t_1)) \times P(\text{USD}, \text{USD}, t_2) \\
    = 100000 \times (P(\text{EUR}, \text{USD}, t_2) - P(\text{EUR}, \text{USD}, t_1))
$$

:::

:::info[Example - Foreign Exchange CFD (Indirect Rate)]

For example, you have USD account, and you want to buy 1 contract of USD/JPY, and the contract is based on USD, and one contract valued as 100,000 USD. the market only shows that the price of USD/JPY ($P(\text{USD}, \text{JPY}, t)$).

When you buy 1 contract of USD/JPY, means you buy some USD by JPY, and then buy 100,000 USD.

Let A = USD, B = USD, C = JPY, V = 1, Value Scale = 100000:

$$
\text{PnL} = 1 \times 100000 \times (P(\text{USD}, \text{JPY}, t_2) - P(\text{USD}, \text{JPY}, t_1)) \times P(\text{JPY}, \text{USD}, t_2) \\
    = 100000 \times (P(\text{USD}, \text{JPY}, t_2) - P(\text{USD}, \text{JPY}, t_1)) \times \frac{1}{P(\text{USD}, \text{JPY}, t_2)}
$$

:::

:::info[Example - Foreign Exchange CFD (Cross Rate)]
For example, you have USD account, and you want to buy a contract of GBP/JPY, and the contract is based on GBP, and one contract valued as 100,000 GBP. But the market only shows that the price of GBP/JPY ($P(\text{GBP}, \text{JPY}, t)$) and GBP/USD ($P(\text{GBP}, \text{USD}, t)$).

When you buy 1 contract of GBP/JPY, means you sell some JPY, and then buy 100,000 GBP.

Let A = USD, B = GBP, C = JPY, V = 1, Value Scale = 100000:

$$
\text{PnL} = 1 \times 100000 \times (P(\text{GBP}, \text{JPY}, t_2) - P(\text{GBP}, \text{JPY}, t_1)) \times P(\text{JPY}, \text{USD}, t_2) \\
    = 100000 \times (P(\text{GBP}, \text{JPY}, t_2) - P(\text{GBP}, \text{JPY}, t_1)) \times \frac{P(\text{GBP}, \text{USD}, t_2)}{P(\text{GBP}, \text{JPY}, t_2)}
$$

:::

:::info[Example - Crypto's Coin-Margined Contract]
For example, you have BTC account, and you want to buy 1 contract of BTC/USD, and one contract valued as 100 USD. the market only shows that the price of BTC/USD ($P(\text{BTC}, \text{USD}, t)$).

When you buy 1 contract of BTC/USD, means you sell 100 USD, and then buy some BTC.

Let A = BTC, B = BTC, C = USD, $V = \frac{1}{P(\text{BTC}, \text{USD}, t_1)}$, Value Scale = 100:

$$
\text{PnL} = \frac{1}{P(\text{BTC}, \text{USD}, t_1)} \times 100 \times (P(\text{BTC}, \text{USD}, t_2) - P(\text{BTC}, \text{USD}, t_1)) \times P(\text{USD}, \text{BTC}, t_2) \\
    = \frac{100 \times (P(\text{BTC}, \text{USD}, t_2) - P(\text{BTC}, \text{USD}, t_1))}{P(\text{BTC}, \text{USD}, t_2) \times P(\text{BTC}, \text{USD}, t_1)}
$$

It looks very strange that V is a formula about price.

Usually, the value scale of contract is a constant number related to B. But in this case, the value scale of contract is related to C.

In this case, we need to introduce a new concept: **value scale unit**.

The value unit of contract is the unit of value scale. For example, the value scale unit of BTC/USD is USD.

$$
\text{PnL} = 1 \times 100 \times P(\text{USD}, \text{BTC}, t_1) \times \\
             (P(\text{BTC}, \text{USD}, t_2) - P(\text{BTC}, \text{USD}, t_1)) \times P(\text{USD}, \text{BTC}, t_2)
$$

:::

## Summary

Finally, we can get the final universal formula:

$$
\text{PnL} = \text{Volume} \times \text{Value Scale} \times P(\text{Value Scale Unit}, B, t_1) \\
             \times (P(B, C, t_2) - P(B, C, t_1)) \times P(C, A, t_2)
$$

Where B is the product you want to buy, and C is the currency you want to use to buy B, and A is the margin currency you have. And Volume is the volume of contract you want to trade, positive if buy, negative if sell. Value scale unit can be B or C, depends on the contract spec.
