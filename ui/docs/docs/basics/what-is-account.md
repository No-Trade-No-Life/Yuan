---
sidebar_position: 2
---

# What is Account

> All the meaning of trading are to **increase the balance of the account**.

You may have used "bank account" before. It's actually a simplified version of the account which only involves changes in the balance.

Now we introduce a broader concept of **account**:

The account contains **money** and **positions**.

## Money

Money is described as a kind of currency and several different amount of money.

| Field Name | Description                                  | Example Value |
| :--------- | :------------------------------------------- | :------------ |
| `currency` | The kind of currency                         | `"USD"`       |
| `balance`  | The amount of balance                        | `10000`       |
| `equity`   | The amount of equity                         | `15000`       |
| `profit`   | The amount of floating PnL (profit and loss) | `5000`        |
| `used`     | The amount of used margin                    | `100`         |
| `free`     | The amount of free margin                    | `14900`       |
| `leverage` | The leverage of this account, default to 1   | `1`           |

This equation is always true: `equity` = `balance` + `profit` = `used` + `free`

The floating PnL of an account is the sum of the floating PnL of each position in the account.

**Floating PnL = sum of all positions' floating PnL**

Margin Used for an account is a function of Margin Used for each position in the account:

**Used Margin = f(Positions)**

The calculation algorithm is usually:

1. Calculate floating PnL using the positions
2. Calculate the used margin using the positions
3. Calculate the equity using the balance and floating PnL
4. Calculate free margin using equity and used margin

## Positions

Positions including foreign currencies, stocks, commodities, bonds, etc.
All assets that you think will eventually be sold for your currency balance belong to your position.

---

**How to change the balance of your account?** There are only 2 ways:

1. **Trading** : Your position will gain or lose due to changes in market prices, and exiting your position will change your balance.
2. **Transfer** : Asset transfer between your account and other accounts. Simply put, it is deposit and withdrawal.

## Trading

Account trading involves five basic variables: balance, floating profit and loss (floating PnL), equity, used margin, and free margin.

1. Firstly, the account will have a balance, which is a primary variable and does not depend on other variables.
2. Then you choose a [product](./what-is-product.md) that you think has a profit opportunity.
3. You can submit orders to the exchange to prepare to establish a position.
4. When entering the position, you need to pay a certain amount of margin. (the **free margin** will be converted into **used margin**)
5. In the process of price changes, the floating PnL caused by the price difference will change in real time.
6. Then you can choose to exit the position at a certain market price at a certain time, and the floating PnL will be converted into a balance.
7. By this way, your balance will continue to accumulate.

### How to calculate margin

The principle is that the larger the position, the greater the risk, and the more margin required, generally linearly positively correlated with the number of positions. When the free margin is insufficient, the exchange will **refuse** to open the position. The specific calculation method depends on the exchange rules.

See [How to calculate margin](./how-to-calculate-margin.md)

### How to calculate PnL

See [How to calculate PnL](./how-to-calculate-pnl.md)

## Transfer

Transfer is a special operation that is not a transaction, but it will affect the balance.
Transfer in, balance + 5000 USD, note as XXX
Transfer out, balance -10000 USD, note as YYY
This is a typical transfer .
