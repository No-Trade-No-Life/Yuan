---
sidebar_position: 3
---

# Using Position Manager

> Prerequisite Reading:
>
> - [Using Hooks](./using-hooks)

**Position Manager** is one of advanced forms of hook, which helps you to manage positions by order operations.

You can compose your own position manager by using the basic hooks.

For example, you want to use a simple number to manage the target position volume.

- Positive for long and negative for short.
- Zero for close all the volume.
- Submit MARKET-price orders.

Let's see how to implement it.

## The Skeleton

Firstly, you need to define the type of the position manager. And prepare some required hooks.

```ts
export const useSimplePositionManager = (
  account_id: string,
  product_id: string,
): [number, (v: number) => void] => {
  // useState: when setTargetVolume, re-execute the agent code.
  const [targetVolume, setTargetVolume] = useState(0);
  // Get reference to the account info.
  const accountInfo = useAccountInfo({ account_id });
  // Use the exchange to submit & cancel orders.
  const exchange = useExchange();

  // returns the target volume and the setter.
  return [targetVolume, setTargetVolume];
};
```

- `useState` is used to store the target volume. When the target volume changes, the agent code will be re-executed. Then we can calculate the volume to order reactively.
- We can simply return the target volume and the setter, just as `useState` does. It's a good practice to keep the interface consistent.
- We need `useExchange` to get the methods to submit & cancel orders.
- We need `useAccountInfo` to get the actual volume of the positions.

## Calculate Order Volume

Then, you need to calculate the volume to order for LONG / SHORT positions correspond.

```ts
// Generate a random UUID for each position.
const longPositionId = useMemo(() => UUID(), []);
const shortPositionId = useMemo(() => UUID(), []);

// Get actual volume of the positions.
const longPositionVolume =
  accountInfo.positions.find((position) => position.position_id === longPositionId)?.volume ?? 0;
const shortPositionVolume =
  accountInfo.positions.find((position) => position.position_id === shortPositionId)?.volume ?? 0;

// Calc the volume to open/close.
const openLongVolume = Math.max(targetVolume - longPositionVolume, 0);
const openShortVolume = Math.max(-targetVolume - shortPositionVolume, 0);
const closeLongVolume = Math.min(longPositionVolume - targetVolume, longPositionVolume);
const closeShortVolume = Math.min(shortPositionVolume - -targetVolume, shortPositionVolume);
```

- We use `useMemo` to generate a random UUID for each position and memoize it. It's a good practice to keep the position ID unique.
- Be careful that the position may not exist before position opened. So we need to check it before using it. In case of `undefined`, we use `??` to return `0`.
- Volume of position is always non-negative. Look carefully at the calculation of the volume to open/close. Make sure you have understood it.

## Make Orders

Finally, use an Effect to handle orders.

The following code is an example of opening a long position. So does close the LONG position or open / close the SHORT position.

```ts
// ...
// OPEN LONG: submit & cancel order.
useEffect(() => {
  if (openLongVolume <= 0) return;
  const order = {
    client_order_id: UUID(),
    account_id,
    product_id,
    position_id: longPositionId,
    type: OrderType.MARKET,
    direction: OrderDirection.OPEN_LONG,
    volume: openLongVolume,
  };
  exchange.submitOrder(order);
  return () => {
    exchange.cancelOrder(order.client_order_id);
  };
}, [openLongVolume]);
// ...
```

- We use `useEffect` to submit & cancel orders. When the volume to open changes, the effect will be re-executed.
- We use `UUID` to generate a random UUID for each order. It's a good practice to keep the order ID unique.
- We use `OrderType.MARKET` to submit a MARKET-price order.
- We use `OrderDirection.OPEN_LONG` to open a LONG position. So does `OrderDirection.OPEN_SHORT` to open a SHORT position.
- We use `OrderDirection.CLOSE_LONG` to close a LONG position. So does `OrderDirection.CLOSE_SHORT` to close a SHORT position.
- We use `exchange.cancelOrder` to cancel the order when the volume to open changes and then submit a new one. (useEffect cleanup function)

View the complete source code from [GitHub](https://github.com/No-Trade-No-Life/Yuan-Public-Workspace/blob/main/%40libs/utils/useSimplePositionManager.ts):

## How to use

You can import the example workspace and import it from `@libs`.

Just like this, you can set the target position volume in an effect.

```ts
import { useSimplePositionManager } from '@libs';

export default () => {
  const [targetVolume, setTargetVolume] = useSimplePositionManager('your-account-id', 'XAUUSD');

  useEffect(() => {
    // Set target volume to 10.
    setTargetVolume(10);
  }, []);
};
```

You can also checkout the [double moving average strategy](https://github.com/No-Trade-No-Life/Yuan-Public-Workspace/blob/main/%40models/double-ma.ts) to learn how to use it.

## Further Reading

You can compose another position manager as you need. For example, use LIMIT-price order or use a complex order submitting strategy.

You can find out more custom hooks resource in the repo:

- [Yuan Public Workspace](https://github.com/No-Trade-No-Life/Yuan-Public-Workspace)
