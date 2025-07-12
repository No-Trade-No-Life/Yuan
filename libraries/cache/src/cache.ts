import { formatTime } from '@yuants/utils';
import { catchError, defer, Observable, of, repeat, retry, takeUntil } from 'rxjs';

/**
 * @public
 */
export interface ICache<T> {
  stats: Record<string, number>;
  get: (key: string) => T | undefined;
  query: (key: string, force_update?: boolean) => Promise<T | undefined>;
}

/**
 * 创建一个缓存装置，支持从本地存储和远程获取数据
 *
 * @public
 */
export const createCache = <T>(ctx: {
  /** 可选的本地数据读取函数，如果存在则在缓存未命中时尝试从本地读取 */
  readLocal?: (key: string) => Promise<T | undefined>;
  /** 可选的本地数据写入函数，如果存在则在获取到远程数据后同步到本地 */
  writeLocal?: (key: string, data: T) => Promise<void>;
  /** 从远程获取数据的函数 */
  readRemote: (key: string, force_update: boolean) => Promise<T | undefined>;
  /** 可选的数据过期时间（毫秒） */
  expire?: number;
  /** 缓存清理任务的终止信号 */
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
