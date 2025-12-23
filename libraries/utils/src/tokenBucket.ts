import { interval, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { newError } from './error';
import { semaphore } from './semaphore';

/**
 * 令牌桶配置选项
 * @public
 */
export interface TokenBucketOptions {
  /**
   * 令牌桶容量
   * @defaultValue 1
   */
  capacity?: number;

  /**
   * 令牌补充间隔（毫秒）
   * @defaultValue 1000
   */
  refillInterval?: number;

  /**
   * 每次补充的令牌数量
   * @defaultValue 1
   */
  refillAmount?: number;
}

/**
 * 令牌桶内部状态
 * @internal
 */
interface ITokenBucketState {
  capacity: number;
  dispose$: Subject<void>;
}

/**
 * 令牌桶状态映射
 * @internal
 */
const mapTokenBucketIdToState = new Map<string, ITokenBucketState>();

/**
 * 令牌桶操作接口
 *
 * 令牌桶按照固定速率补充令牌，用于限制请求速率。
 * 使用 semaphore 原语管理令牌获取和队列。
 *
 * @public
 */
export interface ITokenBucket extends Disposable {
  /**
   * 获取令牌
   *
   * 按照先到先得的顺序 (FIFO) 获取指定数量的令牌。
   * 如果当前令牌不足，则等待直到有足够令牌可用。
   *
   * @param tokens - 需要的令牌数量，默认值为 1
   */
  acquire(tokens?: number): Promise<void>;

  /**
   * 读取当前可用令牌数量
   *
   * @returns 当前可用令牌数量
   */
  read(): number;
}

/**
 * 创建令牌桶或者获取已存在的令牌桶
 *
 * @param options - 令牌桶配置选项
 * @returns 令牌桶对象
 * @public
 */
export const tokenBucket = (bucketId: string, options: TokenBucketOptions = {}): ITokenBucket => {
  const CAPACITY = options.capacity ?? 1;
  const REFILL_INTERVAL = options.refillInterval ?? 1000;
  const REFILL_AMOUNT = options.refillAmount ?? CAPACITY;

  // 验证配置
  if (CAPACITY <= 0) {
    throw newError('TOKEN_BUCKET_INVALID_CAPACITY', { bucketId, capacity: CAPACITY });
  }
  if (REFILL_INTERVAL <= 0) {
    throw newError('TOKEN_BUCKET_INVALID_REFILL_INTERVAL', {
      bucketId,
      refillInterval: REFILL_INTERVAL,
    });
  }
  if (!isFinite(REFILL_INTERVAL)) {
    throw newError('TOKEN_BUCKET_INVALID_REFILL_INTERVAL', {
      bucketId,
      refillInterval: REFILL_INTERVAL,
    });
  }
  if (REFILL_AMOUNT <= 0) {
    throw newError('TOKEN_BUCKET_INVALID_REFILL_AMOUNT', {
      bucketId,
      refillAmount: REFILL_AMOUNT,
    });
  }

  const sem = semaphore(`token-bucket:${bucketId}`);

  // 获取或创建状态
  let state = mapTokenBucketIdToState.get(bucketId);
  if (!state) {
    const newState: ITokenBucketState = {
      capacity: CAPACITY,
      dispose$: new Subject<void>(),
    };

    mapTokenBucketIdToState.set(bucketId, newState);
    state = newState;

    sem.release(CAPACITY); // 初始化时填满令牌桶

    interval(REFILL_INTERVAL)
      .pipe(takeUntil(state.dispose$))
      .subscribe(() => {
        // 补充令牌：释放 refillAmount 个许可证
        // 但需要确保不超过容量限制
        const currentTokens = sem.read();
        // 计算自上次补充以来经过的间隔数
        const tokensToAdd = Math.min(REFILL_AMOUNT, CAPACITY - currentTokens);
        if (tokensToAdd > 0) {
          sem.release(tokensToAdd);
        }
      });
  }

  const acquire = async (tokens: number = 1): Promise<void> => {
    // 请求的令牌数必须为正整数
    if (tokens <= 0) {
      throw newError('TOKEN_BUCKET_INVALID_ACQUIRE_TOKENS', { bucketId, tokens });
    }
    // 请求的令牌数不能超过容量，否则永远无法满足请求
    if (tokens > state!.capacity) {
      throw newError('TOKEN_BUCKET_INSUFFICIENT_CAPACITY', {
        bucketId,
        tokens,
        capacity: CAPACITY,
      });
    }

    // 使用 semaphore 的 acquire 方法，它会处理队列和等待
    await sem.acquire(tokens);
  };

  const read = (): number => {
    return sem.read();
  };

  const dispose = (): void => {
    state!.dispose$.next();
    state!.dispose$.complete();
    mapTokenBucketIdToState.delete(bucketId);
  };

  return {
    acquire,
    read,
    [Symbol.dispose]: function (): void {
      dispose();
    },
  };
};
