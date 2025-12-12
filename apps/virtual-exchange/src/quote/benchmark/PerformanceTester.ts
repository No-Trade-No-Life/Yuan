import { performance } from 'perf_hooks';

/**
 * 性能测试工具类
 */
export class PerformanceTester {
  /**
   * 测量函数执行时间
   */
  static async measureTime<T>(fn: () => Promise<T> | T): Promise<{ result: T; time: number }> {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    return { result, time: end - start };
  }

  /**
   * 多次测量函数执行时间，取平均值
   */
  static async measureTimeWithStats<T>(
    fn: () => Promise<T> | T,
    iterations: number = 5,
  ): Promise<{ result: T; avgTime: number; minTime: number; maxTime: number; times: number[] }> {
    const times: number[] = [];
    let finalResult: T | undefined;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const result = await fn();
      const end = performance.now();

      if (i === 0) finalResult = result;
      times.push(end - start);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    return {
      result: finalResult!,
      avgTime,
      minTime,
      maxTime,
      times,
    };
  }

  /**
   * 尝试触发垃圾回收（如果可用）
   */
  static tryGarbageCollect(): void {
    if (typeof global !== 'undefined' && (global as any).gc) {
      try {
        (global as any).gc();
      } catch (error) {
        // 忽略GC错误
      }
    }
  }

  /**
   * 确保在内存测量前清理环境
   */
  static prepareForMemoryMeasurement(): void {
    // 触发GC（如果可用）
    this.tryGarbageCollect();

    // 给GC一些时间
    if (typeof setImmediate !== 'undefined') {
      // 使用setImmediate让事件循环有机会处理GC
      return;
    }
  }

  /**
   * 获取内存使用情况（在清理后）
   */
  static getMemoryUsage(): NodeJS.MemoryUsage | null {
    this.prepareForMemoryMeasurement();
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage();
    }
    return null;
  }

  /**
   * 测量内存使用增长
   */
  static async measureMemoryUsage<T>(fn: () => Promise<T> | T): Promise<{
    result: T;
    memoryBefore: NodeJS.MemoryUsage | null;
    memoryAfter: NodeJS.MemoryUsage | null;
    heapUsedDiff: number | null;
  }> {
    // 清理环境并获取初始内存
    this.prepareForMemoryMeasurement();
    const memoryBefore = this.getMemoryUsage();

    // 执行函数
    const result = await fn();

    // 再次清理环境并获取最终内存
    this.prepareForMemoryMeasurement();
    const memoryAfter = this.getMemoryUsage();

    // 计算内存差异
    let heapUsedDiff: number | null = null;
    if (
      memoryBefore &&
      memoryAfter &&
      memoryBefore.heapUsed !== undefined &&
      memoryAfter.heapUsed !== undefined
    ) {
      heapUsedDiff = memoryAfter.heapUsed - memoryBefore.heapUsed;
    }

    return {
      result,
      memoryBefore,
      memoryAfter,
      heapUsedDiff,
    };
  }

  /**
   * 格式化字节大小
   */
  static formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    if (isNaN(bytes)) return 'NaN';

    const sign = bytes < 0 ? '-' : '';
    const absBytes = Math.abs(bytes);

    if (absBytes < 1024) {
      return `${sign}${absBytes} ${sizes[0]}`;
    }

    const i = Math.floor(Math.log(absBytes) / Math.log(1024));
    const value = Math.round((absBytes / Math.pow(1024, i)) * 100) / 100;
    return `${sign}${value} ${sizes[i]}`;
  }

  /**
   * 格式化时间
   */
  static formatTime(ms: number): string {
    if (ms < 1) return `${ms.toFixed(3)}ms`;
    if (ms < 1000) return `${ms.toFixed(2)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }
}
