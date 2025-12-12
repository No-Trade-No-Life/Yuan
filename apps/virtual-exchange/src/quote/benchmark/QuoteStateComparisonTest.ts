import { IQuoteState } from '../types';
import { PerformanceTester } from './PerformanceTester';
import { QuoteStateTestRunner } from './QuoteStateTestRunner';

/**
 * 行情状态对比测试类
 * 用于比较两个不同的 IQuoteState 实现
 */
export class QuoteStateComparisonTest {
  private runnerA: QuoteStateTestRunner;
  private runnerB: QuoteStateTestRunner;
  private nameA: string;
  private nameB: string;

  constructor(
    createStateA: () => IQuoteState,
    createStateB: () => IQuoteState,
    nameA: string = '实现A',
    nameB: string = '实现B',
  ) {
    this.runnerA = new QuoteStateTestRunner(createStateA);
    this.runnerB = new QuoteStateTestRunner(createStateB);
    this.nameA = nameA;
    this.nameB = nameB;
  }

  /**
   * 打印对比结果
   */
  private printComparisonResults(
    resultsA: any[],
    resultsB: any[],
    testType: string,
    key: string = 'time',
  ): void {
    console.log('\n' + '='.repeat(100));
    console.log(`行情状态性能对比测试 - ${testType}`);
    console.log('='.repeat(100));

    console.log(`\n${this.nameA} vs ${this.nameB} 性能对比:`);
    console.log('-'.repeat(80));

    for (let i = 0; i < Math.min(resultsA.length, resultsB.length); i++) {
      const resultA = resultsA[i];
      const resultB = resultsB[i];

      // 检查是否有失败的测试
      const isAFailed = resultA.success === false;
      const isBFailed = resultB.success === false;

      if (isAFailed || isBFailed) {
        console.log(`\n产品数量: ${resultA.productCount || resultB.productCount}`);

        if (isAFailed) {
          console.log(`❌ ${this.nameA} 测试失败: ${resultA.error || 'Unknown error'}`);
        } else {
          console.log(`${this.nameA}: ${PerformanceTester.formatTime(resultA.avgTime || resultA.time)}`);
        }

        if (isBFailed) {
          console.log(`❌ ${this.nameB} 测试失败: ${resultB.error || 'Unknown error'}`);
        } else {
          console.log(`${this.nameB}: ${PerformanceTester.formatTime(resultB.avgTime || resultB.time)}`);
        }

        console.log('-'.repeat(80));
        continue;
      }

      if (resultA.productCount !== resultB.productCount) {
        console.log(`\n⚠️ 产品数量不匹配: ${resultA.productCount} vs ${resultB.productCount}`);
        continue;
      }

      console.log(`\n产品数量: ${resultA.productCount.toLocaleString()}`);

      // 自动检测使用哪个时间字段
      const timeKey = resultA.avgTime !== undefined ? 'avgTime' : 'time';
      const valueA = resultA[timeKey];
      const valueB = resultB[timeKey];

      const timeLabel = timeKey === 'avgTime' ? '平均时间' : '时间';
      console.log(`${this.nameA} (${timeLabel}): ${PerformanceTester.formatTime(valueA)}`);
      console.log(`${this.nameB} (${timeLabel}): ${PerformanceTester.formatTime(valueB)}`);

      if (valueA > 0 && valueB > 0) {
        const ratio = valueA / valueB;
        const percentDiff = ((ratio - 1) * 100).toFixed(2);
        if (ratio > 1) {
          console.log(`${this.nameB} 快 ${percentDiff}% (${ratio.toFixed(2)}x)`);
        } else {
          console.log(
            `${this.nameA} 快 ${(-parseFloat(percentDiff)).toFixed(2)}% (${(1 / ratio).toFixed(2)}x)`,
          );
        }
      }

      // 处理新的内存数据结构（heapUsedDiff）和旧的数据结构（memoryBefore/memoryAfter）
      let memoryUsedA: number | null = null;
      let memoryUsedB: number | null = null;

      if (resultA.heapUsedDiff !== undefined && resultA.heapUsedDiff !== null) {
        memoryUsedA = resultA.heapUsedDiff;
      } else if (resultA.memoryBefore && resultA.memoryAfter) {
        memoryUsedA = resultA.memoryAfter.heapUsed - resultA.memoryBefore.heapUsed;
      }

      if (resultB.heapUsedDiff !== undefined && resultB.heapUsedDiff !== null) {
        memoryUsedB = resultB.heapUsedDiff;
      } else if (resultB.memoryBefore && resultB.memoryAfter) {
        memoryUsedB = resultB.memoryAfter.heapUsed - resultB.memoryBefore.heapUsed;
      }

      // 打印内存使用（即使只有一个实现有数据）
      const hasMemoryA = memoryUsedA !== null && !isNaN(memoryUsedA);
      const hasMemoryB = memoryUsedB !== null && !isNaN(memoryUsedB);

      if (hasMemoryA || hasMemoryB) {
        console.log(`\n内存使用:`);
        if (hasMemoryA) {
          console.log(`${this.nameA}: ${PerformanceTester.formatBytes(memoryUsedA!)}`);
        }
        if (hasMemoryB) {
          console.log(`${this.nameB}: ${PerformanceTester.formatBytes(memoryUsedB!)}`);
        }

        // 只有当两个实现都有有效内存数据时才进行对比
        if (hasMemoryA && hasMemoryB && memoryUsedA! > 0 && memoryUsedB! > 0) {
          const memoryRatio = memoryUsedA! / memoryUsedB!;
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

  /**
   * 运行完整的对比测试套件
   */
  async runComparisonTestSuite(): Promise<void> {
    console.log(`开始行情状态性能对比测试: ${this.nameA} vs ${this.nameB}`);

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
        // 使用3次迭代取平均值，减少随机性
        const resultA = await this.runnerA.runInitializationTest(scenario.productCount, 3);
        const resultB = await this.runnerB.runInitializationTest(scenario.productCount, 3);
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
        const resultA = await this.runnerA.runUpdateTest(scenario.productCount, scenario.updateIterations);
        const resultB = await this.runnerB.runUpdateTest(scenario.productCount, scenario.updateIterations);
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
        const resultA = await this.runnerA.runQueryTest(scenario.productCount, scenario.queryIterations);
        const resultB = await this.runnerB.runQueryTest(scenario.productCount, scenario.queryIterations);
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
        const resultA = await this.runnerA.runFilterTest(scenario.productCount, scenario.filterIterations);
        const resultB = await this.runnerB.runFilterTest(scenario.productCount, scenario.filterIterations);
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
        const resultA = await this.runnerA.runDumpTest(scenario.productCount);
        const resultB = await this.runnerB.runDumpTest(scenario.productCount);
        dumpResultsA.push(resultA);
        dumpResultsB.push(resultB);
      } catch (error) {
        console.error(`转储对比测试失败 (${scenario.label}):`, error);
      }
    }
    this.printComparisonResults(dumpResultsA, dumpResultsB, '转储测试');

    console.log('\n对比测试完成!');
  }

  /**
   * 运行快速对比测试（仅测试小数据量）
   */
  async runQuickComparisonTest(): Promise<void> {
    console.log(`开始快速对比测试: ${this.nameA} vs ${this.nameB}`);

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
        // 使用2次迭代取平均值（快速测试）
        const resultA = await this.runnerA.runInitializationTest(scenario.productCount, 2);
        const resultB = await this.runnerB.runInitializationTest(scenario.productCount, 2);
        initResultsA.push(resultA);
        initResultsB.push(resultB);
      } catch (error) {
        console.error(`初始化对比测试失败 (${scenario.label}):`, error);
      }
    }
    this.printComparisonResults(initResultsA, initResultsB, '快速初始化测试');

    console.log('\n快速对比测试完成!');
  }
}
