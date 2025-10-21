import {
  encryptByPublicKey,
  encryptByPublicKeyAsync,
  decryptByPrivateKey,
  decryptByPrivateKeyAsync,
  createKeyPair,
} from './crypto';

/**
 * 性能测试工具类
 */
class PerformanceTester {
  /**
   * 生成指定大小的测试数据
   */
  static generateTestData(sizeInBytes: number): Uint8Array {
    const data = new Uint8Array(sizeInBytes);
    for (let i = 0; i < sizeInBytes; i++) {
      data[i] = Math.floor(Math.random() * 256);
    }
    return data;
  }

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
   * 获取内存使用情况
   */
  static getMemoryUsage(): NodeJS.MemoryUsage | null {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage();
    }
    return null;
  }

  /**
   * 格式化字节大小
   */
  static formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
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

/**
 * 性能测试主类
 */
class CryptoPerformanceTest {
  private keyPair = createKeyPair();

  /**
   * 运行单个测试场景
   */
  public async runTestScenario(
    dataSize: number,
    iterations: number = 1,
  ): Promise<{
    dataSize: number;
    iterations: number;
    syncEncrypt: { time: number; encryptedSize: number };
    asyncEncrypt: { time: number; encryptedSize: number };
    syncDecrypt: { time: number };
    asyncDecrypt: { time: number };
    memoryBefore: NodeJS.MemoryUsage | null;
    memoryAfter: NodeJS.MemoryUsage | null;
  }> {
    const testData = PerformanceTester.generateTestData(dataSize);
    const memoryBefore = PerformanceTester.getMemoryUsage();

    // 测试同步加密
    const syncEncryptResult = await PerformanceTester.measureTime(() => {
      let encrypted: Uint8Array | null = null;
      for (let i = 0; i < iterations; i++) {
        encrypted = encryptByPublicKey(testData, this.keyPair.public_key);
      }
      return encrypted!;
    });

    // 测试异步加密
    const asyncEncryptResult = await PerformanceTester.measureTime(async () => {
      let encrypted: Uint8Array | null = null;
      for (let i = 0; i < iterations; i++) {
        encrypted = await encryptByPublicKeyAsync(testData, this.keyPair.public_key);
      }
      return encrypted!;
    });

    // 测试同步解密
    const syncDecryptResult = await PerformanceTester.measureTime(() => {
      for (let i = 0; i < iterations; i++) {
        decryptByPrivateKey(syncEncryptResult.result, this.keyPair.private_key);
      }
    });

    // 测试异步解密
    const asyncDecryptResult = await PerformanceTester.measureTime(async () => {
      for (let i = 0; i < iterations; i++) {
        await decryptByPrivateKeyAsync(asyncEncryptResult.result, this.keyPair.private_key);
      }
    });

    const memoryAfter = PerformanceTester.getMemoryUsage();

    return {
      dataSize,
      iterations,
      syncEncrypt: {
        time: syncEncryptResult.time,
        encryptedSize: syncEncryptResult.result.length,
      },
      asyncEncrypt: {
        time: asyncEncryptResult.time,
        encryptedSize: asyncEncryptResult.result.length,
      },
      syncDecrypt: {
        time: syncDecryptResult.time,
      },
      asyncDecrypt: {
        time: asyncDecryptResult.time,
      },
      memoryBefore,
      memoryAfter,
    };
  }

  /**
   * 打印测试结果
   */
  public printResults(results: any[]): void {
    console.log('\n' + '='.repeat(100));
    console.log('加密函数性能测试结果');
    console.log('='.repeat(100));

    for (const result of results) {
      console.log(`\n数据大小: ${PerformanceTester.formatBytes(result.dataSize)}`);
      console.log(`迭代次数: ${result.iterations}`);

      // 计算吞吐量 (MB/s)
      const syncEncryptThroughput =
        ((result.dataSize * result.iterations) / (result.syncEncrypt.time * 1024 * 1024)) * 1000;
      const asyncEncryptThroughput =
        ((result.dataSize * result.iterations) / (result.asyncEncrypt.time * 1024 * 1024)) * 1000;
      const syncDecryptThroughput =
        ((result.dataSize * result.iterations) / (result.syncDecrypt.time * 1024 * 1024)) * 1000;
      const asyncDecryptThroughput =
        ((result.dataSize * result.iterations) / (result.asyncDecrypt.time * 1024 * 1024)) * 1000;

      console.log('\n加密性能:');
      console.log(
        `  同步版本: ${PerformanceTester.formatTime(
          result.syncEncrypt.time,
        )} | ${syncEncryptThroughput.toFixed(2)} MB/s`,
      );
      console.log(
        `  异步版本: ${PerformanceTester.formatTime(
          result.asyncEncrypt.time,
        )} | ${asyncEncryptThroughput.toFixed(2)} MB/s`,
      );
      console.log(
        `  性能提升: ${((result.syncEncrypt.time / result.asyncEncrypt.time - 1) * 100).toFixed(2)}%`,
      );

      console.log('\n解密性能:');
      console.log(
        `  同步版本: ${PerformanceTester.formatTime(
          result.syncDecrypt.time,
        )} | ${syncDecryptThroughput.toFixed(2)} MB/s`,
      );
      console.log(
        `  异步版本: ${PerformanceTester.formatTime(
          result.asyncDecrypt.time,
        )} | ${asyncDecryptThroughput.toFixed(2)} MB/s`,
      );
      console.log(
        `  性能提升: ${((result.syncDecrypt.time / result.asyncDecrypt.time - 1) * 100).toFixed(2)}%`,
      );

      console.log('\n加密后数据大小:');
      console.log(
        `  同步版本: ${PerformanceTester.formatBytes(result.syncEncrypt.encryptedSize)} (膨胀率: ${(
          (result.syncEncrypt.encryptedSize / result.dataSize) *
          100
        ).toFixed(2)}%)`,
      );
      console.log(
        `  异步版本: ${PerformanceTester.formatBytes(result.asyncEncrypt.encryptedSize)} (膨胀率: ${(
          (result.asyncEncrypt.encryptedSize / result.dataSize) *
          100
        ).toFixed(2)}%)`,
      );

      if (result.memoryBefore && result.memoryAfter) {
        const memoryUsed = result.memoryAfter.heapUsed - result.memoryBefore.heapUsed;
        console.log(`\n内存使用: ${PerformanceTester.formatBytes(memoryUsed)}`);
      }

      console.log('-'.repeat(80));
    }
  }

