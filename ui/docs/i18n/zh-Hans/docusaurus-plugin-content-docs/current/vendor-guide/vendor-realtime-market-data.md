# 提供实时行情数据

供应商可以通过频道提供实时行情数据，以便于其他终端订阅。

推荐使用 `provideTicks` 方法提供实时 Tick 行情数据。

```ts
import { provideTicks } from '@yuants/protocol';
import { ITick } from '@yuants/data-model';
import { combineLatest, defer, map } from 'rxjs';

provideTicks(terminal, VENDOR_NAME, (product_id) => {
  return combineLatest([
    defer(() => Api.getProduct(product_id)), // 产品信息 (需要自行实现)
    defer(() => Api.getPrice(product_id)), // 价格信息 (需要自行实现)
  ]).pipe(
    map(([product_info, price_info]): ITick => {
      return {
        product_id,
        updated_at: Date.now(),
        // ...其他字段
      };
    }),
  );
});
```

- 供应商通过 `VENDOR_NAME` 对所有前缀为 `VENDOR_NAME` 的产品提供实时行情数据。但这显然不能保证以 `VENDOR_NAME` 为前缀的所有产品都是存在的，因此供应商需要自行判断产品 ID 是否存在。一般而言，供应商也确实有责任去鉴别自身辖区内的产品 ID 是否存在。
- 当产品 ID 不存在时，可以返回 `EMPTY` 流，不返回任何数据，并且是已完成的流。
- Tick 的推送频率由供应商自行决定，原则上，尽量频繁地推送数据。不应该过于稀疏，以免 Yuan 系统中的行情数据过时。对于高频交易的产品，推送频率应该更高。
