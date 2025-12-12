import { IQuoteKey, IQuoteState, IQuoteUpdateAction } from '../types';
import { PerformanceTester } from './PerformanceTester';
import { generateTestData, generateProductId, getAllFields } from './test-helpers';

/**
 * 通用的行情状态测试运行器
 * 接受一个工厂函数，用于创建 IQuoteState 实例
 */
export class QuoteStateTestRunner {
  private fields: IQuoteKey[];
  private createState: () => IQuoteState;

  constructor(createState: () => IQuoteState) {
    this.createState = createState;
    this.fields = getAllFields();
  }

  /**
   * 运行初始化性能测试
   */
  async runInitializationTest(
    productCount: number,
    iterations: number = 1,
  ): Promise<{
    productCount: number;
    avgTime: number;
    minTime: number;
    maxTime: number;
    times: number[];
    heapUsedDiff: number | null;
  }> {
    const testData = generateTestData(productCount, this.fields);

    // 使用多次测量取平均值，减少随机性
    const stats = await PerformanceTester.measureTimeWithStats(() => {
      const state = this.createState();
      state.update(testData);
      return state;
    }, iterations);

    // 单独测量内存使用（使用更精确的方法）
    const memoryResult = await PerformanceTester.measureMemoryUsage(() => {
      const state = this.createState();
      state.update(testData);
      return state;
    });

    return {
      productCount,
      avgTime: stats.avgTime,
      minTime: stats.minTime,
      maxTime: stats.maxTime,
      times: stats.times,
      heapUsedDiff: memoryResult.heapUsedDiff,
    };
  }

  /**
   * 运行更新性能测试
   */
  async runUpdateTest(
    productCount: number,
    updateCount: number,
  ): Promise<{
    productCount: number;
    updateCount: number;
    time: number;
  }> {
    // 创建初始状态
    const state = this.createState();
    const initialData = generateTestData(productCount, this.fields);
    state.update(initialData);

    // 生成随机更新
    const updates: IQuoteUpdateAction[] = [];
    for (let i = 0; i < updateCount; i++) {
      const update: IQuoteUpdateAction = {};
      // 随机选择一些产品和字段进行更新
      const productIndex = Math.floor(Math.random() * productCount);
      const productId = generateProductId(productIndex);
      const fieldIndex = Math.floor(Math.random() * this.fields.length);
      const field = this.fields[fieldIndex];

      update[productId] = {
        [field]: [(Math.random() * 1000).toFixed(4), Date.now()],
      };
      updates.push(update);
    }

    const result = await PerformanceTester.measureTime(() => {
      for (const update of updates) {
        state.update(update);
      }
    });

    return {
      productCount,
      updateCount,
      time: result.time,
    };
  }

  /**
   * 运行查询性能测试
   */
  async runQueryTest(
    productCount: number,
    queryCount: number,
  ): Promise<{
    productCount: number;
    queryCount: number;
    time: number;
  }> {
    // 创建初始状态
    const state = this.createState();
    const initialData = generateTestData(productCount, this.fields);
    state.update(initialData);

    const result = await PerformanceTester.measureTime(() => {
      for (let i = 0; i < queryCount; i++) {
        const productIndex = Math.floor(Math.random() * productCount);
        const productId = generateProductId(productIndex);
        const fieldIndex = Math.floor(Math.random() * this.fields.length);
        const field = this.fields[fieldIndex];

        state.getValueTuple(productId, field);
      }
    });

    return {
      productCount,
      queryCount,
      time: result.time,
    };
  }

