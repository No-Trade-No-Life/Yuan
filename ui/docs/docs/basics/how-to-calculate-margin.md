---
sidebar_position: 3
---

# How to calculate margin

> Each market has its own unique margin system, and the margin calculation method introduced in this article may not be applicable to all markets. However, the standard margin introduced in this article is a basic version, and the current market margin system is based on this evolution. In actual trading, the account margin given by the exchange clearing center should be used as the standard.

The standard margin model is:

$$
\sum_{p \in Positions} \frac{p.volume \times p.value_speed  \times infer_f(p) \times base_currency_exchange(p) \times  p.margin\_rate }{account.money.leverage}} 
$$

$$
times infer_f(p) = \begin{cases}  
  1,       & FX and Bond Spot \\
  p.开仓价, & \text{otherwise}
\end{cases}
$$

$$
base_currency_exchange(p) = \begin{cases}
    \text{price of product.base_currency vs account.money.currency when opening the position},  & product.base_currency \ne account.money.currency \\
    1,                          & \text{otherwise}
\end{cases}
$$

Once a position is opened, the used margin will not change with the price.

`free = equity - used`

The available margin will fluctuate with the fluctuation of the equity, and the necessary condition for opening a position is that the available margin is not less than the margin required to open the position.

**Margin-equity ratio** = 100% \* used margin / equity

Margin-equity ratio is used to measure the overall risk of an account.

- When the Margin-equity ratio is greater than 100%, it means that the free margin is negative, and the position cannot be opened at this time, and there is a risk of forced position squaring (**liquidation**).
- Generally, when the Margin-equity ratio is greater than 100% ( **warning line** ), the exchange will notify users to deposit and add margin.
- When users ignore this warning and the margin-equity ratio further increase to a certain value ( **liquidation line** ), the exchange will adopt risk control measures to forcibly close a part of the user's position, causing the used margin to decrease and the margin-equity ratio to rebound. Eventually, under continuous losses, all positions may be forced to position squaring, and the account balance may eventually return to zero or almost zero. In the case of severe market fluctuations, the account balance may eventually be negative, indicating that there is a liability . The exchange usually controls the relationship between the system leverage ratio and the liquidation line to ensure that users do not have debt as much as possible, but nothing is absolute. In the case of a lower account leverage ratio, some exchange will explicitly provide a "zero debt guarantee", and will pay for the user's debt out of their own pocket to ensure that the final balance is not negative.

When the margin-equity ratio is too low, it means that the account funds are not fully utilized.

Actual leverage ratio = Margin-equity ratio \* account leverage ratio

Sometimes we are more inclined to use the actual leverage ratio to express the utilization rate of funds.
When the actual leverage ratio is less than 100%, it means that no matter how the price fluctuates, as long as it is non-negative , the account will not be liquidated to zero. However, if the volatility of the variety price is very small, using too little leverage will waste the funds in the account. Therefore, the setting of the actual leverage ratio should be related to the volatility of the trading variety price. However, in the stock market, unless financing and securities lending, since the account leverage ratio is 1, the actual leverage ratio cannot exceed 100%.

Special circumstances:

- Lock Position: Long and short positions of the same variety can constitute a lock position . The sum of the profits of the lock position is constant, so there is no risk, so it is reasonable to reduce the margin in principle. Generally, a coefficient less than 1 is multiplied to the sum of the margin of the lock positions as the total margin.
- Cross/Isolated: In contract trading on crypto exchanges , there is a common margin calculation mechanism - "full position" - that is, the maximum amount of margin for all positions is taken as the account margin. This actually allows users to hold more positions, which is a policy to encourage leverage and increase market activity level.
- China futures adopt a daily mark-to-market system , which recalculates the margin after the daily close, essentially using the settlement price as the latest opening price. It can be understood as forced position closed-and-reopen. This system, by regularly bringing the net value closer to the balance and recalculating the used margin, advances the timing of adding margin for losers, ultimately helping to reduce the default risk of market participants.
