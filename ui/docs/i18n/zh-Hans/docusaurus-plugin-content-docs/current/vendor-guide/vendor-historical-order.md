# 提供历史订单数据

[订单](../basics/what-is-order) 可以归结为对特定账户，在特定的时间范围内的查询，也是一个序列采集的问题。与历史行情数据类似，供应商需要提供历史订单数据。

```ts
import { Terminal, provideSeriesData } from '@yuants/protocol';

const terminal = new Terminal(process.env.HOST_URL!, {});

provideDataSeries(
  terminal,
  {
    // 数据序列的类型
    type: 'order',
    // 数据序列的正则表达式，匹配的 Series ID 会被传入到回调函数中
    pattern: `^${ACCOUNT_ID}/`,
  },
  async (_, [from, to]) => {
    // 不需要从 Series ID 中解析任何信息
    // 从外部系统获取历史订单数据 (需要自行实现)
    const res = await Api.getHistoryOrders(from, to);
    // 转换为 Yuan 的订单数据
    return res.map((x) => ({
      account_id: ACCOUNT_ID,
      // ... 其他字段
    }));
  },
);
```

- 提供商通过 `ACCOUNT_ID` 对所有前缀为 `ACCOUNT_ID` 的订单数据提供历史订单数据。
- 当给定的时间范围内没有数据时，返回空数组。
- 当 API 返回了超出给定时间范围的数据时，Yuan 会自动过滤掉超出范围的数据。提供商不需要自行处理。
- 给定的时间范围是左闭右开区间，即 `[from, to)`，时间戳的单位是毫秒。
