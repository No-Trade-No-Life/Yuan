---
sidebar_position: 2
---

# 使用 Hooks

"**Hooks**"，或称为 "**可组合函数**"，是 Agent 的构建要素。

它受到 React Hooks 的启发，但并不完全相同，因为 Agent 的使用场景更为简单。

通过可组合函数的思维，你可以轻松构建一个健壮的策略。

## 基本 Hooks

### `useRef`

Agent 是一个无状态函数，因此它不能在函数体中存储数据。

例如，如果你想创建一个计数器，你可能会使用全局变量：

```ts
let i = 0;
// 每次执行 Agent 时，计数器都会增加 1
export default () => {
  i++;
};
```

使用全局变量在重用代码时会带来一些麻烦。

因此，我们**推荐**你使用 `useRef` 来处理这个问题。

`useRef` 是一个基本的 Hook，用于存储将来会用到的数据。

例如，如果你想创建一个计数器，可以使用 `useRef` 来存储计数器的值。

```ts
export default () => {
  const ref = useRef(0);
  // 从 0 开始计数，每次调用 Agent 时增加 1
  ref.current++;
};
```

- `useRef` 可以多次调用，每次调用都会创建一个新的 ref。
- 不要将 Hook 放在条件语句或循环中，它应该放在函数体的顶层。**所有 Hook 都应如此。**

### `useEffect`

当你想执行一些副作用时，可以使用 `useEffect`。

例如，你想增加计数器。

```ts
export default () => {
  const ref = useRef(0);
  useEffect(() => {
    ref.current++;
  });
};
```

`useEffect` 有一个第二个参数，是一个依赖数组。在执行副作用之前，依赖项会与之前的依赖项进行比较。如果依赖项不同，副作用将**立即**执行。

- 如果没有提供依赖项，副作用将在每次调用 Agent 时执行。
- 如果提供了依赖项，副作用将在依赖项不同时执行。
- 如果依赖项是一个空数组，副作用将只执行一次。
- 注意依赖项是通过引用而不是值进行比较的。因此，你应该注意数组项是否是 JS 对象。

```ts
export default () => {
  const ref = useRef(0);
  // 只执行一次，通常用于初始化数据
  useEffect(() => {
    ref.current++;
  }, []);
};
```

例如，你想在新 OHLC 数据接收时执行副作用。

```ts
export default () => {
  const ref = useRef(0);
  const { close } = useParamOHLC();
  // 当 close 的长度改变时执行
  useEffect(() => {
    ref.current++;
  }, [close.length]);
};
```

你还可以在第一个参数中设置清理逻辑。

```ts
export default () => {
  const ref = useRef(0);
  const { close } = useParamOHLC();
  // 当 close 的长度改变时执行
  useEffect(() => {
    ref.current++;
    return () => {
      // 清理逻辑，在下一次副作用执行前执行
      ref.current--;
    };
  }, [close.length]);
  // 这样计数器不会无限增加
};
```

- 清理函数将在下一次副作用执行前执行。
- 当 Agent 停止时，清理函数将执行。
- 当你想执行一些清理逻辑时很有用，例如取消订单。

### `useState`

`useState` 用于存储 Agent 的状态。

与 `useRef` 不同，`useState` 会在状态改变时导致 Agent 重新执行。

```ts
export default () => {
  const [count, setCount] = useState(0);
  // 从 0 开始计数，每次调用 Agent 时增加 1
  // 注意：以下代码会导致无限循环
  setCount(count + 1); // 这将导致 Agent 重新执行并再次调用 setCount
};
```

- `useState` 返回一个元组，第一个元素是状态，第二个元素是改变状态的函数。

### `useMemo`

`useMemo` 用于缓存函数的结果。通常用于昂贵的计算或缓存对象引用。

- `useMemo` 需要第二个参数，是一个依赖数组。
- 第一个参数是一个函数，当依赖项改变时执行。
- 第一个参数的返回值将作为 `useMemo` 的返回值。

```ts
export default () => {
  const [count, setCount] = useState(0);
  const array = useMemo(() => {
    // 昂贵的计算。仅在 count 改变时重新计算
    const array = [];
    for (let i = 0; i < count; i++) {
      array.push(i);
    }
    return array;
  }, [count]);
  // 仅在 count（array）改变时打印
  useEffect(() => {
    console.log(array);
  }, [array]);
};
```

### 注意事项

- Agent 是一个无状态函数，因此你不应该使用 `var` 或 `let` 声明变量。
- 不要将 Hook 放在条件语句或循环中，它应该放在函数体的顶层。
- 规则可能会导致无限重新执行，如果它们相互冲突。你应该避免这种情况。

## 数据 Hooks

### `useOHLC`

`useOHLC` 用于获取 OHLC(+V) 数据。

