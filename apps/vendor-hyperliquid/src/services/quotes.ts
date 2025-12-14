import { provideQuoteService } from '@yuants/exchange';
import { Terminal } from '@yuants/protocol';
import { encodePath } from '@yuants/utils';
import { getAllMids, getMetaAndAssetCtxs } from '../api/public-api';

const terminal = Terminal.fromNodeEnv();

const shouldInclude = (product_ids: string[] | undefined) => {
  const productIdSet = new Set(product_ids ?? []);
  return productIdSet.size === 0 ? () => true : (product_id: string) => productIdSet.has(product_id);
};

provideQuoteService(
  terminal,
  {
    product_id_prefix: 'HYPERLIQUID/PERPETUAL/',
    fields: ['last_price', 'ask_price', 'bid_price'],
  },
  async (req) => {
    const include = shouldInclude(req.product_ids);
    const mids = await getAllMids();

    return Object.entries(mids ?? {})
      .map(([coin, price]) => {
        return {
          product_id: encodePath('HYPERLIQUID', 'PERPETUAL', `${coin}-USD`),
          updated_at: Date.now(),
          last_price: `${price}`,
          bid_price: `${price}`,
          ask_price: `${price}`,
        };
      })
      .filter((quote) => include(quote.product_id));
  },
);

provideQuoteService(
  terminal,
  {
    product_id_prefix: 'HYPERLIQUID/PERPETUAL/',
    fields: ['open_interest', 'interest_rate_long', 'interest_rate_short'],
  },
  async (req) => {
    const include = shouldInclude(req.product_ids);
    const [meta, assetCtxs] = await getMetaAndAssetCtxs();

    const coinToCtx = new Map<string, (typeof assetCtxs)[number]>();
    meta?.universe?.forEach((asset, index) => {
      const ctx = assetCtxs?.[index];
      if (asset?.name && ctx) {
        coinToCtx.set(asset.name, ctx);
      }
    });

    return Array.from(coinToCtx.entries())
      .map(([coin, ctx]) => ({
        product_id: encodePath('HYPERLIQUID', 'PERPETUAL', `${coin}-USD`),
        updated_at: Date.now(),
        open_interest: ctx.openInterest ?? '0',
        interest_rate_long: ctx.funding ? `${-Number(ctx.funding)}` : '0',
        interest_rate_short: ctx.funding ?? '0',
      }))
      .filter((quote) => include(quote.product_id));
  },
);