  /**
   * 运行完整的性能测试套件
   */
  async runFullTestSuite(): Promise<void> {
    console.log('开始加密函数性能测试...');
    console.log('生成测试密钥对...');

    const testScenarios = [
      // 小数据测试 (多次迭代)
      { size: 1024, iterations: 100 }, // 1KB
      { size: 10 * 1024, iterations: 50 }, // 10KB
      { size: 100 * 1024, iterations: 20 }, // 100KB

      // 中等数据测试 (较少迭代)
      { size: 1024 * 1024, iterations: 10 }, // 1MB
      { size: 10 * 1024 * 1024, iterations: 5 }, // 10MB
      { size: 100 * 1024 * 1024, iterations: 2 }, // 100MB

      // 大数据测试 (单次迭代)
      { size: 500 * 1024 * 1024, iterations: 1 }, // 500MB
    ];

    const results = [];

    for (const scenario of testScenarios) {
      console.log(
        `\n测试数据大小: ${PerformanceTester.formatBytes(scenario.size)}, 迭代次数: ${scenario.iterations}`,
      );

      try {
        const result = await this.runTestScenario(scenario.size, scenario.iterations);
        results.push(result);

        // 对于大数据测试，添加进度提示
        if (scenario.size >= 100 * 1024 * 1024) {
          console.log(`  大数据测试完成: ${PerformanceTester.formatBytes(scenario.size)}`);
        }
      } catch (error) {
        console.error(`测试失败 (${PerformanceTester.formatBytes(scenario.size)}):`, error);
      }
    }

    this.printResults(results);
  }

  /**
   * 运行 500MB 大数据测试
   */
  async run500MBTest(): Promise<void> {
    console.log('开始 500MB 大数据测试...');

    const testData = PerformanceTester.generateTestData(500 * 1024 * 1024);

    // 测试异步加密 (更适合大数据)
    const asyncEncryptResult = await PerformanceTester.measureTime(async () => {
      return await encryptByPublicKeyAsync(testData, this.keyPair.public_key);
    });

    console.log(`500MB 异步加密时间: ${PerformanceTester.formatTime(asyncEncryptResult.time)}`);
    console.log(`加密后大小: ${PerformanceTester.formatBytes(asyncEncryptResult.result.length)}`);

    // 测试异步解密
    const asyncDecryptResult = await PerformanceTester.measureTime(async () => {
      return await decryptByPrivateKeyAsync(asyncEncryptResult.result, this.keyPair.private_key);
    });

    console.log(`500MB 异步解密时间: ${PerformanceTester.formatTime(asyncDecryptResult.time)}`);

    // 验证解密结果
    if (asyncDecryptResult.result.length === testData.length) {
      console.log('✓ 500MB 数据解密验证成功');
    } else {
      console.log('✗ 500MB 数据解密验证失败');
    }
  }
}

// 主函数
async function main() {
  const tester = new CryptoPerformanceTest();

  // 根据命令行参数决定运行哪些测试
  const args = process.argv.slice(2);

  if (args.includes('--500mb')) {
    await tester.run500MBTest();
  } else if (args.includes('--quick')) {
    // 快速测试 - 只测试小数据
    console.log('运行快速测试...');
    const quickScenarios = [
      { size: 1024, iterations: 10 },
      { size: 1024 * 1024, iterations: 5 },
    ];

    const results = [];
    for (const scenario of quickScenarios) {
      const result = await tester.runTestScenario(scenario.size, scenario.iterations);
      results.push(result);
    }
    tester.printResults(results);
  } else {
    // 完整测试套件
    await tester.runFullTestSuite();
  }
}

// 如果直接运行此文件，则执行测试
if (require.main === module) {
  main().catch(console.error);
}

export { CryptoPerformanceTest, PerformanceTester };