- 第一个参数是 datasource_id。
- 第二个参数是 product_id。
- 第三个参数可以是字符串或数字。如果是字符串，它应该是一个 [RFC-3339 持续时间](https://www.rfc-editor.org/rfc/rfc3339#appendix-A) 字符串。如果是数字（已弃用），它应该是以秒为单位的周期（60 = 1 分钟，300 = 5 分钟，900 = 15 分钟，3600 = 1 小时，86400 = 1 天，...）。

```ts
export default () => {
  const { time, open, high, low, close, volume } = useOHLC('Y', 'XAUUSD', 'PT1H');
};
```

- `time`, `open`, `high`, `low`, `close`, `volume` 都是 [时间序列](./using-time-series.md)。
- `time` 是时间戳的毫秒级 epoch 序列。

### `useProduct`

`useProduct` 用于获取 [产品](../basics/what-is-product) 信息。

```ts
export default () => {
  const product = useProduct('Y', 'XAUUSD');
  // ...
};
```

### `useAccountInfo`

`useAccountInfo` 用于获取账户信息。

```ts
export default () => {
  const accountInfo = useAccountInfo();
  // ...
};
```

你也可以指定选项来初始化账户。

```ts
export default () => {
  const accountInfo = useAccountInfo({
    account_id: 'YOUR_ACCOUNT_ID',
    currency: 'USD',
    leverage: 100,
    initial_balance: 100_000,
  });
  // ...
};
```

你也可以创建多个账户。

```ts
export default () => {
  const accountInfo1 = useAccountInfo();
  const accountInfo2 = useAccountInfo({
    account_id: accountInfo1.account_id + '-Suffix',
  });
  // ...
};
```

- 你可以多次调用 `useAccountInfo`，每次调用都会重用相同的账户，如果 account_id 相同。
- 每个账户都有独立的资金、持仓和订单。你可以在一个 Agent 中维护多个账户。
- 如果未指定 account_id，kernel_id 将作为 account_id。

### `useExchange`

`useExchange` 用于执行订单操作。

例如，你想在 Agent 启动时开多头仓位。

```ts
export default () => {
  const accountInfo = useAccountInfo();
  const exchange = useExchange();
  const positionId = useMemo(() => UUID(), []);
  useEffect(() => {
    exchange.submitOrder({
      account_id: accountInfo.account_id,
      order_id: UUID(),
      product_id: 'XAUUSD',
      position_id: positionId,
      type: OrderType.MARKET,
      direction: OrderDirection.OPEN_LONG,
      volume: 1,
    });
  }, []);
};
```

- 你必须指定 account_id、position_id 和 order_id，否则订单可能不会执行。
- 你可以列出、提交、取消和修改订单。

## 自定义参数

你可以设置自定义参数。这样你可以在不改变代码的情况下改变参数。

- 你可以提取任何字符串、数字或布尔值作为参数。
- 当你想在一个 Agent 代码中适应多个产品时很有用。
- 当你想为不同产品优化参数时很有用。

### `useParamString`

`useParamString` 用于获取 Agent 的字符串参数。

```ts
export default () => {
  const paramString = useParamString('custom-param-name');
  // ...
};
```

你可以在 AgentConf 表单中找到字符串参数。如果没有，点击“刷新”按钮。

- 第一个参数是参数的名称。
- 第二个参数是参数的默认值。
- 具有相同名称的参数 Hook 将返回相同的值。
- 如果未提供参数且没有默认值，将抛出错误。

### `useParamNumber`

`useParamNumber` 用于获取 Agent 的数字参数。

- 类似于 `useParamString`，但返回值是一个数字。

### `useParamBoolean`

`useParamBoolean` 用于获取 Agent 的布尔参数。

- 类似于 `useParamString`，但返回值是一个布尔值。

## 自定义 Hooks

Hook 的一个重要特性是你可以组合自己的 Hooks。

- 自定义 Hooks 遵循所有内置 Hooks 的规则。
- 推荐使用 `use` 作为函数名的前缀。（即使不使用也可以工作）
- 自定义 Hooks 可以调用其他 Hooks。
- 自定义 Hooks 可能有参数和返回值。
- 你可以将自定义 Hooks 放在另一个源文件中并导入它。

例如，你想跟踪账户权益并将其绘制成折线图。

```ts
const useEquitySeries = (account_id: string, clock: Series) => {
  const series = useSeries('Equity', clock, { display: 'line', chart: 'new' });
  const accountInfo = useAccountInfo({ account_id });
  // 当 clock 序列增加时，将权益推入序列
  useEffect(() => {
    series.push(accountInfo.money.equity);
  }, [clock.length]);
  return series;
};

export default () => {
  const accountInfo = useAccountInfo();
  const { close } = useOHLC('Y', 'XAUUSD', 'PT1H');
  const equitySeries = useEquitySeries(accountInfo.account_id, close);
  // 你也可以为另一个账户创建序列
  const accountInfo2 = useAccountInfo({ account_id: 'interesting' });
  const equitySeries = useEquitySeries(accountInfo2.account_id, close);
  // ... 做其他事情
};
```

## 进一步阅读

你可以在以下文章中了解更多关于 Agent Hooks 的信息：

- [使用时间序列](./using-time-series.md)
- [使用仓位管理器](./using-position-manager)
- [使用技术指标](./using-technical-indicators)
- 使用账户转换（TODO）

你可以在以下仓库中找到更多自定义 Hooks 资源：

- [Yuan 公共工作区](https://github.com/No-Trade-No-Life/Yuan-Public-Workspace)
