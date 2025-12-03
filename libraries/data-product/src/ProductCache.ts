import { createCache, ICache } from '@yuants/cache';
import { Terminal } from '@yuants/protocol';
import { escapeSQL, requestSQL } from '@yuants/sql';
import { decodePath, formatTime } from '@yuants/utils';
import type { IProduct } from './index';

/**
 * Options for creating a product cache.
 * @public
 */
export interface IProductCacheOptions {
  /**
   * Expire time in milliseconds.
   * Defaults to 1 hour.
   */
  expire?: number;
}

/**
 * Create a cache for product metadata. The cache attempts to refresh the product
 * from remote datasource before reading the local SQL storage.
 *
 * @public
 */
export const createProductCache = (terminal: Terminal, options?: IProductCacheOptions): ICache<IProduct> =>
  createCache<IProduct>(
    async (key, _force_update) => {
      const [datasource_id, product_id] = decodePath(key);
      if (!datasource_id || !product_id) {
        console.error(formatTime(Date.now()), 'ProductCacheInvalidKey', key);
        return undefined;
      }

      try {
        await terminal.client.requestForResponse('UpdateProduct', { datasource_id, product_id });
      } catch (err) {
        console.error(formatTime(Date.now()), 'UpdateProductError', key, err);
      }
      const [data] = await requestSQL<IProduct[]>(
        terminal,
        `select * from product where datasource_id=${escapeSQL(datasource_id)} and product_id=${escapeSQL(
          product_id,
        )}`,
      );
      return data;
    },
    { expire: options?.expire ?? 3600 * 1000 },
  );

/**
 * Create a client-side product cache.
 *
 * @public
 */
export const createClientProductCache = (
  terminal: Terminal,
  options?: IProductCacheOptions,
): ICache<IProduct> =>
  createCache<IProduct>(
    async (product_id, _force_update) => {
      // TODO: Add datasource_id
      const [data] = await requestSQL<IProduct[]>(
        terminal,
        `select * from product where product_id=${escapeSQL(product_id)}`,
      );
      return data;
    },
    { expire: options?.expire ?? 3600 * 1000 },
  );