  /**
   * 运行过滤性能测试
   */
  async runFilterTest(
    productCount: number,
    filterCount: number,
  ): Promise<{
    productCount: number;
    filterCount: number;
    time: number;
  }> {
    // 创建初始状态
    const state = this.createState();
    const initialData = generateTestData(productCount, this.fields);
    state.update(initialData);

    // 生成随机过滤条件
    const filters: { productIds: string[]; fields: IQuoteKey[]; updatedAt: number }[] = [];
    for (let i = 0; i < filterCount; i++) {
      // 随机选择1-10个产品
      const productIdsCount = Math.min(10, Math.max(1, Math.floor(Math.random() * productCount)));
      const productIds: string[] = [];
      for (let j = 0; j < productIdsCount; j++) {
        const productIndex = Math.floor(Math.random() * productCount);
        productIds.push(generateProductId(productIndex));
      }

      // 随机选择1-5个字段
      const fieldsCount = Math.min(5, Math.max(1, Math.floor(Math.random() * this.fields.length)));
      const fields: IQuoteKey[] = [];
      for (let j = 0; j < fieldsCount; j++) {
        const fieldIndex = Math.floor(Math.random() * this.fields.length);
        fields.push(this.fields[fieldIndex]);
      }

      filters.push({
        productIds,
        fields,
        updatedAt: Date.now() - Math.random() * 1000000,
      });
    }

    const result = await PerformanceTester.measureTime(() => {
      for (const filter of filters) {
        state.filter(filter.productIds, filter.fields, filter.updatedAt);
      }
    });

    return {
      productCount,
      filterCount,
      time: result.time,
    };
  }

  /**
   * 运行转储性能测试
   */
  async runDumpTest(productCount: number): Promise<{
    productCount: number;
    time: number;
  }> {
    // 创建初始状态
    const state = this.createState();
    const initialData = generateTestData(productCount, this.fields);
    state.update(initialData);

    const result = await PerformanceTester.measureTime(() => {
      state.dumpAsObject();
    });

    return {
      productCount,
      time: result.time,
    };
  }

  /**
   * 打印测试结果
   */
  printResults(results: any[], testType: string, implName?: string): void {
    const nameSuffix = implName ? ` - ${implName}` : '';
    console.log('\n' + '='.repeat(100));
    console.log(`行情状态性能测试 - ${testType}${nameSuffix}`);
    console.log('='.repeat(100));

    for (const result of results) {
      console.log(`\n产品数量: ${result.productCount.toLocaleString()}`);

      // 处理新的数据结构（avgTime）和旧的数据结构（time）
      const displayTime = result.avgTime !== undefined ? result.avgTime : result.time;
      const timeLabel = result.avgTime !== undefined ? '平均测试时间' : '测试时间';

      console.log(`${timeLabel}: ${PerformanceTester.formatTime(displayTime)}`);

      // 如果有多重测量结果，显示范围
      if (result.minTime !== undefined && result.maxTime !== undefined) {
        console.log(
          `时间范围: ${PerformanceTester.formatTime(result.minTime)} - ${PerformanceTester.formatTime(
            result.maxTime,
          )}`,
        );
      }

      if (result.updateCount) {
        console.log(`更新次数: ${result.updateCount.toLocaleString()}`);
        console.log(`每次更新平均时间: ${PerformanceTester.formatTime(displayTime / result.updateCount)}`);
      }

      if (result.queryCount) {
        console.log(`查询次数: ${result.queryCount.toLocaleString()}`);
        console.log(`每次查询平均时间: ${PerformanceTester.formatTime(displayTime / result.queryCount)}`);
      }

      if (result.filterCount) {
        console.log(`过滤次数: ${result.filterCount.toLocaleString()}`);
        console.log(`每次过滤平均时间: ${PerformanceTester.formatTime(displayTime / result.filterCount)}`);
      }

      // 处理新的内存数据结构（heapUsedDiff）和旧的数据结构（memoryBefore/memoryAfter）
      if (result.heapUsedDiff !== undefined && result.heapUsedDiff !== null) {
        const memoryUsed = result.heapUsedDiff;
        if (isNaN(memoryUsed)) {
          console.log(`内存计算错误: heapUsedDiff=${result.heapUsedDiff}`);
        } else {
          console.log(`内存使用: ${PerformanceTester.formatBytes(memoryUsed)}`);
          console.log(`每个产品内存使用: ${PerformanceTester.formatBytes(memoryUsed / result.productCount)}`);
        }
      } else if (
        result.memoryBefore &&
        result.memoryAfter &&
        result.memoryBefore.heapUsed !== undefined &&
        result.memoryAfter.heapUsed !== undefined
      ) {
        const memoryUsed = result.memoryAfter.heapUsed - result.memoryBefore.heapUsed;
        if (isNaN(memoryUsed)) {
          console.log(
            `内存计算错误: memoryBefore.heapUsed=${result.memoryBefore.heapUsed}, memoryAfter.heapUsed=${result.memoryAfter.heapUsed}`,
          );
        } else {
          console.log(`内存使用: ${PerformanceTester.formatBytes(memoryUsed)}`);
          console.log(`每个产品内存使用: ${PerformanceTester.formatBytes(memoryUsed / result.productCount)}`);
        }
      } else if (result.memoryBefore || result.memoryAfter) {
        console.log(
          `内存数据不完整: memoryBefore=${!!result.memoryBefore}, memoryAfter=${!!result.memoryAfter}`,
        );
      }

      console.log('-'.repeat(80));
    }
  }

