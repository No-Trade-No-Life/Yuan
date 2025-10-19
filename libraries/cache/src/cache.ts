import { defer, repeat, retry, timer } from 'rxjs';

/**
 * Cache Interface
 * @public
 */
export interface ICache<T> {
  stats: Record<string, number>;
  get: (key: string) => T | undefined;
  set: (key: string, data: T) => void;
  query: (key: string, force_update?: boolean) => Promise<T | undefined>;
}

/**
 * Cache Options Interface
 * @public
 */
export interface ICacheOptions<T> {
  /** 可选的本地数据读取函数，如果存在则在缓存未命中时尝试从本地读取 */
  readLocal?: (key: string) => Promise<T | undefined>;
  /** 可选的本地数据写入函数，如果存在则在获取到远程数据后同步到本地 */
  writeLocal?: (key: string, data: T) => Promise<void>;
  /** 可选的数据过期时间（毫秒） */
  expire?: number;
}

/**
 * 创建一个缓存记忆装置，从远程读取数据，缓存在内存中
 *
 * 装置自身不负责判断数据的新鲜程度，如果需要强制更新数据，可以在查询时传入 `force_update` 参数。
 *
 * - [可选] 可以将数据抄送到一个本地持久化存储中，可以降低热启动读取代价。(readLocal/writeLocal)
 * - [可选] 可以设置数据的过期时间，过期后会自动清理缓存，并且保证不会脏读到已经过期的数据。 (expire)
 *
 * @public
 */
export const createCache = <T>(
  /**
   * 从远程读取数据的函数
   */
  readRemote: (key: string, force_update: boolean) => Promise<T | undefined>,
  options?: ICacheOptions<T>,
): ICache<T> => {
  const mapKeyToReadRemotePromise: Record<string, Promise<T | undefined>> = {};
  const mapKeyToReadStoragePromise: Record<string, Promise<T | undefined>> = {};
  const mapKeyToWriteStoragePromise: Record<string, Promise<void>> = {};
  const mapKeyToData: Record<string, T> = {};
  const mapKeyToExpireTime: Record<string, number> = {};

  const stats = {
    readLocal: 0,
    writeLocal: 0,
    readRemote: 0,
    query: 0,
    force_update: 0,
    expire_check: 0,
  };

  // Helper function to check if a key has expired
  const checkExpired = (key: string): boolean => {
    if (!options?.expire || !(key in mapKeyToExpireTime)) return false;

    stats.expire_check++;
    const expired = Date.now() > mapKeyToExpireTime[key];

    if (expired) {
      delete mapKeyToData[key];
      delete mapKeyToExpireTime[key];
    }

    return expired;
  };

  const clearExpiredData = () => {
    const t = Date.now();
    let clearedCount = 0;
    for (const [k, v] of Object.entries(mapKeyToExpireTime)) {
      if (t > v) {
        clearedCount++;
        delete mapKeyToData[k];
        delete mapKeyToExpireTime[k];
      }
    }
    return clearedCount;
  };

  defer(async () => {
    const cleared = clearExpiredData();
    if (cleared === 0) throw new Error('No expired data found to clear');
  })
    .pipe(
      // 指数退避重试
      // 最长等待时间为 1 小时，初始延迟为 30秒，指数增长
      retry({ delay: (err, count) => timer(Math.min(3600_000, 30_000 * 2 ** count)) }),
      repeat({ delay: 30_000 }),
    )
    .subscribe();

  return {
    stats,
    get: (key: string): T | undefined => {
      // Check if the key has expired
      if (checkExpired(key)) return undefined;
      return mapKeyToData[key];
    },
    set: (key: string, data: T): void => {
      mapKeyToData[key] = data;
      if (options?.expire) {
        mapKeyToExpireTime[key] = Date.now() + options.expire;
      }
    },
    query: async (key: string, force_update = false): Promise<T | undefined> => {
      stats.query++;

      if (!force_update) {
        // Check if the key has expired, if not expired and data exists, return it
        if (!checkExpired(key) && mapKeyToData[key]) return mapKeyToData[key];

        const readLocal = options?.readLocal;
        if (readLocal) {
          const data = await (mapKeyToReadStoragePromise[key] ??= new Promise<void>((resolve) => {
            stats.readLocal++;
            resolve();
          })
            .then(() => readLocal(key))
            .catch(() => undefined));
          delete mapKeyToReadStoragePromise[key];
          if (data) {
            mapKeyToData[key] = data;
            if (options.expire) {
              mapKeyToExpireTime[key] = Date.now() + options.expire;
            }
            return data;
          }
        }
      } else {
        stats.force_update++;
      }

      const data = await (mapKeyToReadRemotePromise[key] ??= new Promise<void>((resolve) => {
        stats.readRemote++;
        resolve();
      })
        .then(() => readRemote(key, force_update))
        .catch(() => undefined));
      delete mapKeyToReadRemotePromise[key];

      if (!data) {
        return undefined;
      }

      const writeLocal = options?.writeLocal;
      if (writeLocal) {
        await (mapKeyToWriteStoragePromise[key] ??= new Promise<void>((resolve) => {
          stats.writeLocal++;
          resolve();
        })
          .then(() => writeLocal(key, data))
          .catch(() => {}));
        delete mapKeyToWriteStoragePromise[key];
      }

      mapKeyToData[key] = data;
      if (options?.expire) {
        mapKeyToExpireTime[key] = Date.now() + options.expire;
      }

      return data;
    },
  };
};
