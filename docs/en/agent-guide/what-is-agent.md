---
sidebar_position: 1
---

# What is Agent

> Agent is a bot that process the data and give trading signals. In other words, it is a trading strategy model.

## Basic Structure

Agent is a TypeScript source code file, exporting a default function.

```ts
export default () => {
  // ...
};
```

- the function has no parameters
- the function has no return value
- the function will be called,
  - when the agent is started
  - when the data is updated
  - when the agent considers it's necessary to update

In this function, you can use Yuan's built-in functions to get the data you need, and then use the data to calculate the trading signals.

```ts
import { useSMA, useSimplePositionManager } from '@libs';

export default () => {
  const { close } = useOHLC('Y', 'XAUUSD', 'PT1H');
  const ma20 = useSMA(close, 20);
  const accountInfo = useAccountInfo();
  const [targetVolume, setTargetVolume] = useSimplePositionManager(accountInfo.account_id, 'XAUUSD');
  useEffect(() => {
    const idx = close.length - 2;
    if (close[idx] > ma20[idx]) {
      setTargetVolume(1);
    } else {
      setTargetVolume(0);
    }
  }, [close.length]);
};
```

## Run the Agent

You can find a AgentConf form in the GUI. Fill the form and click the "Run" button.

## Further Reading

- [Using Hooks](./using-hooks)