  /**
   * 运行完整性能测试套件
   */
  async runFullTestSuite(implName?: string): Promise<void> {
    console.log(`开始行情状态性能测试${implName ? ' - ' + implName : ''}...`);

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

    // 初始化测试
    console.log('\n运行初始化测试...');
    const initResults = [];
    for (const scenario of testScenarios) {
      console.log(`测试 ${scenario.label} 产品...`);
      try {
        const result = await this.runInitializationTest(scenario.productCount, 3);
        initResults.push(result);
      } catch (error) {
        console.error(`初始化测试失败 (${scenario.label}):`, error);
      }
    }
    this.printResults(initResults, '初始化测试', implName);

    // 更新测试
    console.log('\n运行更新测试...');
    const updateResults = [];
    for (const scenario of testScenarios) {
      console.log(`测试 ${scenario.label} 产品...`);
      try {
        const result = await this.runUpdateTest(scenario.productCount, scenario.updateIterations);
        updateResults.push(result);
      } catch (error) {
        console.error(`更新测试失败 (${scenario.label}):`, error);
      }
    }
    this.printResults(updateResults, '更新测试', implName);

    // 查询测试
    console.log('\n运行查询测试...');
    const queryResults = [];
    for (const scenario of testScenarios) {
      console.log(`测试 ${scenario.label} 产品...`);
      try {
        const result = await this.runQueryTest(scenario.productCount, scenario.queryIterations);
        queryResults.push(result);
      } catch (error) {
        console.error(`查询测试失败 (${scenario.label}):`, error);
      }
    }
    this.printResults(queryResults, '查询测试', implName);

    // 过滤测试
    console.log('\n运行过滤测试...');
    const filterResults = [];
    for (const scenario of testScenarios) {
      console.log(`测试 ${scenario.label} 产品...`);
      try {
        const result = await this.runFilterTest(scenario.productCount, scenario.filterIterations);
        filterResults.push(result);
      } catch (error) {
        console.error(`过滤测试失败 (${scenario.label}):`, error);
      }
    }
    this.printResults(filterResults, '过滤测试', implName);

    // 转储测试
    console.log('\n运行转储测试...');
    const dumpResults = [];
    for (const scenario of testScenarios) {
      console.log(`测试 ${scenario.label} 产品...`);
      try {
        const result = await this.runDumpTest(scenario.productCount);
        dumpResults.push(result);
      } catch (error) {
        console.error(`转储测试失败 (${scenario.label}):`, error);
      }
    }
    this.printResults(dumpResults, '转储测试', implName);

    console.log('\n性能测试完成!');
  }
}
