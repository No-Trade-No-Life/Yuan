import { newError } from './error';

/**
 * 信号量状态
 * @internal
 */
interface WaitingRequest {
  resolve: (disposable: Disposable) => void;
  reject: (reason?: any) => void;
  perms: number;
  signal?: AbortSignal;
}

/**
 * 信号量内部状态
 * @internal
 */
interface ISemaphoreState {
  queue: WaitingRequest[];
  available: number;
  head: number; // 队列头部指针，指向第一个有效元素
}

/**
 * 信号量状态映射
 * @internal
 */
const mapSemaphoreIdToState = new Map<string, ISemaphoreState>();

/**
 * 取消信号与对应的请求的 reject 绑定关系
 * @internal
 */
const mapSignalToRejects = new Map<AbortSignal, Set<(reason?: any) => void>>();

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
   * 支持 [显式资源管理] 释放获取的许可。(using 语法糖)
   *
   * @param perms - 许可数量，默认值为 1
   * @param signal - 可选的 AbortSignal，用于取消等待
   * @returns 一个 Promise，解析为一个 Disposable 对象，用于释放获取的许可
   */
  acquire(perms?: number, signal?: AbortSignal): Promise<Disposable>;

  /**
   * 同步获取许可
   *
   * 如果当前可用许可不足，则立即抛出错误
   *
   * 支持 [显式资源管理] 释放获取的许可。(using 语法糖)
   *
   * @param perms - 许可数量，默认值为 1
   * @returns 一个 Disposable 对象，用于释放获取的许可
   */
  acquireSync(perms?: number): Disposable;
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
    state = { available: 0, queue: [], head: 0 };
    mapSemaphoreIdToState.set(semaphoreId, state);
  }

  const acquire = async (perms: number = 1, signal?: AbortSignal): Promise<Disposable> => {
    if (perms <= 0) throw newError('SEMAPHORE_INVALID_ACQUIRE_PERMS', { semaphoreId, perms });

    // 如果信号已经触发，立即拒绝
    if (signal?.aborted) {
      throw newError('SEMAPHORE_ACQUIRE_ABORTED', { semaphoreId, perms });
    }

    // 如果有足够许可，立即获取
    if (state!.available >= perms) {
      state!.available -= perms;

      return {
        [Symbol.dispose]() {
          release(perms);
        },
      };
    }
    // 否则加入等待队列
    return new Promise<Disposable>((resolve, reject) => {
      const waitingRequest: WaitingRequest = { resolve, reject, perms, signal };
      state!.queue.push(waitingRequest);

      // 如果提供了 signal，设置 abort 事件监听器
      if (signal) {
        let requests = mapSignalToRejects.get(signal);
        // 如果没有 requests 说明这个 signal 没有被注册过，需要初始化监听器
        if (!requests) {
          requests = new Set();
          mapSignalToRejects.set(signal, requests);
          // Listen Only Once
          const onAbort = () => {
            const rejects = mapSignalToRejects.get(signal);
            if (rejects) {
              const reason = newError('SEMAPHORE_ACQUIRE_ABORTED', {});
              for (const reject of rejects) {
                reject(reason);
              }
              rejects.clear();
              mapSignalToRejects.delete(signal);
            }

            signal.removeEventListener('abort', onAbort);
          };
          signal.addEventListener('abort', onAbort);
        }
        // 绑定 signal 和 waitingRequest 的关系
        requests.add(waitingRequest.reject);
      }
    });
  };

  const acquireSync = (perms: number = 1): Disposable => {
    if (perms <= 0) throw newError('SEMAPHORE_INVALID_ACQUIRE_PERMS', { semaphoreId, perms });
    // 如果有足够许可，立即获取
    if (state!.available >= perms) {
      state!.available -= perms;
      return {
        [Symbol.dispose]() {
          release(perms);
        },
      };
    }

    // 否则抛出错误
    throw newError('SEMAPHORE_INSUFFICIENT_PERMS', { semaphoreId, perms });
  };

  const release = (perms: number = 1): void => {
    if (perms <= 0) throw newError('SEMAPHORE_INVALID_RELEASE_PERMS', { semaphoreId, perms });
    state!.available += perms;

    // 处理等待队列
    while (state!.head < state!.queue.length) {
      const next = state!.queue[state!.head];

      // 检查请求是否已被取消
      if (next.signal?.aborted) {
        // 跳过已取消的请求，移动头部指针
        state!.head++;
        // 请求已被 onAbort 拒绝，无需再次拒绝
        continue;
      }

      if (state!.available >= next.perms) {
        // 满足队首请求，移动头部指针
        state!.head++;
        state!.available -= next.perms;

        if (next.signal) {
          // 删除与 signal 的连接
          mapSignalToRejects.get(next.signal)?.delete(next.reject);
        }

        next.resolve({
          [Symbol.dispose]() {
            release(next.perms);
          },
        });
      } else {
        // 许可不足，停止处理
        break;
      }
    }
    // 压缩队列以释放内存
    if (state!.head > 1024 && state!.head * 2 > state!.queue.length) {
      state!.queue.splice(0, state!.head);
      state!.head = 0;
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
