import { createCache, ICacheOptions } from './cache';

describe('createCache', () => {
  // Mock remote read function
  const mockReadRemote = jest.fn();

  beforeEach(() => {
    mockReadRemote.mockClear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('基础功能', () => {
    it('应该能够设置和获取数据', () => {
      const cache = createCache(mockReadRemote);
      const testData = { value: 'test' };

      cache.set('key1', testData);
      expect(cache.get('key1')).toBe(testData);
    });

    it('应该能够通过 query 方法获取数据', async () => {
      const testData = { value: 'test' };
      mockReadRemote.mockResolvedValue(testData);

      const cache = createCache(mockReadRemote);
      const result = await cache.query('key1');

      expect(result).toBe(testData);
      expect(mockReadRemote).toHaveBeenCalledWith('key1', false);
      expect(cache.get('key1')).toBe(testData);
    });

    it('应该能够强制更新数据', async () => {
      const testData1 = { value: 'test1' };
      const testData2 = { value: 'test2' };
      mockReadRemote.mockResolvedValueOnce(testData1).mockResolvedValueOnce(testData2);

      const cache = createCache(mockReadRemote);

      // 第一次查询
      const result1 = await cache.query('key1');
      expect(result1).toBe(testData1);

      // 强制更新
      const result2 = await cache.query('key1', true);
      expect(result2).toBe(testData2);
      expect(mockReadRemote).toHaveBeenCalledWith('key1', true);
    });

    it('应该返回 undefined 当远程数据不存在时', async () => {
      mockReadRemote.mockResolvedValue(undefined);

      const cache = createCache(mockReadRemote);
      const result = await cache.query('key1');

      expect(result).toBeUndefined();
      expect(cache.get('key1')).toBeUndefined();
    });
  });

  describe('过期时间', () => {
    it('应该自动清理过期的数据', async () => {
      const testData = { value: 'test' };
      mockReadRemote.mockResolvedValue(testData);

      const options: ICacheOptions<typeof testData> = {
        expire: 1000, // 1秒过期
      };

      const cache = createCache(mockReadRemote, options);

      // 设置数据
      await cache.query('key1');
      expect(cache.get('key1')).toBe(testData);

      // 前进时间，但未过期
      jest.advanceTimersByTime(500);
      expect(cache.get('key1')).toBe(testData);

      // 前进时间到过期
      jest.advanceTimersByTime(600);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('应该检查过期状态在 get 操作时', () => {
      const testData = { value: 'test' };
      const options: ICacheOptions<typeof testData> = {
        expire: 1000,
      };

      const cache = createCache(mockReadRemote, options);

      // 手动设置数据
      cache.set('key1', testData);
      expect(cache.get('key1')).toBe(testData);

      // 前进时间到过期
      jest.advanceTimersByTime(1500);
      expect(cache.get('key1')).toBeUndefined();
    });
  });

  describe('本地存储', () => {
    it('应该能够从本地存储读取数据', async () => {
      const testData = { value: 'test' };
      const mockReadLocal = jest.fn().mockResolvedValue(testData);
      const mockWriteLocal = jest.fn().mockResolvedValue(undefined);

      const options: ICacheOptions<typeof testData> = {
        readLocal: mockReadLocal,
        writeLocal: mockWriteLocal,
      };

      const cache = createCache(mockReadRemote, options);

      const result = await cache.query('key1');

      expect(result).toBe(testData);
      expect(mockReadLocal).toHaveBeenCalledWith('key1');
      expect(cache.get('key1')).toBe(testData);
    });

    it('应该能够写入本地存储', async () => {
      const testData = { value: 'test' };
      mockReadRemote.mockResolvedValue(testData);
      const mockWriteLocal = jest.fn().mockResolvedValue(undefined);

      const options: ICacheOptions<typeof testData> = {
        writeLocal: mockWriteLocal,
      };

      const cache = createCache(mockReadRemote, options);

      await cache.query('key1');

      expect(mockWriteLocal).toHaveBeenCalledWith('key1', testData);
    });

    it('应该优先使用本地存储而不是远程读取', async () => {
      const localData = { value: 'local' };
      const remoteData = { value: 'remote' };
      const mockReadLocal = jest.fn().mockResolvedValue(localData);
      mockReadRemote.mockResolvedValue(remoteData);

      const options: ICacheOptions<typeof localData> = {
        readLocal: mockReadLocal,
      };

      const cache = createCache(mockReadRemote, options);

      const result = await cache.query('key1');

      expect(result).toBe(localData);
      expect(mockReadLocal).toHaveBeenCalledWith('key1');
      expect(mockReadRemote).not.toHaveBeenCalled();
    });
  });

  describe('预刷新机制 (stale-while-revalidate)', () => {
    it('应该在 swrAfter 时间内触发后台刷新', async () => {
      const testData = { value: 'test' };
      const updatedData = { value: 'updated' };

      mockReadRemote.mockResolvedValueOnce(testData).mockResolvedValueOnce(updatedData);

      const options: ICacheOptions<typeof testData> = {
        swrAfter: 500,
        expire: 1000,
      };

      const cache = createCache(mockReadRemote, options);

      // 第一次查询
      await cache.query('key1');
      expect(mockReadRemote).toHaveBeenCalledTimes(1);

      // 前进时间到 swrAfter 范围内
      jest.advanceTimersByTime(600);

      // 再次查询，应该返回旧数据但触发后台刷新
      const result = await cache.query('key1');
      expect(result).toBe(testData); // 仍然返回旧数据

      // 等待后台刷新完成
      await Promise.resolve();

      // 检查后台刷新是否被调用
      expect(mockReadRemote).toHaveBeenCalledTimes(2);
      expect(mockReadRemote).toHaveBeenLastCalledWith('key1', true);
    });

    it('不应该在 swrAfter 时间外触发后台刷新', async () => {
      const testData = { value: 'test' };
      mockReadRemote.mockResolvedValue(testData);

      const options: ICacheOptions<typeof testData> = {
        swrAfter: 500,
        expire: 1000,
      };

      const cache = createCache(mockReadRemote, options);

      // 第一次查询
      await cache.query('key1');
      expect(mockReadRemote).toHaveBeenCalledTimes(1);

      // 前进时间到 swrAfter 范围外但未过期
      jest.advanceTimersByTime(300);

      // 再次查询，不应该触发后台刷新
      await cache.query('key1');
      expect(mockReadRemote).toHaveBeenCalledTimes(1); // 仍然是1次
    });
  });

  describe('统计信息', () => {
    it('应该正确统计各种操作', async () => {
      const testData = { value: 'test' };
      mockReadRemote.mockResolvedValue(testData);
      const mockReadLocal = jest.fn().mockResolvedValue(undefined);
      const mockWriteLocal = jest.fn().mockResolvedValue(undefined);

      const options: ICacheOptions<typeof testData> = {
        readLocal: mockReadLocal,
        writeLocal: mockWriteLocal,
      };

      const cache = createCache(mockReadRemote, options);

      // 初始状态
      expect(cache.stats.query).toBe(0);
      expect(cache.stats.readRemote).toBe(0);
      expect(cache.stats.readLocal).toBe(0);
      expect(cache.stats.writeLocal).toBe(0);
      expect(cache.stats.force_update).toBe(0);
      expect(cache.stats.expire_check).toBe(0);

      // 执行查询
      await cache.query('key1');

      expect(cache.stats.query).toBe(1);
      expect(cache.stats.readRemote).toBe(1);
      expect(cache.stats.readLocal).toBe(1);
      expect(cache.stats.writeLocal).toBe(1);
      expect(cache.stats.force_update).toBe(0);
      // 过期检查可能在查询过程中发生，但不保证一定会发生
      // 因为如果数据不存在或强制更新，可能不会检查过期

      // 强制更新
      await cache.query('key1', true);
      expect(cache.stats.force_update).toBe(1);
    });

    it('应该统计过期检查', () => {
      const testData = { value: 'test' };
      const options: ICacheOptions<typeof testData> = {
        expire: 1000,
      };

      const cache = createCache(mockReadRemote, options);

      cache.set('key1', testData);

      // 第一次 get 应该触发过期检查
      cache.get('key1');
      expect(cache.stats.expire_check).toBe(1);

      // 第二次 get 应该再次触发过期检查
      cache.get('key1');
      expect(cache.stats.expire_check).toBe(2);
    });
  });

  describe('错误处理', () => {
    it('应该处理远程读取错误', async () => {
      mockReadRemote.mockRejectedValue(new Error('Network error'));

      const cache = createCache(mockReadRemote);
      const result = await cache.query('key1');

      expect(result).toBeUndefined();
      expect(cache.get('key1')).toBeUndefined();
    });

    it('应该处理本地读取错误', async () => {
      const mockReadLocal = jest.fn().mockRejectedValue(new Error('Local read error'));
      mockReadRemote.mockResolvedValue({ value: 'remote' });

      const options: ICacheOptions<{ value: string }> = {
        readLocal: mockReadLocal,
      };

      const cache = createCache(mockReadRemote, options);
      const result = await cache.query('key1');

      expect(result).toEqual({ value: 'remote' }); // 应该回退到远程读取
    });

    it('应该处理本地写入错误', async () => {
      const mockWriteLocal = jest.fn().mockRejectedValue(new Error('Local write error'));
      mockReadRemote.mockResolvedValue({ value: 'test' });

      const options: ICacheOptions<{ value: string }> = {
        writeLocal: mockWriteLocal,
      };

      const cache = createCache(mockReadRemote, options);
      const result = await cache.query('key1');

      expect(result).toEqual({ value: 'test' }); // 写入错误不应该影响查询结果
    });

    it('应该处理并发查询', async () => {
      const testData = { value: 'test' };
      let resolvePromise: (value: { value: string }) => void;
      const promise = new Promise<{ value: string }>((resolve) => {
        resolvePromise = resolve;
      });
      mockReadRemote.mockReturnValue(promise);

      const cache = createCache(mockReadRemote);

      // 启动多个并发查询
      const query1 = cache.query('key1');
      const query2 = cache.query('key1');
      const query3 = cache.query('key1');

      // 解析 Promise
      resolvePromise!(testData);

      const results = await Promise.all([query1, query2, query3]);

      // 所有查询应该返回相同的结果
      results.forEach((result) => {
        expect(result).toBe(testData);
      });

      // 远程读取应该只被调用一次
      expect(mockReadRemote).toHaveBeenCalledTimes(1);
    });
  });

  describe('边界情况', () => {
    it('应该处理空键名', () => {
      const cache = createCache(mockReadRemote);
      const testData = { value: 'test' };

      cache.set('', testData);
      expect(cache.get('')).toBe(testData);
    });

    it('应该处理特殊字符键名', () => {
      const cache = createCache(mockReadRemote);
      const testData = { value: 'test' };
      const specialKey = 'key/with/slashes';

      cache.set(specialKey, testData);
      expect(cache.get(specialKey)).toBe(testData);
    });

    it('应该正确处理 undefined 值', () => {
      const cache = createCache(mockReadRemote);

      cache.set('key1', undefined as any);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('应该正确处理 null 值', () => {
      const cache = createCache(mockReadRemote);

      cache.set('key1', null as any);
      expect(cache.get('key1')).toBeNull();
    });
  });
});
