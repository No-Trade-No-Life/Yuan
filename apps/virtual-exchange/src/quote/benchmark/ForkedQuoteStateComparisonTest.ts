import { exec } from 'child_process';
import { promisify } from 'util';
import { QuoteStateComparisonTest } from './QuoteStateComparisonTest';
import { PerformanceTester } from './PerformanceTester';

const execAsync = promisify(exec);

/**
 * 使用子进程进行隔离内存测试的对比测试类
 * 每个实现都在独立的子进程中运行，确保内存测试的公平性
 */
export class ForkedQuoteStateComparisonTest {
  private nameA: string;
  private nameB: string;
  private workerScriptPath: string;

  constructor(
    nameA: string = 'Current',
    nameB: string = 'Baseline',
    workerScriptPath: string = __dirname + '/worker.ts',
  ) {
    this.nameA = nameA;
    this.nameB = nameB;
    this.workerScriptPath = workerScriptPath;
  }

  /**
   * 运行单个测试场景的子进程
   */
  private async runWorkerTest(
    implName: string,
    testType: string,
    productCount: number,
    extraArgs: Record<string, string> = {},
  ): Promise<any> {
    // 构建命令行参数
    const args = [`--impl=${implName}`, `--test=${testType}`, `--product-count=${productCount}`];

    // 添加额外参数
    for (const [key, value] of Object.entries(extraArgs)) {
      args.push(`--${key}=${value}`);
    }

    // 执行 worker 脚本，启用 GC 以进行公平的内存测试
    const command = `node --expose-gc $(which ts-node) ${this.workerScriptPath} ${args.join(' ')}`;

    try {
      const { stdout, stderr } = await execAsync(command);

      if (stderr && stderr.trim()) {
        console.error(`Worker stderr (${implName}, ${testType}, ${productCount}):`, stderr);
      }

      const result = JSON.parse(stdout.trim());

      if (!result.success) {
        // 子进程返回了失败结果
        return {
          success: false,
          error: result.error || 'Unknown error',
          impl: implName,
          test: testType,
          productCount,
          avgTime: null,
          time: null,
          heapUsedDiff: null,
        };
      }

      return result;
    } catch (error) {
      // 子进程执行失败（如 OOM killed、命令不存在等）
      console.error(`Worker execution failed (${implName}, ${testType}, ${productCount}):`, error);

      // 返回一个失败对象，而不是抛出错误
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        impl: implName,
        test: testType,
        productCount,
        avgTime: null,
        time: null,
        heapUsedDiff: null,
      };
    }
  }

  /**
   * 运行初始化测试对比
   */
  async runInitializationTestComparison(
    productCount: number,
    iterations: number = 3,
  ): Promise<{
    resultA: any;
    resultB: any;
  }> {
    console.log(`运行初始化对比测试: ${this.nameA} vs ${this.nameB} (${productCount} 产品)`);

    const resultA = await this.runWorkerTest('current', 'init', productCount, {
      iterations: iterations.toString(),
    });
    const resultB = await this.runWorkerTest('baseline', 'init', productCount, {
      iterations: iterations.toString(),
    });

    return { resultA, resultB };
  }

  /**
   * 运行更新测试对比
   */
  async runUpdateTestComparison(
    productCount: number,
    updateCount: number,
  ): Promise<{
    resultA: any;
    resultB: any;
  }> {
    console.log(
      `运行更新对比测试: ${this.nameA} vs ${this.nameB} (${productCount} 产品, ${updateCount} 更新)`,
    );

    const resultA = await this.runWorkerTest('current', 'update', productCount, {
      'update-count': updateCount.toString(),
    });
    const resultB = await this.runWorkerTest('baseline', 'update', productCount, {
      'update-count': updateCount.toString(),
    });

    return { resultA, resultB };
  }

  /**
   * 运行查询测试对比
   */
  async runQueryTestComparison(
    productCount: number,
    queryCount: number,
  ): Promise<{
    resultA: any;
    resultB: any;
  }> {
    console.log(
      `运行查询对比测试: ${this.nameA} vs ${this.nameB} (${productCount} 产品, ${queryCount} 查询)`,
    );

    const resultA = await this.runWorkerTest('current', 'query', productCount, {
      'query-count': queryCount.toString(),
    });
    const resultB = await this.runWorkerTest('baseline', 'query', productCount, {
      'query-count': queryCount.toString(),
    });

    return { resultA, resultB };
  }

  /**
   * 运行过滤测试对比
   */
  async runFilterTestComparison(
    productCount: number,
    filterCount: number,
  ): Promise<{
    resultA: any;
    resultB: any;
  }> {
    console.log(
      `运行过滤对比测试: ${this.nameA} vs ${this.nameB} (${productCount} 产品, ${filterCount} 过滤)`,
    );

    const resultA = await this.runWorkerTest('current', 'filter', productCount, {
      'filter-count': filterCount.toString(),
    });
    const resultB = await this.runWorkerTest('baseline', 'filter', productCount, {
      'filter-count': filterCount.toString(),
    });

    return { resultA, resultB };
  }

  /**
   * 运行转储测试对比
   */
  async runDumpTestComparison(productCount: number): Promise<{
    resultA: any;
    resultB: any;
  }> {
    console.log(`运行转储对比测试: ${this.nameA} vs ${this.nameB} (${productCount} 产品)`);

    const resultA = await this.runWorkerTest('current', 'dump', productCount);
    const resultB = await this.runWorkerTest('baseline', 'dump', productCount);

    return { resultA, resultB };
  }

  /**
   * 打印对比结果（复用现有的对比结果打印逻辑）
   */
  private printComparisonResults(resultsA: any[], resultsB: any[], testType: string): void {
    // 创建一个临时的 QuoteStateComparisonTest 实例来复用其打印逻辑
    const tempComparison = new QuoteStateComparisonTest(
      () => {
        throw new Error('Not implemented');
      },
      () => {
        throw new Error('Not implemented');
      },
      this.nameA,
      this.nameB,
    );

    // 使用私有方法，需要类型断言来访问
    const privateMethod = (tempComparison as any).printComparisonResults;
    if (typeof privateMethod === 'function') {
      privateMethod.call(tempComparison, resultsA, resultsB, testType);
    } else {
      // 如果无法访问私有方法，使用简化版本
      console.log(`\n${this.nameA} vs ${this.nameB} - ${testType} 对比结果:`);
      for (let i = 0; i < Math.min(resultsA.length, resultsB.length); i++) {
        const a = resultsA[i];
        const b = resultsB[i];

        // 检查是否有失败的测试
        const isAFailed = a.success === false;
        const isBFailed = b.success === false;

        if (isAFailed || isBFailed) {
          console.log(`\n产品数量: ${a.productCount || b.productCount}`);

          if (isAFailed) {
            console.log(`❌ ${this.nameA} 测试失败: ${a.error || 'Unknown error'}`);
          } else {
            console.log(`${this.nameA}: ${a.avgTime || a.time}ms`);
          }

          if (isBFailed) {
            console.log(`❌ ${this.nameB} 测试失败: ${b.error || 'Unknown error'}`);
          } else {
            console.log(`${this.nameB}: ${b.avgTime || b.time}ms`);
          }

          // 打印内存使用（即使只有一个实现有数据）
          const memoryUsedA = a.heapUsedDiff;
          const memoryUsedB = b.heapUsedDiff;
          const hasMemoryA = memoryUsedA !== undefined && memoryUsedA !== null && !isNaN(memoryUsedA);
          const hasMemoryB = memoryUsedB !== undefined && memoryUsedB !== null && !isNaN(memoryUsedB);

          if (hasMemoryA || hasMemoryB) {
            console.log(`\n内存使用:`);
            if (hasMemoryA) {
              console.log(`${this.nameA}: ${PerformanceTester.formatBytes(memoryUsedA)}`);
            }
            if (hasMemoryB) {
              console.log(`${this.nameB}: ${PerformanceTester.formatBytes(memoryUsedB)}`);
            }
          }

          console.log('-'.repeat(80));
          continue;
        }

        console.log(`产品数量 ${a.productCount}: ${a.avgTime || a.time}ms vs ${b.avgTime || b.time}ms`);

        // 打印内存使用（即使只有一个实现有数据）
        const memoryUsedA = a.heapUsedDiff;
        const memoryUsedB = b.heapUsedDiff;
        const hasMemoryA = memoryUsedA !== undefined && memoryUsedA !== null && !isNaN(memoryUsedA);
        const hasMemoryB = memoryUsedB !== undefined && memoryUsedB !== null && !isNaN(memoryUsedB);

        if (hasMemoryA || hasMemoryB) {
          console.log(`\n内存使用:`);
          if (hasMemoryA) {
            console.log(`${this.nameA}: ${PerformanceTester.formatBytes(memoryUsedA)}`);
          }
          if (hasMemoryB) {
            console.log(`${this.nameB}: ${PerformanceTester.formatBytes(memoryUsedB)}`);
          }

          // 只有当两个实现都有有效内存数据时才进行对比
          if (hasMemoryA && hasMemoryB && memoryUsedA > 0 && memoryUsedB > 0) {
            const memoryRatio = memoryUsedA / memoryUsedB;
            const memoryPercentDiff = ((memoryRatio - 1) * 100).toFixed(2);
            if (memoryRatio > 1) {
              console.log(`${this.nameB} 节省 ${memoryPercentDiff}% 内存`);
            } else {
              console.log(`${this.nameA} 节省 ${(-parseFloat(memoryPercentDiff)).toFixed(2)}% 内存`);
            }
          }
        }

        console.log('-'.repeat(80));
      }
    }
  }

  /**
   * 运行完整的对比测试套件
   */
  async runComparisonTestSuite(): Promise<void> {
    console.log(`开始子进程隔离内存对比测试: ${this.nameA} vs ${this.nameB}`);
    console.log('注意：每个测试都在独立的子进程中运行，确保内存测试的公平性');

    const testScenarios = [
      {
        productCount: 10000,
        label: '10K',
        updateIterations: 1000,
        queryIterations: 10000,
        filterIterations: 1000,
      },
      {
        productCount: 100000,
        label: '100K',
        updateIterations: 100,
        queryIterations: 1000,
        filterIterations: 100,
      },
      {
        productCount: 1000000,
        label: '1M',
        updateIterations: 10,
        queryIterations: 100,
        filterIterations: 10,
      },
    ];

    // 初始化测试对比
    console.log('\n运行初始化测试对比...');
    const initResultsA = [];
    const initResultsB = [];
    for (const scenario of testScenarios) {
      console.log(`测试 ${scenario.label} 产品...`);
      try {
        const { resultA, resultB } = await this.runInitializationTestComparison(scenario.productCount, 3);
        initResultsA.push(resultA);
        initResultsB.push(resultB);
      } catch (error) {
        console.error(`初始化对比测试失败 (${scenario.label}):`, error);
      }
    }
    this.printComparisonResults(initResultsA, initResultsB, '初始化测试');

    // 更新测试对比
    console.log('\n运行更新测试对比...');
    const updateResultsA = [];
    const updateResultsB = [];
    for (const scenario of testScenarios) {
      console.log(`测试 ${scenario.label} 产品...`);
      try {
        const { resultA, resultB } = await this.runUpdateTestComparison(
          scenario.productCount,
          scenario.updateIterations,
        );
        updateResultsA.push(resultA);
        updateResultsB.push(resultB);
      } catch (error) {
        console.error(`更新对比测试失败 (${scenario.label}):`, error);
      }
    }
    this.printComparisonResults(updateResultsA, updateResultsB, '更新测试');

    // 查询测试对比
    console.log('\n运行查询测试对比...');
    const queryResultsA = [];
    const queryResultsB = [];
    for (const scenario of testScenarios) {
      console.log(`测试 ${scenario.label} 产品...`);
      try {
        const { resultA, resultB } = await this.runQueryTestComparison(
          scenario.productCount,
          scenario.queryIterations,
        );
        queryResultsA.push(resultA);
        queryResultsB.push(resultB);
      } catch (error) {
        console.error(`查询对比测试失败 (${scenario.label}):`, error);
      }
    }
    this.printComparisonResults(queryResultsA, queryResultsB, '查询测试');

    // 过滤测试对比
    console.log('\n运行过滤测试对比...');
    const filterResultsA = [];
    const filterResultsB = [];
    for (const scenario of testScenarios) {
      console.log(`测试 ${scenario.label} 产品...`);
      try {
        const { resultA, resultB } = await this.runFilterTestComparison(
          scenario.productCount,
          scenario.filterIterations,
        );
        filterResultsA.push(resultA);
        filterResultsB.push(resultB);
      } catch (error) {
        console.error(`过滤对比测试失败 (${scenario.label}):`, error);
      }
    }
    this.printComparisonResults(filterResultsA, filterResultsB, '过滤测试');

    // 转储测试对比
    console.log('\n运行转储测试对比...');
    const dumpResultsA = [];
    const dumpResultsB = [];
    for (const scenario of testScenarios) {
      console.log(`测试 ${scenario.label} 产品...`);
      try {
        const { resultA, resultB } = await this.runDumpTestComparison(scenario.productCount);
        dumpResultsA.push(resultA);
        dumpResultsB.push(resultB);
      } catch (error) {
        console.error(`转储对比测试失败 (${scenario.label}):`, error);
      }
    }
    this.printComparisonResults(dumpResultsA, dumpResultsB, '转储测试');

    console.log('\n子进程隔离内存对比测试完成!');
  }

  /**
   * 运行快速对比测试（仅测试小数据量）
   */
  async runQuickComparisonTest(): Promise<void> {
    console.log(`开始快速子进程对比测试: ${this.nameA} vs ${this.nameB}`);

    const quickScenarios = [
      {
        productCount: 1000,
        label: '1K',
        updateIterations: 100,
        queryIterations: 1000,
        filterIterations: 100,
      },
      { productCount: 10000, label: '10K', updateIterations: 10, queryIterations: 100, filterIterations: 10 },
    ];

    // 初始化测试对比
    console.log('\n运行初始化测试对比...');
    const initResultsA = [];
    const initResultsB = [];
    for (const scenario of quickScenarios) {
      console.log(`测试 ${scenario.label} 产品...`);
      try {
        const { resultA, resultB } = await this.runInitializationTestComparison(scenario.productCount, 2);
        initResultsA.push(resultA);
        initResultsB.push(resultB);
      } catch (error) {
        console.error(`初始化对比测试失败 (${scenario.label}):`, error);
      }
    }
    this.printComparisonResults(initResultsA, initResultsB, '快速初始化测试');

    console.log('\n快速子进程对比测试完成!');
  }
}
