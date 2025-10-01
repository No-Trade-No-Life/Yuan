# 提供产品规格

提供商有责任提供产品规格信息。

首先，从外部系统获取产品信息列表，然后将产品信息存储到数据库。

```ts
import { Terminal, writeDataRecords } from '@vendor/protocol';
import { defer, repeat, retry, shareReplay, delayWhen, map, from } from 'rxjs';

const terminal = Terminal.fromNodeEnv();

/// Note: Api.getAllProducts 需要自行实现
const products$ = defer(() => Api.getAllProducts()) // 从外部系统 API 获取所有产品信息列表
  .pipe(
    // 将外部系统的产品信息转换为 Yuan 的产品信息
    map((extProducts) =>
      extProducts.map((x) => ({
        // 需要定义一个全局唯一的产品 ID (建议用提供商的名字作为前缀)
        product_id: `${VENDOR_NAME}/${x.id}`,
        // ...映射其他字段 (自行实现)
      })),
    ),
    // 每小时重试 (根据实际情况调整)
    repeat({ delay: 3600_000 }),
    retry({ delay: 3600_000 }),
    // 缓存最新的产品信息
    shareReplay(1),
  );

// 将产品信息存储到数据库
products$
  .pipe(
    delayWhen((products) => from(writeDataRecords(terminal, products.map(getDataRecordWrapper('product')!)))),
  )
  .subscribe();
```

:::info[为什么需要将产品信息存储到数据库？]

1. 产品规格在 Yuan 中是一个需要被频繁访问的信息，将其存储到数据库可以提高访问速度。
2. 外部系统可能对 API 接口限流，不能接受每次查询的时候去外部系统里查询，效率很低。
3. 产品规格信息的变化是低频率的，缓存的价值很高。

:::

:::info[如果外部系统不支持全量查询产品信息怎么办？]

可以选择不实现全量查询，而是实现增量查询。

:::
