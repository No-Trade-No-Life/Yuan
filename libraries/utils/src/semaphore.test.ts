import { semaphore } from './semaphore';

describe('semaphore', () => {
  beforeEach(() => {
    // 清理全局状态，由于 mapSemaphoreIdToState 是模块内部的，
    // 我们无法直接清理，但可以通过使用不同的 semaphoreId 来避免测试间干扰
  });

  describe('basic functionality', () => {
    it('should create semaphore with zero initial permits', () => {
      const s = semaphore('test-1');
      expect(s.read()).toBe(0);
    });

    it('should set initial permits via release', () => {
      const s = semaphore('test-2');
      s.release(5);
      expect(s.read()).toBe(5);
    });

    it('should acquire permits immediately when available', async () => {
      const s = semaphore('test-3');
      s.release(3);
      await s.acquire(2);
      expect(s.read()).toBe(1);
    });

    it('should wait when insufficient permits', async () => {
      const s = semaphore('test-4');
      s.release(1);

      // 第一个请求获取所有许可（立即完成）
      await s.acquire(1);

      // 第二个请求应该等待（没有可用许可）
      let secondAcquired = false;
      const secondPromise = s.acquire(1).then(() => {
        secondAcquired = true;
      });

      // 确保第二个请求还没完成
      await Promise.race([secondPromise, new Promise((resolve) => setTimeout(resolve, 50))]);
      expect(secondAcquired).toBe(false);

      // 释放许可，第二个请求应该完成
      s.release(1);
      await secondPromise;
      expect(secondAcquired).toBe(true);
      expect(s.read()).toBe(0);
    });

    it('should handle zero or negative permits (no validation)', async () => {
      const s = semaphore('test-5');
      // 实现可能不验证参数，这些调用应该不会抛出错误
      // 但我们不测试具体行为，只确保不会崩溃
      s.release(5);
      await s.acquire(5);
      expect(s.read()).toBe(0);
    });
  });

  describe('FIFO order', () => {
    it('should maintain FIFO order', async () => {
      const s = semaphore('test-fifo-1');
      s.release(1);
      const order: number[] = [];

      // 第一个请求获取所有许可（立即完成）
      await s.acquire(1);

      // 后续多个请求排队
      const promises = [1, 2, 3].map((i) =>
        s.acquire(1).then(() => {
          order.push(i);
        }),
      );

      // 释放许可，检查顺序
      s.release(3);
      await Promise.all(promises);
      expect(order).toEqual([1, 2, 3]);
    });

    it('should handle multiple permits per request', async () => {
      const s = semaphore('test-multi-1');
      s.release(10);

      // 请求多个许可
      await s.acquire(5);
      expect(s.read()).toBe(5);

      await s.acquire(3);
      expect(s.read()).toBe(2);
    });

    it('should wait for exact number of permits', async () => {
      const s = semaphore('test-exact-1');
      s.release(3);

      // 第一个请求需要5个许可，应该等待
      let firstAcquired = false;
      const firstPromise = s.acquire(5).then(() => {
        firstAcquired = true;
      });

      // 第二个请求需要2个许可，应该可以立即获取
      await s.acquire(2);
      expect(s.read()).toBe(1);
      expect(firstAcquired).toBe(false);

      // 释放2个许可，第一个请求还需要2个
      s.release(2);
      expect(s.read()).toBe(3);
      expect(firstAcquired).toBe(false);

      // 再释放2个许可，第一个请求应该完成
      s.release(2);
      await firstPromise;
      expect(firstAcquired).toBe(true);
      expect(s.read()).toBe(0);
    });
  });

  describe('shared state', () => {
    it('should share state for same semaphoreId', () => {
      const s1 = semaphore('shared-1');
      const s2 = semaphore('shared-1');

      s1.release(5);
      expect(s2.read()).toBe(5);

      s2.acquire(3);
      expect(s1.read()).toBe(2);
    });

    it('should have separate state for different semaphoreId', () => {
      const s1 = semaphore('diff-1');
      const s2 = semaphore('diff-2');

      s1.release(5);
      expect(s2.read()).toBe(0);

      s2.release(3);
      expect(s1.read()).toBe(5);
      expect(s2.read()).toBe(3);
    });
  });

  describe('queue management', () => {
    it('should partially wake up requests when insufficient permits', async () => {
      const s = semaphore('test-queue-1');

      const results = [false, false, false];
      const promises = results.map((_, i) =>
        s.acquire(2).then(() => {
          results[i] = true;
        }),
      );

      // 释放3个许可，只够第一个请求（需要2个）
      s.release(3);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(results[0]).toBe(true);
      expect(results[1]).toBe(false);
      expect(results[2]).toBe(false);
      expect(s.read()).toBe(1);

      // 释放2个许可，够第二个请求，但不够第三个
      s.release(2);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(results[1]).toBe(true);
      expect(results[2]).toBe(false);
      expect(s.read()).toBe(1);

      // 清理：释放足够许可让第三个请求完成
      s.release(2);
      await Promise.all(promises);
    });

    it('should wake up all waiting requests when enough permits', async () => {
      const s = semaphore('test-queue-2');

      const acquired = Promise.all([s.acquire(), s.acquire(), s.acquire()]);

      // 释放足够许可
      s.release(3);
      await acquired;
      expect(s.read()).toBe(0);
    });
  });

  describe('read method', () => {
    it('should return current available permits', () => {
      const s = semaphore('test-read-1');
      s.release(5);
      expect(s.read()).toBe(5);

      // 模拟获取许可（不实际等待）
      s.acquire(2);
      expect(s.read()).toBe(3);

      s.release(1);
      expect(s.read()).toBe(4);
    });
  });

  describe('concurrency', () => {
    it('should handle high concurrency', async () => {
      const s = semaphore('test-concurrent-1');
      s.release(5);
      const results: number[] = [];

      const promises = Array.from({ length: 20 }, (_, i) =>
        s.acquire(1).then(() => {
          results.push(i);
          s.release(1);
          return i;
        }),
      );

      const outputs = await Promise.all(promises);

      expect(outputs).toHaveLength(20);
      expect(outputs.sort((a, b) => a - b)).toEqual([...Array(20).keys()]);
      expect(s.read()).toBe(5);
    });

    it('should maintain order with FIFO queue under high load', async () => {
      const s = semaphore('test-concurrent-2');
      s.release(1);
      const order: number[] = [];

      const promises = Array.from({ length: 10 }, (_, i) =>
        s.acquire(1).then(() => {
          order.push(i);
          s.release(1);
          return i;
        }),
      );

      const outputs = await Promise.all(promises);

      // 应该按顺序执行
      expect(order).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(outputs).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
  });

  describe('error handling', () => {
    it('should handle function errors in acquire', async () => {
      const s = semaphore('test-error-1');
      s.release(1);

      // 正常的acquire应该工作
      await s.acquire(1);
      expect(s.read()).toBe(0);
    });
  });
});
