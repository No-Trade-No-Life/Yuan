import { createCache } from '@yuants/cache';
import { IServiceOptions, Terminal } from '@yuants/protocol';
import { createSQLWriter } from '@yuants/sql';
import { Observable, ReplaySubject, Subject, defer, map, repeat, retry, shareReplay, takeUntil } from 'rxjs';
import { IProduct } from './index';

/**
 * QueryProducts service interface
 * 查询品种服务接口
 *
 * @public
 */
export interface IQueryProductsRequest {
  /**
   * Market ID to filter products by
   * 市场ID，用于筛选品种
   */
  market_id?: string;

  /**
   * Force update the product list
   * 强制更新品种列表
   */
  force_update?: boolean;

  /**
   * Product ID pattern to filter products by
   * 品种ID模式，用于筛选品种
   */
  product_id_pattern?: string;
}

/**
 * QueryProducts service response
 * 查询品种服务响应
 *
 * @public
 */
export interface IQueryProductsResponse {
  /**
   * List of products matching the query
   * 匹配查询的品种列表
   */
  products: IProduct[];
}

/**
 * QueryProducts service cache
 * 查询品种服务缓存
 *
 * @public
 */
export interface IQueryProductsService {
  /**
   * Observable for local product updates
   * 本地产品更新的可观察对象
   */
  products$: Observable<IProduct[]>;

  /**
   * Observable mapping product_id to IProduct
   * 将 product_id 映射到 IProduct 的可观察对象
   *
   * @remarks
   * 使用 `shareReplay(1)` 缓存结果，避免重复计算
   */
  mapProductIdToProduct$: Observable<Map<string, IProduct>>;
}

/**
 * Helper function to provide QueryProducts service
 * 提供查询品种服务的辅助函数
 *
 * @remarks
 * 实践建议：
 * - 鼓励 `queryProduct` 函数返回的数据是所需数据的超集
 * - 如果外部接口本身不支持过滤参数，就不需要在 `queryProduct` 中进行后过滤
 * - 过滤逻辑应该在外部 API 调用时处理，而不是在获取数据后手动过滤
 * - 这样可以避免重复的过滤逻辑，让数据获取更加高效
 * - 使用 `Promise.all` 并行调用多个 API 接口
 * - 使用 `shareReplay(1)` 缓存衍生数据 (Map)
 * - 设置 `auto_refresh_interval` 自动刷新数据
 * - 确保产品数据包含完整的 IProduct 字段
 *
 * @public
 */
export function provideQueryProductsService(
  terminal: Terminal,
  datasource_id: string,
  queryProduct: (req: IQueryProductsRequest) => Promise<IProduct[]>,
  options?: {
    /**
     * Service options
     * 服务选项
     */
    serviceOptions?: IServiceOptions;

    /**
     * Auto refresh interval in milliseconds
     * 自动刷新间隔（毫秒）
     */
    auto_refresh_interval?: number;
  },
): IQueryProductsService {
  // Local cache for products
  const products$ = new ReplaySubject<IProduct[]>(1);
  const productToWrite$ = new Subject<IProduct>();

  const productCache = createCache<IProduct[]>(
    () => queryProduct({}).then((x) => x.filter((xx) => xx.datasource_id === datasource_id)),
    {
      writeLocal: async (key, data) => {
        data.forEach((product) => {
          productToWrite$.next(product);
        });
        products$.next(data);
      },
    },
  );

  const mapProductIdToProduct$ = products$.pipe(
    map((products) => new Map(products.map((v) => [v.product_id, v]))),
    shareReplay(1),
  );

  // Set up SQL writer for all products
  createSQLWriter<IProduct>(terminal, {
    data$: productToWrite$,
    tableName: 'product',
    conflictKeys: ['datasource_id', 'product_id'],
    writeInterval: 1000,
  });

  // Set up auto refresh if interval is provided
  if (options?.auto_refresh_interval) {
    defer(() => productCache.query('', true))
      .pipe(
        takeUntil(terminal.dispose$),
        repeat({ delay: options.auto_refresh_interval }),
        retry({ delay: 5000 }),
      )
      .subscribe();
  }

  // Provide the service with proper generics
  const dispose = terminal.server.provideService<IQueryProductsRequest, IQueryProductsResponse>(
    'QueryProducts',
    {
      type: 'object',
      required: ['datasource_id'],
      properties: {
        datasource_id: {
          const: datasource_id,
          description: 'Data source ID to filter products by',
        },
        force_update: {
          type: 'boolean',
          description: 'Force update the product list',
        },
        market_id: {
          type: 'string',
          description: 'Market ID to filter products by',
        },
        product_id_pattern: {
          type: 'string',
          description: 'Product ID pattern to filter products by',
        },
      },
      additionalProperties: false,
    },
    async ({ req }) => {
      // Query products from external API with filter conditions
      const products = await productCache.query('', req.force_update);

      if (!products) throw new Error('Failed to load products');

      return {
        res: {
          code: 0,
          message: 'OK',
          data: {
            products,
          },
        },
      };
    },
    options?.serviceOptions,
  );

  // Return cache object
  return {
    products$: products$.asObservable(),
    mapProductIdToProduct$,
  };
}
