---
sidebar_position: 5
---

# How to calculate margin

> Each market has its own unique margin system, and the margin calculation method introduced in this article may not be applicable to all markets. However, the standard margin introduced in this article is a basic version, and the current market margin system is based on this evolution. In actual trading, the account margin given by the exchange clearing center should be used as the standard.

The standard margin model is:

$$
\text{Standard Margin} = \frac{\sum_{\text{Position}} {\text{Volume} \times \text{Value Scale}} \times P(\text{Value Scale Unit}, C, t_1) \times P(C, A, t_1) \times \text{Margin Rate} }{\text{Account Leverage}}
$$

When:

- $A$ is the account's margin currency; $B$ is the product itself; $C$ is the product's quote currency;
- For any assets $x$, $y$ and time $t$, $P(x, y, t)$ is the price of two assets $x$ vs $y$ at time $t$, and $t_1$ is the time of position entering; $t_2$ is the time of position exiting;
- $P(B, C, t)$ is the price of the product at time $t$; You can see it directly everywhere in the market;
- Volume is the number of contract, non-negative;
- Open Price $P(B, C, t_1)$ is the price of the product at the time of position entering;
- Value scale is a constant multiple item for the product, usually 1 in spots, and is called "contract size" in futures or options contracts.
- Margin rate is a constant multiple item for the product, equivalent 1 in spots, and less than 1 in leverage trading.
- $P(C, A, t)$ is the exchange rate of the quote currency vs the margin currency at time $t$;
  - if the quote currency is the same as the margin currency, then $P(C, A, t) = 1$, you can ignore this item;
- Value scale unit is the unit of value scale, usually refers to the product itself ($B$), or the product's quote currency ($C$);
  - if it refers to the product itself, then $P(\text{Value Scale Unit}, C, t_1) = P(B, C, t_1) = \text{Open Price}$;
  - if it refers to the product's quote currency, then $P(\text{Value Scale Unit}, C, t_1) = P(C, C, t_1) = 1$;
  - for example, if the product specified that 1 contract = 100 shares of stock, then the value scale unit is the stock itself, and the value scale is 100;
  - for another example, if the product specified that 1 contract = stocks worth 1000 USD, then the value scale unit is the quote currency, and the value scale is 1000;
- Actually when the quote currency and margin currency are different, it is not possible to directly obtain the precise exchange rate $P(C, A, t_1)$. However, the exchange usually directly shows the precise standard margin in the history orders. So we can deduce the exchange rate $P(C, A, t_1)$ from the standard margin.

Once a position is opened, the used margin will not change with the price.

`free = equity - used`

The available margin will fluctuate with the fluctuation of the equity, and the necessary condition for opening a position is that the available margin is not less than the margin required to open the position.

$$
\text{Margin-equity Ratio} =  \frac{\text{Used Margin}}{Equity} \times 100\%
$$

Margin-equity ratio is used to measure the overall risk of an account.

- When the Margin-equity ratio is greater than 100%, it means that the free margin is negative, and the position cannot be opened at this time, and there is a risk of forced position squaring (**liquidation**).
- Generally, when the Margin-equity ratio is greater than 100% ( **warning line** ), the exchange will notify users to deposit and add margin.
- When users ignore this warning and the margin-equity ratio further increase to a certain value ( **liquidation line** ), the exchange will adopt risk control measures to forcibly close a part of the user's position, causing the used margin to decrease and the margin-equity ratio to rebound. Eventually, under continuous losses, all positions may be forced to position squaring, and the account balance may eventually return to zero or almost zero. In the case of severe market fluctuations, the account balance may eventually be negative, indicating that there is a liability . The exchange usually controls the relationship between the system leverage ratio and the liquidation line to ensure that users do not have debt as much as possible, but nothing is absolute. In the case of a lower account leverage ratio, some exchange will explicitly provide a "zero debt guarantee", and will pay for the user's debt out of their own pocket to ensure that the final balance is not negative.

When the margin-equity ratio is too low, it means that the account funds are not fully utilized.

$$
\text{Actual Leverage} = \text{Margin-equity ratio} \times \text{Account Leverage}
$$

Sometimes we are more inclined to use the actual leverage ratio to express the utilization rate of funds.
When the actual leverage ratio is less than 100%, it means that no matter how the price fluctuates, as long as it is non-negative , the account will not be liquidated to zero. However, if the volatility of the variety price is very small, using too little leverage will waste the funds in the account. Therefore, the setting of the actual leverage ratio should be related to the volatility of the trading variety price. However, in the stock market, unless financing and securities lending, since the account leverage ratio is 1, the actual leverage ratio cannot exceed 100%.

Special circumstances:

- Lock Position: Long and short positions of the same variety can constitute a lock position . The sum of the profits of the lock position is constant, so there is no risk, so it is reasonable to reduce the margin in principle. Generally, a coefficient less than 1 is multiplied to the sum of the margin of the lock positions as the total margin.
- Cross/Isolated: In contract trading on crypto exchanges , there is a common margin calculation mechanism - "full position" - that is, the maximum amount of margin for all positions is taken as the account margin. This actually allows users to hold more positions, which is a policy to encourage leverage and increase market activity level.
- China futures adopt a daily mark-to-market system , which recalculates the margin after the daily close, essentially using the settlement price as the latest opening price. It can be understood as forced position closed-and-reopen. This system, by regularly bringing the net value closer to the balance and recalculating the used margin, advances the timing of adding margin for losers, ultimately helping to reduce the default risk of market participants.
