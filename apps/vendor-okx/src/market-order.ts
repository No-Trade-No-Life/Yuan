import { Terminal } from '@yuants/protocol';
import { client } from './api';
import { decodePath, formatTime } from '@yuants/utils';
import { useMarketBooks } from './ws';
import { map, shareReplay, tap } from 'rxjs';

const terminal = Terminal.fromNodeEnv();

terminal.server.provideService(
  'QueryMarketBooks',
  {
    required: ['product_id', 'datasource_id'],
    properties: {
      product_id: { type: 'string' },
      datasource_id: { type: 'string', const: 'OKX' },
    },
  },
  async (msg) => {
    const { sz = '1', product_id } = msg.req as { sz?: string; product_id: string };
    const books = mapProductIdToMarketBooks.get(product_id);

    if (books) {
      return {
        res: {
          code: 0,
          message: 'OK',
          data: {
            seqId: books.seqId,
            bids: Array.from(books.bids.values() ?? []).sort((a, b) => +b[0] - +a[0]),
            asks: Array.from(books?.asks.values() ?? []).sort((a, b) => +a[0] - +b[0]),
          },
        },
      };
    }
    return { res: { code: 500, message: 'Server Error' } };
  },
);

export interface IWSOrderBook {
  asks: [price: string, volume: string, abandon: string, order_number: string][];
  bids: [price: string, volume: string, abandon: string, order_number: string][];
  ts: string;
  prevSeqId: number;
  seqId: number;
  checksum: number;
}

const mapProductIdToMarketBooks = new Map<
  string,
  {
    asks: Map<string, [price: string, volume: string, abandon: string, order_number: string]>;
    bids: Map<string, [price: string, volume: string, abandon: string, order_number: string]>;
    seqId: number;
  }
>();

terminal.channel.publishChannel('MarketBooks', { pattern: `^OKX/` }, (id) => {
  const [datasource_id, product_id] = decodePath(id);
  const [, instId] = decodePath(product_id);
  console.info(formatTime(Date.now()), `SubscribeMarketBooks`, id);

  return useMarketBooks('books', instId).pipe(
    map((data) => {
      return data[0];
    }),
    tap({
      next: (v) => {
        if (!mapProductIdToMarketBooks.get(product_id)) {
          mapProductIdToMarketBooks.set(product_id, {
            seqId: v.seqId,
            asks: new Map<string, [price: string, volume: string, abandon: string, order_number: string]>(),
            bids: new Map<string, [price: string, volume: string, abandon: string, order_number: string]>(),
          });
        }
        v.asks.map((ask) => mapProductIdToMarketBooks.get(product_id)?.asks.set(ask[0], ask));
        v.bids.map((bid) => mapProductIdToMarketBooks.get(product_id)?.bids.set(bid[0], bid));
      },
      finalize: () => {
        mapProductIdToMarketBooks.delete(product_id);
      },
    }),
  );
});
