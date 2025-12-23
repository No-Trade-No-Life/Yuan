import { newError } from './error';
import { semaphore } from './semaphore';

/**
 * 令牌池配置选项
 * @public
 */
export interface TokenPoolOptions {
  /**
   * 令牌池容量
   * @defaultValue 1
   */
  capacity?: number;
}

/**
 * 令牌池内部状态
 * @internal
 */
interface ITokenPoolState {
  capacity: number;
}

/**
 * 令牌池状态映射
 * @internal
 */
const mapTokenPoolIdToState = new Map<string, ITokenPoolState>();

/**
 * 令牌桶操作接口
 *
 * 令牌桶按照固定速率补充令牌，用于限制请求速率。
 * 使用 semaphore 原语管理令牌获取和队列。
 *
 * @public
 */
export interface ITokenPool {
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
   * 释放令牌
   * @param tokens - 释放的令牌数量，默认值为 1
   */
  release(tokens?: number): void;

  /**
   * 读取当前可用令牌数量
   *
   * @returns 当前可用令牌数量
   */
  read(): number;
}

/**
 * 创建或获取一个令牌池，本质上是一个带有容量限制的信号量。
 *
 * @param options - 令牌池配置选项
 * @returns 令牌池对象
 * @public
 */
export const tokenPool = (poolId: string, options: TokenPoolOptions = {}): ITokenPool => {
  const CAPACITY = options.capacity ?? 1;

  // 验证配置
  if (CAPACITY <= 0) {
    throw newError('TOKEN_POOL_INVALID_CAPACITY', { poolId, capacity: CAPACITY });
  }

  const sem = semaphore(`token-pool:${poolId}`);

  // 获取或创建状态
  let state = mapTokenPoolIdToState.get(poolId);
  if (!state) {
    const newState: ITokenPoolState = {
      capacity: CAPACITY,
    };

    mapTokenPoolIdToState.set(poolId, newState);
    state = newState;

    sem.release(CAPACITY); // 初始化时填满令牌桶
  }

  const acquire = async (tokens: number = 1): Promise<void> => {
    // 请求的令牌数必须为正整数
    if (tokens <= 0) {
      throw newError('TOKEN_POOL_INVALID_ACQUIRE_TOKENS', { poolId, tokens });
    }
    // 请求的令牌数不能超过容量，否则永远无法满足请求
    if (tokens > state!.capacity) {
      throw newError('TOKEN_POOL_INSUFFICIENT_CAPACITY', {
        poolId,
        tokens,
        capacity: CAPACITY,
      });
    }

    // 使用 semaphore 的 acquire 方法，它会处理队列和等待
    await sem.acquire(tokens);
  };

  const release = (tokens: number = 1): void => {
    // 释放的令牌数必须为正整数
    if (tokens <= 0) {
      throw newError('TOKEN_POOL_INVALID_RELEASE_TOKENS', { poolId, tokens });
    }
    if (sem.read() + tokens > state!.capacity) {
      throw newError('TOKEN_POOL_RELEASE_EXCEEDS_CAPACITY', {
        poolId,
        tokens,
        capacity: CAPACITY,
      });
    }
    sem.release(tokens);
  };

  const read = (): number => {
    return sem.read();
  };

  return {
    acquire,
    release,
    read,
  };
};
