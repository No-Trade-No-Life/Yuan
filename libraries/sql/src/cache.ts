import { formatTime } from '@yuants/data-model';
import { catchError, defer, Observable, of, repeat, retry, takeUntil } from 'rxjs';

export interface ICache<T> {
  stats: Record<string, number>;
  get: (key: string) => T | undefined;
  query: (key: string, force_update?: boolean) => Promise<T | undefined>;
}

/**
 * 创建一个缓存系统，支持从本地存储和远程获取数据
 *
 * @template T - 缓存数据的类型
 * @param ctx - 缓存配置对象
 * @param ctx.readLocal - 可选的本地数据读取函数，如果存在则在缓存未命中时尝试从本地读取
 * @param ctx.writeLocal - 可选的本地数据写入函数，如果存在则在获取到远程数据后同步到本地
 * @param ctx.readRemote - 从远程获取数据的函数
 * @param ctx.expire - 可选的数据过期时间（毫秒）
 * @param ctx.dispose$ - 缓存清理任务的终止信号
 * @returns 返回实现了 ICache 接口的缓存对象
 *
 * @example
 * const userCache = createCache<UserData>({
 *   readLocal: async (userId) => localStorage.getItem(userId),
 *   writeLocal: async (userId, data) => localStorage.setItem(userId, data),
 *   readRemote: async (userId) => api.fetchUserData(userId),
 *   expire: 60 * 60 * 1000, // 1小时过期
 *   dispose$: someObservable
 * });
 *
 * // 使用缓存
 * const userData = await userCache.query('user123');
 */
export const createCache = <T>(ctx: {
  readLocal?: (key: string) => Promise<T | undefined>;
  writeLocal?: (key: string, data: T) => Promise<void>;
  readRemote: (key: string, force_update: boolean) => Promise<T | undefined>;
  expire?: number;
  dispose$: Observable<any>;
}): ICache<T> => {
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
    if (!ctx.expire || !(key in mapKeyToExpireTime)) return false;

    stats.expire_check++;
    const expired = Date.now() > mapKeyToExpireTime[key];

    if (expired) {
      delete mapKeyToData[key];
      delete mapKeyToExpireTime[key];
    }

    return expired;
  };

  defer(async () => {
    for (const [k, v] of Object.entries(mapKeyToExpireTime)) {
      if (Date.now() > v) {
        delete mapKeyToData[k];
        delete mapKeyToExpireTime[k];
      }
    }
  })
    .pipe(
      takeUntil(ctx.dispose$),
      catchError((err) => {
        console.log(formatTime(Date.now()), 'CleanCacheDataError', `Error:`, err);
        return of([]); // 返回空数组，避免流中断
      }),
      retry({ delay: 2000 }),
      repeat({ delay: 20000 }),
    )
    .subscribe();

  return {
    stats,
    get: (key: string): T | undefined => {
      // Check if the key has expired
      if (checkExpired(key)) return undefined;
      return mapKeyToData[key];
    },
    query: async (key: string, force_update = false): Promise<T | undefined> => {
      stats.query++;

      if (!force_update) {
        // Check if the key has expired, if not expired and data exists, return it
        if (!checkExpired(key) && mapKeyToData[key]) return mapKeyToData[key];

        const readLocal = ctx.readLocal;
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
            if (ctx.expire) {
              mapKeyToExpireTime[key] = Date.now() + ctx.expire;
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
        .then(() => ctx.readRemote(key, force_update))
        .catch(() => undefined));
      delete mapKeyToReadRemotePromise[key];

      if (!data) {
        return undefined;
      }

      const writeLocal = ctx.writeLocal;
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
      if (ctx.expire) {
        mapKeyToExpireTime[key] = Date.now() + ctx.expire;
      }

      return data;
    },
  };
};
