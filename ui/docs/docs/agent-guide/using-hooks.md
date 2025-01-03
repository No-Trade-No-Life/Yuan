---
sidebar_position: 2
---

# Using Hooks

"**Hooks**", or called "**Composable Functions**", are the building blocks of Agent.

It's inspired by React Hooks, but it's not the all same because agent scene is simpler.

Thinking in composable functions, you can build a robust strategy easily.

## Basic Hooks

### `useRef`

The agent is a stateless function, so it cannot store data in the function body.

For example, if you want to create a counter, you may use global variable like this:

```ts
let i = 0;
// So every time the agent is executed, counter will increase by 1.
export default () => {
  i++;
};
```

Using global variable has some trouble when you reuse code.

So we **recommend** you to use `useRef` to handle this problem.

The fundamental hook is `useRef`, which is used to store the data that will be used in the future.

For example, if you want to create a counter, you can use `useRef` to store the counter value.

```ts
export default () => {
  const ref = useRef(0);
  // count up from 0, and increase by 1 every time the agent is called
  ref.current++;
};
```

- `useRef` can be called multiple times, and each call will create a new ref.
- Don't place the hook in a conditional statement or loop, it should be placed at the top level of the function body. **So as all the hooks.**

### `useEffect`

When you want to do some side-effects, you can use `useEffect`.

For example, you want to increase the counter.

```ts
export default () => {
  const ref = useRef(0);
  useEffect(() => {
    ref.current++;
  });
};
```

`useEffect` has a second parameter, which is an array of dependencies.
Before the effect executed, the dependencies will be compared with the previous dependencies.
If the dependencies are different, the effect will be **immediately** executed.

- If the dependencies are not provided, the effect will be executed every time the agent is called.
- If the dependencies are provided, the effect will be executed when the dependencies are different.
- If the dependencies are an empty array, the effect will be executed only once.
- Note that the dependencies are compared by reference, not by value. So you should care if your array item is JS object.

```ts
export default () => {
  const ref = useRef(0);
  // only executed once, usually used to initialize the data
  useEffect(() => {
    ref.current++;
  }, []);
};
```

For example, you want to do effect if new OHLC data is received.

```ts
export default () => {
  const ref = useRef(0);
  const { close } = useParamOHLC();
  // executed when the length of close is changed
  useEffect(() => {
    ref.current++;
  }, [close.length]);
};
```

You can also set up a cleanup logic in the first parameter.

```ts
export default () => {
  const ref = useRef(0);
  const { close } = useParamOHLC();
  // executed when the length of close is changed
  useEffect(() => {
    ref.current++;
    return () => {
      // cleanup logic, execute before the next effect
      ref.current--;
    };
  }, [close.length]);
  // so that the counter will not increase infinitely
};
```

- Cleanup function will be executed before the next effect.
- When the agent is stopping, the cleanup function will be executed.
- It's useful when you want to do some cleanup logic, such as canceling a order.

### `useState`

`useState` is used to store the state of the agent.

Different from `useRef`, `useState` will cause the agent to be re-executed when the state is changed.

```ts
export default () => {
  const [count, setCount] = useState(0);
  // count up from 0, and increase by 1 every time the agent is called
  // CAUTION: the following code will cause infinite loop
  setCount(count + 1); // it will cause the agent to be re-executed and call setCount again
};
```

- `useState` returns a tuple, the first item is the state, the second item is the function to change the state.

### `useMemo`

`useMemo` is used to cache the result of a function. Usually used in expensive computation or cache an object reference.

- `useMemo` required a second parameter, which is an array of dependencies.
- The first parameter is a function, which will be executed when the dependencies are changed.
- The return value of first parameter will be treated as the return value of `useMemo`.

```ts
export default () => {
  const [count, setCount] = useState(0);
  const array = useMemo(() => {
    // Expensive computation. Recompute only if count changes
    const array = [];
    for (let i = 0; i < count; i++) {
      array.push(i);
    }
    return array;
  }, [count]);
  // Print only if the count (array) changed
  useEffect(() => {
    console.log(array);
  }, [array]);
};
```

### Caveats

- The agent is a stateless function, so you should not use `var` or `let` to declare variables.
- Don't place the hook in a conditional statement or loop, it should be placed at the top level of the function body.
- Rules may cause infinite re-execution if they are conflict with each other. You should avoid it.

## Data Hooks

### `useOHLC`

`useOHLC` is used to get the OHLC(+V) data.

