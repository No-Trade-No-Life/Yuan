# Providing Product Specifications

Vendors are responsible for providing product specification information.

First, obtain the list of product information from the external system, and then store the product information in the database.

```ts
import { Terminal, writeDataRecords } from '@vendor/protocol';
import { defer, repeat, retry, shareReplay, delayWhen, map, from } from 'rxjs';

const terminal = new Terminal(process.env.HOST_URL!, {});

/// Note: Api.getAllProducts needs to be implemented by you
const products$ = defer(() => Api.getAllProducts()) // Fetch all product information from the external system API
  .pipe(
    // Convert external system product information to Yuan product information
    map((extProducts) =>
      extProducts.map((x) => ({
        // Define a globally unique product ID (it's recommended to use the vendor's name as a prefix)
        product_id: `${VENDOR_NAME}/${x.id}`,
        // ...map other fields (implement yourself)
      })),
    ),
    // Retry every hour (adjust according to actual conditions)
    repeat({ delay: 3600_000 }),
    retry({ delay: 3600_000 }),
    // Cache the latest product information
    shareReplay(1),
  );

// Store product information in the database
products$
  .pipe(
    delayWhen((products) => from(writeDataRecords(terminal, products.map(getDataRecordWrapper('product')!)))),
  )
  .subscribe();
```

:::info[Why is it necessary to store product information in the database?]

1. Product specifications are information that needs to be accessed frequently in Yuan, storing them in the database can improve access speed.
2. The external system may have API rate limits, making it inefficient to query the external system for each request.
3. Changes to product specification information are infrequent, making caching highly valuable.

:::

:::info[What if the external system does not support querying all product information?]

You can choose not to implement a full query but instead implement an incremental query.

:::
