# 提供历史行情数据

[行情数据](../basics/what-is-market-data)有若干种不同的具体类型，但都可以归结为对特定类型，在特定的时间范围内的，对特定序列的查询。

```ts
import { decodeOHLCSeriesId } from '@yuants/data-ohlc';
import { Terminal, provideSeriesData } from '@yuants/protocol';

const terminal = Terminal.fromNodeEnv();

provideDataSeries(
  terminal,
  {
    // 数据序列的类型
    type: 'ohlc',
    // 数据序列的正则表达式，匹配的 Series ID 会被传入到回调函数中
    pattern: `^${VENDOR_NAME}/`,
  },
  async (series_id, [from, to]) => {
    // 从 Series ID 中解析出产品 ID 和周期
    const { product_id, duration } = decodeOHLCSeriesId(series_id);
    // 从外部系统获取 OHLC 数据 (需要自行实现)
    const res = await Api.getOHLC(product_id, duration, from, to);
    // 转换为 Yuan 的 OHLC-V 数据
    return res.map((x) => ({
      product_id,
      duration,
      opened_at: x.t,
      closed_at: inferClosedAt(x.t, duration), // 计算收盘时间 (根据每个市场的规则灵活处理)
      open: x.o,
      high: x.h,
      low: x.l,
      close: x.c,
      volume: x.v,
    }));
  },
);
```

- 供应商通过 `VENDOR_NAME` 对所有前缀为 `VENDOR_NAME` 的 OHLC 数据提供历史行情数据。但这显然不能保证以 `VENDOR_NAME` 为前缀的所有 OHLC 数据都是存在的，因此供应商需要自行判断 Series ID 是否存在。一般而言，供应商也确实有责任去鉴别自身辖区内的 Series ID 是否存在。
- 当 Series ID 不存在时，抛出异常，客户端会接受到 404 错误类型。
- 当给定的时间范围内没有数据时，返回空数组。
- 当 API 返回了超出给定时间范围的数据时，Yuan 会自动过滤掉超出范围的数据。提供商不需要自行处理。
- 给定的时间范围是左闭右开区间，即 `[from, to)`，时间戳的单位是毫秒。
- OHLC 数据落库使用 `ohlc_v2` 表；旧的 `ohlc` 表已弃用。
