import { resourcePool } from './resourcePool';

describe('resourcePool', () => {
  beforeEach(() => {
    // 清理全局状态，由于 mapResourcePoolIdToState 是模块内部的，
    // 我们无法直接清理，但可以通过使用不同的 poolId 来避免测试间干扰
  });

  describe('basic functionality', () => {
    it('should create token pool with default capacity 1', () => {
      const pool = resourcePool('test-1');
      expect(pool.read()).toBe(1);
    });

    it('should create token pool with custom capacity', () => {
      const pool = resourcePool('test-2', { capacity: 5 });
      expect(pool.read()).toBe(5);
    });

    it('should throw error for invalid capacity (zero)', () => {
      expect(() => resourcePool('test-error-1', { capacity: 0 })).toThrow('RESOURCE_POOL_INVALID_CAPACITY');
    });

    it('should throw error for invalid capacity (negative)', () => {
      expect(() => resourcePool('test-error-2', { capacity: -1 })).toThrow('RESOURCE_POOL_INVALID_CAPACITY');
    });
  });

  describe('acquire', () => {
    it('should acquire tokens immediately when available', async () => {
      const pool = resourcePool('test-acquire-1', { capacity: 3 });
      await pool.acquire(2);
      expect(pool.read()).toBe(1);
    });

    it('should throw error for acquiring zero tokens', async () => {
      const pool = resourcePool('test-acquire-2');
      await expect(pool.acquire(0)).rejects.toThrow('RESOURCE_POOL_INVALID_ACQUIRE_TOKENS');
    });

    it('should throw error for acquiring negative tokens', async () => {
      const pool = resourcePool('test-acquire-3');
      await expect(pool.acquire(-1)).rejects.toThrow('RESOURCE_POOL_INVALID_ACQUIRE_TOKENS');
    });

    it('should throw error when acquiring more than capacity', async () => {
      const pool = resourcePool('test-acquire-4', { capacity: 2 });
      await expect(pool.acquire(3)).rejects.toThrow('RESOURCE_POOL_INSUFFICIENT_CAPACITY');
    });

    it('should wait when insufficient tokens', async () => {
      const pool = resourcePool('test-wait-1', { capacity: 1 });

      // 获取唯一令牌
      await pool.acquire(1);
      expect(pool.read()).toBe(0);

      // 第二个请求应该等待
      let secondAcquired = false;
      const secondPromise = pool.acquire(1).then(() => {
        secondAcquired = true;
      });

      // 确保第二个请求还没完成
      await Promise.race([secondPromise, new Promise((resolve) => setTimeout(resolve, 50))]);
      expect(secondAcquired).toBe(false);

      // 释放令牌，第二个请求应该完成
      pool.release(1);
      await secondPromise;
      expect(secondAcquired).toBe(true);
      expect(pool.read()).toBe(0);
    });

    it('should handle multiple tokens per request', async () => {
      const pool = resourcePool('test-multi-1', { capacity: 10 });
      await pool.acquire(5);
      expect(pool.read()).toBe(5);

      await pool.acquire(3);
      expect(pool.read()).toBe(2);
    });
  });

  describe('release', () => {
    it('should release tokens', () => {
      const pool = resourcePool('test-release-1', { capacity: 3 });
      pool.acquire(2);
      expect(pool.read()).toBe(1);
      pool.release(1);
      expect(pool.read()).toBe(2);
    });

    it('should throw error for releasing zero tokens', () => {
      const pool = resourcePool('test-release-2');
      expect(() => pool.release(0)).toThrow('RESOURCE_POOL_INVALID_RELEASE_TOKENS');
    });

    it('should throw error for releasing negative tokens', () => {
      const pool = resourcePool('test-release-3');
      expect(() => pool.release(-1)).toThrow('RESOURCE_POOL_INVALID_RELEASE_TOKENS');
    });

    it('should throw error when release would exceed capacity', () => {
      const pool = resourcePool('test-release-4', { capacity: 3 });
      pool.acquire(1);
      expect(pool.read()).toBe(2);
      // 当前有2个令牌，容量是3，释放2个令牌会变成4，超过容量
      expect(() => pool.release(2)).toThrow('RESOURCE_POOL_RELEASE_EXCEEDS_CAPACITY');
    });

    it('should not exceed capacity after release', () => {
      const pool = resourcePool('test-release-5', { capacity: 5 });
      pool.acquire(3);
      expect(pool.read()).toBe(2);
      pool.release(2);
      expect(pool.read()).toBe(4);
      pool.release(1);
      expect(pool.read()).toBe(5);
      // 再释放应该报错
      expect(() => pool.release(1)).toThrow('RESOURCE_POOL_RELEASE_EXCEEDS_CAPACITY');
    });
  });

  describe('shared state', () => {
    it('should share state for same poolId', () => {
      const pool1 = resourcePool('shared-1', { capacity: 5 });
      const pool2 = resourcePool('shared-1', { capacity: 5 });

      pool1.acquire(3);
      expect(pool2.read()).toBe(2);

      pool2.acquire(1);
      expect(pool1.read()).toBe(1);
    });

    it('should have separate state for different poolId', () => {
      const pool1 = resourcePool('diff-1', { capacity: 5 });
      const pool2 = resourcePool('diff-2', { capacity: 3 });

      pool1.acquire(3);
      expect(pool2.read()).toBe(3); // 仍然是满的

      pool2.acquire(2);
      expect(pool1.read()).toBe(2);
      expect(pool2.read()).toBe(1);
    });

    it('should use first call options for shared pool', () => {
      const pool1 = resourcePool('shared-options-1', { capacity: 10 });
      const pool2 = resourcePool('shared-options-1', { capacity: 5 }); // 应该忽略

      expect(pool1.read()).toBe(10);
      expect(pool2.read()).toBe(10);

      // 如果第二个调用的容量被忽略，那么获取6个令牌应该成功
      pool2.acquire(6);
      expect(pool2.read()).toBe(4);
    });
  });

  describe('FIFO order', () => {
    it('should maintain FIFO order', async () => {
      const pool = resourcePool('test-fifo-1', { capacity: 3 });
      const order: number[] = [];

      // 第一个请求获取所有令牌（立即完成）
      await pool.acquire(3);

      // 后续多个请求排队
      const promises = [1, 2, 3].map((i) =>
        pool.acquire(1).then(() => {
          order.push(i);
        }),
      );

      // 释放令牌，检查顺序
      pool.release(3);
      await Promise.all(promises);
      expect(order).toEqual([1, 2, 3]);
    });

    it('should handle multiple tokens per request in FIFO order', async () => {
      const pool = resourcePool('test-fifo-multi', { capacity: 10 });
      const order: number[] = [];

      // 第一个请求获取所有令牌（立即完成）
      await pool.acquire(10);
      order.push(1);

      // 第二个请求需要3个令牌（排队）
      const promise2 = pool.acquire(3).then(() => {
        order.push(2);
      });

      // 第三个请求需要2个令牌（排队）
      const promise3 = pool.acquire(2).then(() => {
        order.push(3);
      });

      // 先释放3个令牌，第二个请求完成
      pool.release(3);
      await promise2;
      expect(order).toEqual([1, 2]);

      // 再释放2个令牌，第三个请求完成
      pool.release(2);
      await promise3;
      expect(order).toEqual([1, 2, 3]);
    });
  });

  describe('concurrency', () => {
    it('should handle high concurrency', async () => {
      const pool = resourcePool('test-concurrent-1', { capacity: 5 });
      const results: number[] = [];

      const promises = Array.from({ length: 20 }, (_, i) =>
        pool.acquire(1).then(() => {
          results.push(i);
          pool.release(1);
          return i;
        }),
      );

      const outputs = await Promise.all(promises);

      expect(outputs).toHaveLength(20);
      expect(outputs.sort((a, b) => a - b)).toEqual([...Array(20).keys()]);
      expect(pool.read()).toBe(5);
    });

    it('should maintain order with FIFO queue under high load', async () => {
      const pool = resourcePool('test-concurrent-2', { capacity: 1 });
      const order: number[] = [];

      const promises = Array.from({ length: 10 }, (_, i) =>
        pool.acquire(1).then(() => {
          order.push(i);
          pool.release(1);
          return i;
        }),
      );

      const outputs = await Promise.all(promises);

      // 应该按顺序执行
      expect(order).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(outputs).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
  });

  describe('read method', () => {
    it('should return current available tokens', async () => {
      const pool = resourcePool('test-read-1', { capacity: 5 });
      expect(pool.read()).toBe(5);

      // 获取2个令牌
      await pool.acquire(2);
      expect(pool.read()).toBe(3);

      // 释放1个令牌
      pool.release(1);
      expect(pool.read()).toBe(4);

      // 再释放1个令牌，达到容量
      pool.release(1);
      expect(pool.read()).toBe(5);

      // 再释放应该报错
      expect(() => pool.release(1)).toThrow('RESOURCE_POOL_RELEASE_EXCEEDS_CAPACITY');
    });
  });
});
