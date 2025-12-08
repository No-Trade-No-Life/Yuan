import { createCache } from '@yuants/cache';
import { makeSpotPosition } from '@yuants/data-account';
import { getSpotAccounts, ICredential } from '../../api/private-api';
import { encodePath } from '@yuants/utils';
import { listProducts } from '../markets/product';

const spotProductMapCache = createCache(
  async () => {
    const products = await listProducts();
    const map = new Map<string, string>();
    for (const product of products) {
      const [, instType] = product.product_id.split('/');
      if (instType === 'SPOT') {
        map.set(product.base_currency, product.product_id);
      }
    }
    return map;
  },
  { expire: 86_400_000 },
);

export const getSpotAccountInfo = async (credential: ICredential) => {
  const [res, spotProductMap] = await Promise.all([
    getSpotAccounts(credential),
    spotProductMapCache.query(''),
  ]);
  const resolvedSpotProductMap = spotProductMap ?? new Map<string, string>();
  if (!Array.isArray(res)) {
    throw new Error('Failed to load spot balances');
  }
  return res.map((item) => {
    return makeSpotPosition({
      datasource_id: 'GATE',
      position_id: item.currency,
      product_id: resolvedSpotProductMap.get(item.currency) ?? encodePath('GATE', 'SPOT', `${item.currency}`),
      volume: Number(item.available),
      free_volume: Number(item.available),
      closable_price: 1, // TODO: use real price
    });
  });
};
