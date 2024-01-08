---
sidebar_position: 4
---

# How to calculate PnL

> $\text{PnL} = \text{Standard PnL} + \text{PnL Correction}$

## Standard PnL

This **standard PnL formula** can be applied to the calculation of PnL for **all the products**. It's suitable for spots, futures and options contract, and including stocks, foreign exchange, bonds, commodity, cryptos, precious metals, etc.

$$
\text{Standard PnL} = \text{Volume} \times \text{Value Scale} \times (P(B, C, t_2) - P(B, C, t_1)) \\
                      \times P(C, A, t_2) \times P(\text{Value Scale Unit}, B, t_1)
$$

When:

- $A$ is the account's margin currency; $B$ is the product itself; $C$ is the product's quote currency;
- For any assets $x$, $y$ and time $t$, $P(x, y, t)$ is the price of two assets $x$ vs $y$ at time $t$, and $t_1$ is the time of position entering; $t_2$ is the time of position exiting;
- $P(B, C, t)$ is the price of the product at time $t$; You can see it directly everywhere in the market;
- Volume is the number of contract, positive if long, negative if short;
- Close Price $P(B, C, t_2)$ is the price of the product at the time of position exiting;
- Open Price $P(B, C, t_1)$ is the price of the product at the time of position entering;
- Value scale is a constant multiple item for the product, usually 1 in spots, and is called "contract size" in futures or options contracts.
- $P(C, A, t)$ is the exchange rate of the quote currency vs the margin currency at time $t$;
  - if the quote currency is the same as the margin currency, then $P(C, A, t) = 1$, you can ignore this item;
- Value scale unit is the unit of value scale, usually refers to the product itself ($B$), or the product's quote currency ($C$);
  - if it refers to the product itself, then $P(\text{Value Scale Unit}, B, t_1) = P(B, B, t_1) = 1$;
  - if it refers to the product's quote currency, then $P(\text{Value Scale Unit}, B, t_1) = P(C, B, t_1) = \frac{1}{P(B, C, t_1)} = \frac{1}{\text{Open Price}}$;
  - for example, if the product specified that 1 contract = 100 shares of stock, then the value scale unit is the stock itself, and the value scale is 100;
  - for another example, if the product specified that 1 contract = stocks worth 1000 USD, then the value scale unit is the quote currency, and the value scale is 1000;
- Floating PnL is the PnL calculated by substituting "Close Price = Current Closable Price" into the formula.
- Actually when the quote currency and margin currency are different, it is not possible to directly obtain the precise exchange rate $P(C, A, t_2)$. However, the exchange usually directly shows the precise standard PnL in the history orders. So we can deduce the exchange rate $P(C, A, t_2)$ from the standard PnL.

[Learn more](../reference/elementary-math-in-trading) about math technical process and calculation cases.

## PnL correction

"PnL correction" mainly refers to transaction costs, which generally account for a small part of speculative trading.
The calculation of PnL correction is actually very complicated, and different exchanges may have different formats of rules to regulate trading behavior.

Let's list some rules:

1. According to trading volume : for example, the handling fee of non-ferrous metal futures of the Shanghai Futures Exchange is calculated based on a fixed amount per lot;
2. According to the turnover : for example, the handling fee of the stock index futures of CICC is calculated at 2.3% of the turnover;
3. One-way two-way : some products of handling fees are only charged when opening positions, and some are charged in both directions of opening.
4. Today's Position / yesterday's Position : China futures usually designate close today 's position and close yesterday's position to charge different fees;
5. Overnight interest : When the foreign exchange spread contract position is held overnight (usually at 0:00 Eastern European time), interest will be generated, but it will not be charged overnight;
6. Alternate Weekly Interest : Usually on Wednesday, overnight interest will be charged for 3 days at a time.
7. Dividend : When trading stocks, the position dividend will increase the PnL correction value.
8. Policy adjustment : An event in which the exchange changes the coefficients of its fees.

It has been found that it is difficult to calculate transaction costs using the standard equation.

However, the exchange must give the final true PnL in the settlement. So the PnL correction value can be deduced through the final true PnL.

So, we can use the following equation to calculate the PnL correction:

$$\text{PnL Correction} = \text{PnL} - \text{Standard PnL}$$
