---
sidebar_position: 3
---

# 使用仓位管理器

**仓位管理器** 通过订单操作来管理仓位，是钩子的高级形式之一。

> 前置阅读：
>
> - [使用钩子](./using-hooks)

您可以通过使用基本钩子来组合自己的仓位管理器。

例如，您想使用一个简单的数字来管理目标仓位数量：

- 正数表示多头，负数表示空头。
- 零表示关闭所有仓位。
- 提交市价订单。

让我们看看如何实现它。

## 骨架

首先，您需要定义仓位管理器的类型，并准备一些必要的钩子。

```ts
export const useSimplePositionManager = (
  account_id: string,
  product_id: string,
): [number, (v: number) => void] => {
  // useState: 当 setTargetVolume 时，重新执行代理代码。
  const [targetVolume, setTargetVolume] = useState(0);
  // 获取账户信息的引用。
  const accountInfo = useAccountInfo({ account_id });
  // 使用交易所提交和取消订单。
  const exchange = useExchange();

  // 返回目标数量和设置器。
  return [targetVolume, setTargetVolume];
};
```

- `useState` 用于存储目标数量。当目标数量变化时，代理代码将重新执行。然后我们可以反应式地计算需要下单的数量。
- 我们可以简单地返回目标数量和设置器，就像 `useState` 那样。保持接口一致是一个好的实践。
- 我们需要 `useExchange` 来获取提交和取消订单的方法。
- 我们需要 `useAccountInfo` 来获取实际的仓位数量。

## 计算订单数量

然后，您需要计算对应的多头/空头仓位需要下单的数量。

```ts
// 为每个仓位生成一个随机的 UUID。
const longPositionId = useMemo(() => UUID(), []);
const shortPositionId = useMemo(() => UUID(), []);

// 获取实际的仓位数量。
const longPositionVolume =
  accountInfo.positions.find((position) => position.position_id === longPositionId)?.volume ?? 0;
const shortPositionVolume =
  accountInfo.positions.find((position) => position.position_id === shortPositionId)?.volume ?? 0;

// 计算需要开仓/平仓的数量。
const openLongVolume = Math.max(targetVolume - longPositionVolume, 0);
const openShortVolume = Math.max(-targetVolume - shortPositionVolume, 0);
const closeLongVolume = Math.min(longPositionVolume - targetVolume, longPositionVolume);
const closeShortVolume = Math.min(shortPositionVolume - -targetVolume, shortPositionVolume);
```

- 我们使用 `useMemo` 生成每个仓位的随机 UUID 并记忆它。保持仓位 ID 唯一是一个好的实践。
- 注意仓位在开仓前可能不存在。因此在使用前需要检查。如果为 `undefined`，我们使用 `??` 返回 `0`。
- 仓位的数量总是非负的。仔细查看开仓/平仓数量的计算。确保您已经理解了它。

## 下单

最后，使用 Effect 来处理订单。

以下代码是开多头仓位的示例。同样适用于平多头仓位或开/平空头仓位。

```ts
// ...
// 开多头仓位：提交和取消订单。
useEffect(() => {
  if (openLongVolume <= 0) return;
  const order = {
    order_id: UUID(),
    account_id,
    product_id,
    position_id: longPositionId,
    type: OrderType.MARKET,
    direction: OrderDirection.OPEN_LONG,
    volume: openLongVolume,
  };
  exchange.submitOrder(order);
  return () => {
    exchange.cancelOrder(order.order_id);
  };
}, [openLongVolume]);
// ...
```

- 我们使用 `useEffect` 来提交和取消订单。当开仓数量变化时，Effect 将重新执行。
- 我们使用 `UUID` 生成每个订单的随机 UUID。保持订单 ID 唯一是一个好的实践。
- 我们使用 `OrderType.MARKET` 来提交市价订单。
- 我们使用 `OrderDirection.OPEN_LONG` 来开多头仓位。同样适用于 `OrderDirection.OPEN_SHORT` 开空头仓位。
- 我们使用 `OrderDirection.CLOSE_LONG` 来平多头仓位。同样适用于 `OrderDirection.CLOSE_SHORT` 平空头仓位。
- 我们使用 `exchange.cancelOrder` 在开仓数量变化时取消订单并提交新的订单。（useEffect 清理函数）

查看完整的源代码从 [GitHub](https://github.com/No-Trade-No-Life/Yuan-Public-Workspace/blob/main/%40libs/utils/useSimplePositionManager.ts)：

## 如何使用

您可以导入示例工作区并从 `@libs` 导入它。

就像这样，您可以在一个 Effect 中设置目标仓位数量。

```ts
import { useSimplePositionManager } from '@libs';

export default () => {
  const [targetVolume, setTargetVolume] = useSimplePositionManager('your-account-id', 'XAUUSD');

  useEffect(() => {
    // 设置目标数量为 10。
    setTargetVolume(10);
  }, []);
};
```

您还可以查看 [双均线策略](https://github.com/No-Trade-No-Life/Yuan-Public-Workspace/blob/main/%40models/double-ma.ts) 以了解如何使用它。

## 进一步阅读

您可以根据需要组合另一个仓位管理器。例如，使用限价订单或使用复杂的订单提交策略。

您可以在仓库中找到更多自定义钩子资源：

- [Yuan 公共工作区](https://github.com/No-Trade-No-Life/Yuan-Public-Workspace)
