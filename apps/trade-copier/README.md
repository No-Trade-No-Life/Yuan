# Trade Copier

A [trade copier](https://github.com/No-Trade-No-Life/Yuan/tree/main/apps/trade-copier) is an app that copies trades from some accounts to others.

```mermaid
graph LR;

SourceAccount1_Product1 -->|x2| TargetAccount1_Product1;
SourceAccount1_Product2 -->|x1| TargetAccount2_Product2;
SourceAccount3_Product1 -->|x-1| TargetAccount1_Product1;
SourceAccount1_Product1 -->|x3| TargetAccount2_Product1;
SourceAccount2_Product1 -->|x3| TargetAccount1_Product1;
SourceAccount2_Product2 -->|x2| TargetAccount2_Product2;
SourceAccount3_Product2.A -->|x0.5| TargetAccount2_Product2;
```

- If you want to follow the signals from some agent models in your accounts.
- If you want to follow some traders' trades in your accounts.
- If you want to make a account leading others.
- If you want to scale the positions.

## Getting started

1. Prepare a host.
2. Prepare a PostgreSQL storage terminal.
3. Prepare the accounts you want to copy trades from and to.
4. Ensure the products configured in the storage. (You can use the GUI to finish this step.)
5. Write data records of `trade_copy_relation` in the storage. (You can use the GUI to finish this step.)
6. If you want to use trading algorithm, you need to write data records of `trade_copier_trade_config` in the storage. (You can use the GUI to finish this step).
7. Deploy this app in the host.
8. Restart this app if you update the `trade_copy_relation` or the `trade_copier_trade_config` records.

## Technical Notes

When the trade copier starts, it will do the following things:

1. Load relations of trade copier `trade_copy_relation` from the storage. See the `ITradeCopyRelation` interface.
2. Subscribe related account info as `Observable<IAccountInfo>`.
3. For **each target account** and **each target product**,
   1. Combine the latest related source account info list as `Observable<IAccountInfo[]>`;
   2. Summary the target account's target position;
   3. Submit orders if the target position is not equal to the target account's current position;
   4. Wait until the order-submitting request done (no matter succeeds or fails);
   5. Wait until the next target account info feed back, to ensure the target account's current position is updated;
   6. Loop until the target account's target position is equal to the target account's current position.

```mermaid
graph TD;
StartAction -->|Immediately| AccountInfoAggregateAction;
AccountInfoAggregateAction -.->|wait for target and source accounts| CalcPositionDiffAction;
AccountInfoAggregateAction -.->|timeout in 30s and retry| AccountInfoAggregateAction;
CalcPositionDiffAction -->|position diff list| CyberTradeOrderDispatchAction;
CyberTradeOrderDispatchAction -->|if no order, immediately| CompleteAction;
CyberTradeOrderDispatchAction -->|if algorithm configured| SerialOrderPlaceAction;
CyberTradeOrderDispatchAction -->|if algorithm undefined| ConcurrentOrderPlaceAction;
SerialOrderPlaceAction -.->|Orders all settled| CompleteAction;
ConcurrentOrderPlaceAction -.->|Orders all settled| CompleteAction;
CompleteAction -->|Immediately| StartAction;
```

### Model

- You can specify a certain product of a source account to a certain product of a target account.
- You can scale the position by specifying `multiple`. Trade copier will scale the position by `multiple` times. Trade copier will close the positions if the value of `multiple` is equal to 0. If the value of `multiple` is negative, the position's direction will be flip from `LONG` to `SHORT` and vice versa.
- You can ignore some positions by specifying `exclusive_comment_pattern`. The value of `exclusive_comment_pattern` should be a regular expression. If the comment of a position matches the regular expression, the position will be ignored.

```ts
interface ITradeCopyRelation {
  source_account_id: string;
  source_product_id: string;
  target_account_id: string;
  target_product_id: string;
  multiple: number;
  exclusive_comment_pattern?: string;
  disabled?: boolean;
}
interface ITradeCopierTradeConfig {
  account_id: string;
  product_id: string;
  max_volume_per_order: number;
}
```

### Q&A

#### Q: What if multiple trade copiers copy trades work with same target account?

A: **It's very dangerous.** It may cause position oscillation. Orders may be over-submitted or under-submitted. Your account balance maybe rapidly decrease. You should avoid this problem.

1. Ensure there's only one trade copier app instance in one host.
2. Ensure every target account is under only one trade copier's control if you have multiple hosts.

#### Q: What if multiple source accounts work with same target account?

A: It's OK. The trade copier will sum up the positions from multiple source accounts.
