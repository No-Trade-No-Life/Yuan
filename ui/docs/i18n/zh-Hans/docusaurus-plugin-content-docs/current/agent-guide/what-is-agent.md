---
sidebar_position: 1
---

# 什么是 Agent

> Agent 是一个处理数据并提供交易信号的机器人。换句话说，它是一个交易策略模型。

## 基本结构

Agent 是一个 TypeScript 源代码文件，导出一个默认函数。

```ts
export default () => {
  // ...
};
```

- 该函数没有参数
- 该函数没有返回值
- 该函数会在以下情况下被调用：
  - 当 Agent 启动时
  - 当数据更新时
  - 当 Agent 认为有必要更新时

在这个函数中，你可以使用 Yuan 的内置函数来获取你需要的数据，然后使用这些数据来计算交易信号。

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

## 运行 Agent

你可以在图形用户界面中找到一个 AgentConf 表单。填写表单并点击“运行”按钮。

## 进一步阅读

- [使用 Hooks](./using-hooks)
