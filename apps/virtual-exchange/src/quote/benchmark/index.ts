#!/usr/bin/env node

import { ForkedQuoteStateComparisonTest } from './ForkedQuoteStateComparisonTest';

// 导出性能测试工具类
export { PerformanceTester } from './PerformanceTester';

// 导出测试辅助函数
export { generateProductId, generateTestData, getAllFields, randomString } from './test-helpers';

// 导出测试运行器类
export { ForkedQuoteStateComparisonTest } from './ForkedQuoteStateComparisonTest';
export { QuoteStateComparisonTest } from './QuoteStateComparisonTest';
export { QuoteStateTestRunner } from './QuoteStateTestRunner';

/**
 * 主函数 - 命令行入口点
 * 仅支持 --fork-compare 和 --fork-compare --quick 模式
 */
async function main() {
  const args = process.argv.slice(2);

  // 检查是否使用正确的模式
  if (!args.includes('--fork-compare')) {
    console.log('使用方法:');
    console.log('  --fork-compare         运行完整的子进程隔离内存对比测试');
    console.log('  --fork-compare --quick 运行快速的子进程隔离内存对比测试');
    console.log('');
    console.log('注意：每个实现都在独立的子进程中运行，确保内存测试的公平性');
    return;
  }

  // 子进程隔离内存对比测试模式
  console.log('运行子进程隔离内存对比测试模式...');
  console.log('注意：每个实现都在独立的子进程中运行，确保内存测试的公平性');

  const forkedComparisonTest = new ForkedQuoteStateComparisonTest('Current', 'Baseline');

  if (args.includes('--quick')) {
    await forkedComparisonTest.runQuickComparisonTest();
  } else {
    await forkedComparisonTest.runComparisonTestSuite();
  }
}

// 如果直接运行此文件，则执行测试
if (require.main === module) {
  main().catch(console.error);
}

// 导出主函数以供程序化使用
export { main as runBenchmark };
