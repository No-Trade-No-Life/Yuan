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
  /**
   * 可选的数据过期时间（毫秒），在此时间后旧数据完全无法读取
   */
  expire?: number;
  /**
   * 可选的缓存预刷新时间（毫秒），在此时间内数据过期时会触发后台刷新，但立即仍然返回旧数据
   * 通常而言，应当设置为小于 `expire` 的值，以实现类似 HTTP 的 stale-while-revalidate 语义
   */
  swrAfter?: number;
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
  const mapKeyToSetTime: Record<string, number> = {};

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
    if (!options?.expire || !(key in mapKeyToSetTime)) return false;

    stats.expire_check++;
    const expired = Date.now() > mapKeyToSetTime[key] + options.expire;

    if (expired) {
      delete mapKeyToData[key];
      delete mapKeyToSetTime[key];
    }

    return expired;
  };

  const set = (key: string, data: T): void => {
    mapKeyToData[key] = data;
    mapKeyToSetTime[key] = Date.now();
  };

  const query = async (key: string, force_update: boolean | undefined = false): Promise<T | undefined> => {
    stats.query++;

    if (!force_update) {
      // Check if the key has expired, if not expired and data exists, return it
      if (!checkExpired(key) && mapKeyToData[key]) {
        if (options?.swrAfter && Date.now() > mapKeyToSetTime[key] + options.swrAfter) {
          // Trigger background refresh if within stale-while-revalidate window
          query(key, true).catch(() => {});
        }
        return mapKeyToData[key];
      }

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
          set(key, data);
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

    set(key, data);

    return data;
  };
  return {
    stats,
    get: (key: string): T | undefined => {
      // Check if the key has expired
      if (checkExpired(key)) return undefined;
      return mapKeyToData[key];
    },
    set,
    query,
  };
};
