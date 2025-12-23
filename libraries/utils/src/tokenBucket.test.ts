import { tokenBucket } from './tokenBucket';

describe('tokenBucket', () => {
  beforeEach(() => {
    // 使用不同的 bucketId 避免测试间干扰
  });

  describe('basic functionality', () => {
    it('should create token bucket with full capacity', () => {
      const tb = tokenBucket('test-1', { capacity: 5 });
      expect(tb.read()).toBe(5);
      tb[Symbol.dispose]();
    });

    it('should create token bucket with default capacity 1', () => {
      const tb = tokenBucket('test-2');
      expect(tb.read()).toBe(1);
      tb[Symbol.dispose]();
    });

    it('should acquire tokens immediately when available', async () => {
      const tb = tokenBucket('test-3', { capacity: 3 });
      await tb.acquire(2);
      expect(tb.read()).toBe(1);
      tb[Symbol.dispose]();
    });

    it('should throw error when acquiring zero or negative tokens', async () => {
      const tb = tokenBucket('test-7');
      await expect(tb.acquire(0)).rejects.toThrow('TOKEN_BUCKET_INVALID_ACQUIRE_TOKENS');
      await expect(tb.acquire(-1)).rejects.toThrow('TOKEN_BUCKET_INVALID_ACQUIRE_TOKENS');
      tb[Symbol.dispose]();
    });

    it('should throw error when acquiring more than capacity', async () => {
      const tb = tokenBucket('test-8', { capacity: 2 });
      await expect(tb.acquire(3)).rejects.toThrow('TOKEN_BUCKET_INSUFFICIENT_CAPACITY');
      tb[Symbol.dispose]();
    });
  });

  describe('token refill', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should refill tokens over time', async () => {
      const tb = tokenBucket('test-refill-1', {
        capacity: 5,
        refillInterval: 100, // 100ms
        refillAmount: 1,
      });

      // 获取所有令牌
      await tb.acquire(5);
      expect(tb.read()).toBe(0);

      // 推进时间 150ms，应该补充至少 1 个令牌
      jest.advanceTimersByTime(150);
      // 等待微任务执行
      await Promise.resolve();

      // 应该补充了至少 1 个令牌
      expect(tb.read()).toBeGreaterThanOrEqual(1);
      expect(tb.read()).toBeLessThanOrEqual(2); // 最多补充 2 个（可能刚好跨越两个间隔）

      // 再推进 200ms
      jest.advanceTimersByTime(200);
      await Promise.resolve();
      expect(tb.read()).toBeGreaterThanOrEqual(3);
      tb[Symbol.dispose]();
    });

    it('should not exceed capacity when refilling', async () => {
      const tb = tokenBucket('test-refill-2', {
        capacity: 3,
        refillInterval: 50,
        refillAmount: 2,
      });

      // 获取 1 个令牌，剩下 2 个
      await tb.acquire(1);
      expect(tb.read()).toBe(2);

      // 推进 60ms，但容量只有 3，所以最多补充 1 个令牌
      jest.advanceTimersByTime(60);
      await Promise.resolve();
      expect(tb.read()).toBe(3); // 达到容量

      // 再推进 60ms，应该保持容量
      jest.advanceTimersByTime(60);
      await Promise.resolve();
      expect(tb.read()).toBe(3);
      tb[Symbol.dispose]();
    });

    it('should handle zero refillAmount (no refill)', async () => {
      expect(() => {
        const tb = tokenBucket('test-refill-3', {
          capacity: 2,
          refillInterval: 100,
          refillAmount: 0, // 不补充
        });
      }).toThrow();
    });

    it('should handle infinite refillInterval (no refill)', async () => {
      expect(() => {
        const tb = tokenBucket('test-refill-4', {
          capacity: 2,
          refillInterval: Infinity, // 不补充
          refillAmount: 1,
        });
      }).toThrow();
    });
  });

  describe('shared state', () => {
    it('should share state for same bucketId', () => {
      const tb1 = tokenBucket('shared-1', { capacity: 5 });
      const tb2 = tokenBucket('shared-1', { capacity: 5 }); // 相同 ID，忽略 options

      tb1.acquire(3);
      expect(tb2.read()).toBe(2);

      tb2.acquire(1);
      expect(tb1.read()).toBe(1);
      tb1[Symbol.dispose]();
      tb2[Symbol.dispose]();
    });

    it('should have separate state for different bucketId', () => {
      const tb1 = tokenBucket('diff-1', { capacity: 5 });
      const tb2 = tokenBucket('diff-2', { capacity: 3 });

      tb1.acquire(3);
      expect(tb2.read()).toBe(3); // 仍然是满的

      tb2.acquire(2);
      expect(tb1.read()).toBe(2);
      expect(tb2.read()).toBe(1);
      tb1[Symbol.dispose]();
      tb2[Symbol.dispose]();
    });

    it('should use first call options for shared bucket', () => {
      const tb1 = tokenBucket('shared-options-1', { capacity: 10, refillInterval: 200 });
      const tb2 = tokenBucket('shared-options-1', { capacity: 5, refillInterval: 100 }); // 应该忽略

      expect(tb1.read()).toBe(10);
      expect(tb2.read()).toBe(10);

      // 如果第二个调用的容量被忽略，那么获取 6 个令牌应该成功
      tb2.acquire(6);
      expect(tb2.read()).toBe(4);
      tb1[Symbol.dispose]();
      tb2[Symbol.dispose]();
    });
  });
});
