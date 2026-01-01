import { newError } from './error';

/**
 * 信号量内部状态
 * @internal
 */
interface ISemaphoreState {
  // 统一扁平数组存储，每4个元素为一组：
  // data[i*4 + 0] = resolve函数
  // data[i*4 + 1] = reject函数
  // data[i*4 + 2] = perm数字
  // data[i*4 + 3] = signal引用
  data: any[];
  available: number;
  head: number; // 队列头部指针（以元素组为单位）
}

// 扁平数组访问常量
const RESOLVE_OFFSET = 0;
const REJECT_OFFSET = 1;
const PERM_OFFSET = 2;
const SIGNAL_OFFSET = 3;
const ELEMENTS_PER_ENTRY = 4;

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

const linkSignalAndReject = (signal: AbortSignal, reject: (reason?: any) => void) => {
  let rejects = mapSignalToRejects.get(signal);
  // 如果没有 requests 说明这个 signal 没有被注册过，需要初始化监听器
  if (!rejects) {
    rejects = new Set();
    mapSignalToRejects.set(signal, rejects);
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
  rejects.add(reject);
};

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
   * 获取许可后，调用者需要手动调用 release 方法来释放许可。
   *
   * @param perms - 许可数量，默认值为 1
   * @param signal - 可选的 AbortSignal，用于取消等待
   * @returns 一个 Promise，当许可获取成功时解析
   */
  acquire(perms?: number, signal?: AbortSignal): Promise<void>;

  /**
   * 同步获取许可
   *
   * 如果当前可用许可不足，则立即抛出错误
   *
   * 获取许可后，调用者需要手动调用 release 方法来释放许可。
   *
   * @param perms - 许可数量，默认值为 1
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
    state = {
      available: 0,
      data: [],
      head: 0,
    };
    mapSemaphoreIdToState.set(semaphoreId, state);
  }

  const acquire = async (perms: number = 1, signal?: AbortSignal): Promise<void> => {
    if (perms <= 0) throw newError('SEMAPHORE_INVALID_ACQUIRE_PERMS', { semaphoreId, perms });

    // 如果信号已经触发，立即拒绝
    if (signal?.aborted) {
      throw newError('SEMAPHORE_ACQUIRE_ABORTED', { semaphoreId, perms });
    }

    // 如果有足够许可，立即获取
    if (state!.available >= perms) {
      state!.available -= perms;
      return;
    }
    // 否则加入等待队列
    return new Promise<void>((resolve, reject) => {
      // 存储到扁平数组 (无需计算存储位置)
      state!.data.push(resolve, reject, perms, signal);

      // 如果提供了 signal，绑定 signal 和 reject
      if (signal) {
        linkSignalAndReject(signal, reject);
      }
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
    while (state!.head < state!.data.length) {
      const baseIndex = state!.head;
      const nextResolve = state!.data[baseIndex + RESOLVE_OFFSET];
      const nextReject = state!.data[baseIndex + REJECT_OFFSET];
      const nextPerms = state!.data[baseIndex + PERM_OFFSET];
      const nextSignal = state!.data[baseIndex + SIGNAL_OFFSET];

      // 检查请求是否已被取消
      if (nextSignal?.aborted) {
        // 跳过已取消的请求，移动头部指针
        state!.head += ELEMENTS_PER_ENTRY;
        // 请求已被 onAbort 拒绝，无需再次拒绝
        continue;
      }

      if (state!.available >= nextPerms) {
        // 满足队首请求，移动头部指针
        state!.head += ELEMENTS_PER_ENTRY;
        state!.available -= nextPerms;

        if (nextSignal) {
          // 删除与 signal 的连接
          mapSignalToRejects.get(nextSignal)?.delete(nextReject);
        }

        nextResolve();
      } else {
        // 许可不足，停止处理
        break;
      }
    }
    // 压缩队列以释放内存
    if (state!.head > 1024 && state!.head * 2 > state!.data.length) {
      state!.data.splice(0, state!.head);
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