- The first parameter is the datasource_id.
- The second parameter is the product_id.
- The third parameter can be a string or a number. if it's a string, it should be a [RFC-3339 duration](https://www.rfc-editor.org/rfc/rfc3339#appendix-A) string. If it's a number (deprecated), it should be the period in seconds (60 = 1min, 300 = 5min, 900 = 15min, 3600 = 1hour, 86400 = 1day, ...).

```ts
export default () => {
  const { time, open, high, low, close, volume } = useOHLC('Y', 'XAUUSD', 'PT1H');
};
```

- `time`, `open`, `high`, `low`, `close`, `volume` are all [Time Series](./using-time-series.md).
- `time` is the series of timestamp epoch in milliseconds.

### `useProduct`

`useProduct` is used to get the [product](../basics/what-is-product) information.

```ts
export default () => {
  const product = useProduct('Y', 'XAUUSD');
  // ...
};
```

### `useAccountInfo`

`useAccountInfo` is used to get the account information.

```ts
export default () => {
  const accountInfo = useAccountInfo();
  // ...
};
```

You can also specify the option to initialize the account.

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

You can also create multiple accounts.

```ts
export default () => {
  const accountInfo1 = useAccountInfo();
  const accountInfo2 = useAccountInfo({
    account_id: accountInfo1.account_id + '-Suffix',
  });
  // ...
};
```

- You can call `useAccountInfo` multiple times, and each call will reuse the same account if the account_id is same.
- Every account has independent money, positions and orders. You can maintain multiple accounts in one agent.
- If the account_id is not specified, kernel_id will be treated as the account_id.

### `useExchange`

`useExchange` is used to execute order operation.

For example, you want to open a long position when the agent is started.

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

- You must specify the account_id, position_id and order_id, otherwise the order may not be executed.
- You can list, submit, cancel and modify orders.

## Custom Parameters

You can set up custom parameters. So you can change the parameters without changing the code.

- You can extract any string, number or boolean values as parameter.
- Useful when you want to fit multiple products in one agent code.
- Useful when you want to optimize the parameters for different products.

### `useParamString`

`useParamString` is used to get the parameter string of the agent.

```ts
export default () => {
  const paramString = useParamString('custom-param-name');
  // ...
};
```

You can find the parameter string in the AgentConf form. If not, click the 'refresh' button.

- The first parameter is the name of the parameter.
- The second parameter is the default value of the parameter.
- Parameter hooks with same name will return the same value.
- An error will thrown if the parameter is not provided and no default value.

### `useParamNumber`

`useParamNumber` is used to get the parameter number of the agent.

- Similar with `useParamString`, but the return value is a number.

### `useParamBoolean`

`useParamBoolean` is used to get the parameter boolean of the agent.

- Similar with `useParamString`, but the return value is a boolean.

## Custom Hooks

The very important feature of Hook is that you can compose your own hooks.

- Custom hooks obey the all rules of built-in hooks.
- Recommend to use `use` as prefix of the function name. (still works if you don't)
- Custom hooks can call other hooks.
- Custom hooks might have parameters and return value.
- You can place the custom hooks in another source file and import it.

For example, you want to track the account equity in a series, drawing them into a line chart.

```ts
const useEquitySeries = (account_id: string, clock: Series) => {
  const series = useSeries('Equity', clock, { display: 'line', chart: 'new' });
  const accountInfo = useAccountInfo({ account_id });
  // when clock series increased, push the equity to the series
  useEffect(() => {
    series.push(accountInfo.money.equity);
  }, [clock.length]);
  return series;
};

export default () => {
  const accountInfo = useAccountInfo();
  const { close } = useOHLC('Y', 'XAUUSD', 'PT1H');
  const equitySeries = useEquitySeries(accountInfo.account_id, close);
  // you can also create series for another account
  const accountInfo2 = useAccountInfo({ account_id: 'interesting' });
  const equitySeries = useEquitySeries(accountInfo2.account_id, close);
  // ... do something
};
```

## Further Reading

You can learn more about Agent Hooks in the following articles:

- [Using Time Series](./using-time-series.md)
- [Using Position Manager](./using-position-manager)
- [Using Technical Indicators](./using-technical-indicators)
- Using Account Transformation (TODO)

You can find out more custom hooks resource in the repo:

- [Yuan Public Workspace](https://github.com/No-Trade-No-Life/Yuan-Public-Workspace)
