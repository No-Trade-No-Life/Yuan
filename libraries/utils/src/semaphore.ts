import { newError } from './error';

/**
 * 信号量状态
 * @internal
 */
interface WaitingRequest {
  resolve: () => void;
  perms: number;
}

/**
 * 信号量内部状态
 * @internal
 */
interface ISemaphoreState {
  queue: WaitingRequest[];
  available: number;
}

/**
 * 信号量状态映射
 * @internal
 */
const mapSemaphoreIdToState = new Map<string, ISemaphoreState>();

/**
 * 信号量操作接口
 *
 * 初始化时通过 release 方法设置初始许可数量，否则初始许可数量为 0。
 *
 * @public
 */
export interface ISemaphore {
  /**
   * 获取许可
   *
   * 按照先到先得的顺序 (FIFO) 获取许可，如果当前可用许可不足，则等待直到有足够许可可用。
   *
   * @param perms - 许可数量，默认值为 1
   */
  acquire(perms?: number): Promise<void>;

  /**
   * 同步获取许可
   *
   * 如果当前可用许可不足，则立即抛出错误
   *
   * @param perms
   */
  acquireSync(perms?: number): void;
  /**
   * 释放许可
   *
   * 释放指定数量的许可，并唤醒等待队列中的请求（如果有足够许可可用）
   *
   * 注意: 释放时不会检查释放的许可数量是否超过已获取的许可数量，调用者需自行保证逻辑正确
   *
   * @param perms - 许可数量，默认值为 1
   */
  release(perms?: number): void;
  /**
   * 读取当前可用许可数量
   *
   * @returns 当前可用许可数量
   */
  read(): number;
}

/**
 * 创建信号量或者获取已存在的信号量
 *
 * @param semaphoreId - 信号量唯一标识
 * @returns 信号量对象
 * @public
 */
export const semaphore = (semaphoreId: string): ISemaphore => {
  let state = mapSemaphoreIdToState.get(semaphoreId);
  if (!state) {
    state = { available: 0, queue: [] };
    mapSemaphoreIdToState.set(semaphoreId, state);
  }

  const acquire = async (perms: number = 1): Promise<void> => {
    if (perms <= 0) throw newError('SEMAPHORE_INVALID_ACQUIRE_PERMS', { semaphoreId, perms });
    // 如果有足够许可，立即获取
    if (state!.available >= perms) {
      state!.available -= perms;
      return;
    }

    // 否则加入等待队列
    return new Promise<void>((resolve) => {
      state!.queue.push({ resolve, perms });
    });
  };

  const acquireSync = (perms: number = 1): void => {
    if (perms <= 0) throw newError('SEMAPHORE_INVALID_ACQUIRE_PERMS', { semaphoreId, perms });
    // 如果有足够许可，立即获取
    if (state!.available >= perms) {
      state!.available -= perms;
      return;
    }

    // 否则抛出错误
    throw newError('SEMAPHORE_INSUFFICIENT_PERMS', { semaphoreId, perms });
  };

  const release = (perms: number = 1): void => {
    if (perms <= 0) throw newError('SEMAPHORE_INVALID_RELEASE_PERMS', { semaphoreId, perms });
    state!.available += perms;

    // 处理等待队列
    while (state!.queue.length > 0) {
      const next = state!.queue[0];
      if (state!.available >= next.perms) {
        // 满足队首请求
        state!.queue.shift();
        state!.available -= next.perms;
        next.resolve();
      } else {
        // 许可不足，停止处理
        break;
      }
    }
  };

  const read = (): number => {
    return state!.available;
  };

  return {
    acquire,
    acquireSync,
    release,
    read,
  };
};
