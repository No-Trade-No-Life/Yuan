---
sidebar_position: 4
---

# How to calculate PnL

> PnL = Standard PnL + PnL Correction

## Standard PnL

**Standard PnL = Position Direction \* Position Volume \* (Close Price - Open Price) \* Product Value Speed \* Factor of Asset \* Base Currency Exchange Rate
**

- Position Direction = 1 if long, -1 if short;
- Factor of Asset = 1 / Close Price if foreign exchange or bond spot, otherwise 1;
- Base Currency Exchange Rate = the exchange rate of **product's base currency** vs **account's margin currency** at the time of position exiting.

This standard equation applies to the calculation of PnL in ideal cases for all known products such as stocks, foreign exchange, bonds, commodity futures, precious metals, option contracts, etc.

- Supplement: Value speed is a constant for the same product, usually 1 in stocks, and is called "contract size" in futures or options contracts.
- Supplement: Floating PnL is the PnL calculated by substituting "Close Price = Current Closable Price" into the formula.
- Supplement : For cases where the base currency and margin currency are different , it is not possible to directly obtain the base currency exchange rate at the time of position squaring from historical orders. However, the exchange usually directly gives the standard PnL of the order. At this time, the price of the base currency against the margin currency at the time of position squaring can be deduced from the PnL.

## PnL correction

"PnL correction" mainly refers to transaction costs, which generally account for a small part of speculative trading.
The calculation of PnL correction is actually very complicated, and different exchanges may have different formats of rules to regulate trading behavior.

Let's learn some rules:

1. According to trading volume : for example, the handling fee of non-ferrous metal futures of the Shanghai Futures Exchange is calculated based on a fixed amount per lot;
2. According to the turnover : for example, the handling fee of the stock index futures of CICC is calculated at 2.3% of the turnover;
3. One-way two-way : some products of handling fees are only charged when opening positions, and some are charged in both directions of opening.
4. Today's Position / yesterday's Position : China futures usually designate close today 's position and close yesterday's position to charge different fees;
5. Overnight interest : When the foreign exchange spread contract position is held overnight (usually at 0:00 Eastern European time), interest will be generated, but it will not be charged overnight;
6. Alternate Weekly Interest : Usually on Wednesday, overnight interest will be charged for 3 days at a time.
7. Dividend : When trading stocks, the position dividend will increase the PnL correction value.
8. Policy adjustment : An event in which the exchange changes the coefficients of its fees.

It has been found that it is difficult to calculate transaction costs using the standard equation.

However, the exchange will definitely give the final true PnL in the settlement, and at least the PnL correction value can be deduced through the final true PnL.

So, we can use the following equation to calculate the PnL correction:

PnL Correction = PnL - Standard PnL
