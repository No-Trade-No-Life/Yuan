# Providing Real-Time Market Data

Suppliers can provide real-time market data through channels for other terminals to subscribe to.

It is recommended to use the `provideTicks` method to provide real-time Tick market data.

```ts
import { provideTicks } from '@yuants/protocol';
import { ITick } from '@yuants/data-model';
import { combineLatest, defer, map } from 'rxjs';

provideTicks(terminal, VENDOR_NAME, (product_id) => {
  return combineLatest([
    defer(() => Api.getProduct(product_id)), // Product information (needs to be implemented by yourself)
    defer(() => Api.getPrice(product_id)), // Price information (needs to be implemented by yourself)
  ]).pipe(
    map(([product_info, price_info]): ITick => {
      return {
        product_id,
        updated_at: Date.now(),
        // ...other fields
      };
    }),
  );
});
```

- Suppliers provide real-time market data for all products prefixed with `VENDOR_NAME`. However, this does not guarantee that all products prefixed with `VENDOR_NAME` exist, so suppliers need to determine whether the product ID exists themselves. Generally, suppliers are indeed responsible for verifying the existence of product IDs within their jurisdiction.
- When a product ID does not exist, an `EMPTY` stream can be returned, which does not return any data and is a completed stream.
- The frequency of Tick pushes is determined by the supplier. In principle, data should be pushed as frequently as possible. It should not be too sparse to avoid outdated market data in the Yuan system. For high-frequency trading products, the push frequency should be higher.
