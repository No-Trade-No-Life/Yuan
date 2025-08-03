import { formatTime } from '@yuants/utils';
import { createClient } from 'redis';
import {
  defer,
  MonoTypeOperatorFunction,
  Observable,
  share,
  shareReplay,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';

/**
 * 创建 Redis 客户端连接，带有自动重连机制
 *
 * @param url - Redis 服务器连接 URL
 * @returns Observable，发出已连接的 Redis 客户端实例
 */
export const createRedis = (url: string) =>
  new Observable<any>((subscriber) => {
    const redis = createClient({ url });

    redis.on('error', (err) => {
      console.error(formatTime(Date.now()), `RedisError`, err);
    });

    redis.on('end', () => {
      console.error(formatTime(Date.now()), `RedisConnectionEnd`);
    });

    redis.on('reconnecting', () => {
      console.log(formatTime(Date.now()), `RedisReconnecting`);
    });

    function reconnect() {
      console.log(formatTime(Date.now()), `RedisAttemptingReconnect`);
      connect();
    }

    function connect() {
      redis
        .connect()
        .then(() => {
          console.log(formatTime(Date.now()), 'RedisConnectionSuccessful');
          subscriber.next(redis);
        })
        .catch((err) => {
          console.error(formatTime(Date.now()), 'RedisConnectionError', err);
          reconnect();
        });
    }

    connect();

    return () => {
      redis.destroy();
    };
  });

/**
 * 全局共享的 Redis 客户端连接
 */
export const redis$ = createRedis(process.env.REDIS_URL!).pipe(shareReplay(1));

/**
 * 创建一个 Redis Stream 写入器
 *
 * @template T - 数据类型
 * @param ctx - 配置对象
 * @param ctx.redisKey - Redis Stream 键名
 * @param ctx.data$ - 提供要写入的数据的 Observable
 * @param ctx.dispose$ - 用于清理资源的终止信号 Observable
 * @param ctx.streamMaxLength - Redis Stream 的最大长度
 */
export const createRedisStreamWriter = <T>(ctx: {
  redisKey: string;
  data$: Observable<T>;
  dispose$: Observable<any>;
  streamMaxLength: number;
}) => {
  redis$
    .pipe(
      switchMap((redis) =>
        ctx.data$.pipe(
          tap((data) => {
            redis.xAdd(
              ctx.redisKey,
              '*',
              { data: JSON.stringify(data) },
              {
                TRIM: {
                  strategy: 'MAXLEN',
                  strategyModifier: '~',
                  threshold: ctx.streamMaxLength || 1,
                },
              },
            );
          }),
        ),
      ),
      takeUntil(ctx.dispose$),
    )
    .subscribe();
};

/**
 * RxJS 操作符，将流中的数据发布到 Redis 通道
 *
 * @template T - 数据类型
 * @param redisKey - Redis 通道名称
 * @returns RxJS 操作符函数
 */
export const publishToRedis =
  <T>(redisKey: string): MonoTypeOperatorFunction<T> =>
  (source$) =>
    new Observable<T>((subscriber) => {
      const shared$ = source$.pipe(share({ resetOnRefCountZero: true }));
      subscriber.add(shared$.subscribe(subscriber));
      subscriber.add(
        // 需要专用连接
        defer(() => createRedis(process.env.REDIS_URL!))
          .pipe(
            switchMap((redis) =>
              shared$.pipe(
                tap((data) => {
                  redis.publish(redisKey, JSON.stringify(data));
                }),
              ),
            ),
          )
          .subscribe(),
      );
    });

/**
 * RxJS 操作符，将流中的数据写入 Redis Stream
 *
 * @template T - 数据类型
 * @param ctx - 配置对象
 * @param ctx.redisKey - Redis Stream 键名
 * @param ctx.streamMaxLength - Redis Stream 的最大长度
 * @returns RxJS 操作符函数
 */
export const tapRedisStream =
  <T>(ctx: { redisKey: string; streamMaxLength: number }): MonoTypeOperatorFunction<T> =>
  (source$) =>
    new Observable<T>((subscriber) => {
      const shared$ = source$.pipe(share({ resetOnRefCountZero: true }));
      subscriber.add(shared$.subscribe(subscriber));
      subscriber.add(
        redis$
          .pipe(
            switchMap((redis) =>
              shared$.pipe(
                tap((data) => {
                  redis.xAdd(
                    ctx.redisKey,
                    '*',
                    { data: JSON.stringify(data) },
                    {
                      TRIM: {
                        strategy: 'MAXLEN',
                        strategyModifier: '~',
                        threshold: ctx.streamMaxLength || 1,
                      },
                    },
                  );
                }),
              ),
            ),
          )
          .subscribe(),
      );
    });

/**
 * 从 Redis Stream 读取数据
 *
 * @template T - 数据类型
 * @param ctx - 配置对象
 * @param ctx.redisKey - Redis Stream 键名
 * @returns 发出流数据的 Observable
 */
export const createRedisStreamReader = <T>(ctx: { redisKey: string }): Observable<T> =>
  redis$.pipe(
    switchMap(async function* (redis) {
      let lastId = '0'; // 从流开始位置读取

      while (true) {
        try {
          const result = await redis.xRead({ key: ctx.redisKey, id: lastId }, { COUNT: 100, BLOCK: 5000 });

          if (!result) continue;

          // @ts-ignore
          const messages = result[0].messages;
          for (const msg of messages) {
            const payload = msg.message;
            yield JSON.parse(payload.data);
            lastId = msg.id; // 更新消费位置
          }
        } catch (error) {
          console.error(formatTime(Date.now()), `RedisStreamReaderError:${ctx.redisKey}`, error);
        }
      }
    }),
  );

// 存储每个 Redis 键对应的 Observable 缓存
const mapRedisKeyToObservable: Record<string, Observable<any>> = {};

/**
 * 订阅 Redis 频道
 *
 * @template T - 数据类型
 * @param redisKey - Redis 频道名称
 * @returns 发出频道消息的 Observable
 */
export const fromRedisChannel = <T>(redisKey: string): Observable<T> =>
  (mapRedisKeyToObservable[redisKey] ??= defer(() => createRedis(process.env.REDIS_URL!)).pipe(
    switchMap(
      (redis) =>
        new Observable<T>((subscriber) => {
          redis.subscribe(redisKey, (msg: any) => subscriber.next(JSON.parse(msg)));
        }),
    ),
    share({ resetOnRefCountZero: true }),
  ));
