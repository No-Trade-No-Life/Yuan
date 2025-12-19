import { IProduct } from '@yuants/data-product';
import { IQuoteField } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { requestSQL } from '@yuants/sql';
import { defer, repeat, retry } from 'rxjs';
import { markDirty } from './new';

const terminal = Terminal.fromNodeEnv();

defer(async () => {
  const products = await requestSQL<IProduct[]>(
    terminal,
    `select * from product where datasource_id in ('BINANCE', 'OKX', 'BITGET', 'ASTER', 'HYPERLIQUID', 'GATE', 'HTX')`,
  );
  console.info('## PRODUCTS', products.length);
  for (const product of products) {
    for (const field of [
      'ask_price',
      'bid_price',
      'last_price',
      'open_interest',
      'interest_rate_long',
      'interest_rate_short',
      'interest_rate_next_settled_at',
    ])
      markDirty(product.product_id, field as IQuoteField);
  }
})
  .pipe(repeat({ delay: 1000 }), retry({ delay: 1000 }))
  .subscribe();
