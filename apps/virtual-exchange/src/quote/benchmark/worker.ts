#!/usr/bin/env node

import { performance } from 'perf_hooks';
import { implementations } from '../implementations';
import { IQuoteKey, IQuoteState } from '../types';
import { PerformanceTester } from './PerformanceTester';
import { generateProductId, generateTestData, getAllFields } from './test-helpers';

/**
 * 子进程测试 Worker
 * 接收命令行参数，运行指定的测试，输出 JSON 结果到 stdout
 *
 * 命令行参数格式：
 * --impl=<implName>    // 实现名称：current 或 baseline
 * --test=<testType>    // 测试类型：init, update, query, filter, dump
 * --product-count=<N>  // 产品数量
 * --iterations=<N>     // 迭代次数（可选，某些测试需要）
 * --update-count=<N>   // 更新次数（update测试需要）
 * --query-count=<N>    // 查询次数（query测试需要）
 * --filter-count=<N>   // 过滤次数（filter测试需要）
 */

// 解析命令行参数
function parseArgs(): Record<string, string> {
  const args = process.argv.slice(2);
  const result: Record<string, string> = {};

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      result[key] = value || 'true';
    }
  }

  return result;
}

// 运行初始化测试
async function runInitializationTest(
  createState: () => IQuoteState,
  productCount: number,
  iterations: number = 1,
) {
  const fields = getAllFields();
  const testData = generateTestData(productCount, fields);

  const times: number[] = [];
  let finalResult: IQuoteState | undefined;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const state = createState();
    state.update(testData);
    const end = performance.now();

    if (i === 0) finalResult = state;
    times.push(end - start);
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  // 单独测量内存使用
  const memoryResult = await PerformanceTester.measureMemoryUsage(() => {
    const state = createState();
    state.update(testData);
    return state;
  });

  return {
    productCount,
    avgTime,
    minTime,
    maxTime,
    times,
    heapUsedDiff: memoryResult.heapUsedDiff,
  };
}

// 运行更新测试
async function runUpdateTest(createState: () => IQuoteState, productCount: number, updateCount: number) {
  const fields = getAllFields();
  const state = createState();
  const initialData = generateTestData(productCount, fields);
  state.update(initialData);

  // 生成随机更新
  const updates: Record<string, Partial<Record<IQuoteKey, [string, number]>>>[] = [];
  for (let i = 0; i < updateCount; i++) {
    const update: Record<string, Partial<Record<IQuoteKey, [string, number]>>> = {};
    const productIndex = Math.floor(Math.random() * productCount);
    const productId = generateProductId(productIndex);
    const fieldIndex = Math.floor(Math.random() * fields.length);
    const field = fields[fieldIndex];

    update[productId] = {
      [field]: [(Math.random() * 1000).toFixed(4), Date.now()],
    };
    updates.push(update);
  }

  const start = performance.now();
  for (const update of updates) {
    state.update(update);
  }
  const end = performance.now();

  return {
    productCount,
    updateCount,
    time: end - start,
  };
}

// 运行查询测试
async function runQueryTest(createState: () => IQuoteState, productCount: number, queryCount: number) {
  const fields = getAllFields();
  const state = createState();
  const initialData = generateTestData(productCount, fields);
  state.update(initialData);

  const start = performance.now();
  for (let i = 0; i < queryCount; i++) {
    const productIndex = Math.floor(Math.random() * productCount);
    const productId = generateProductId(productIndex);
    const fieldIndex = Math.floor(Math.random() * fields.length);
    const field = fields[fieldIndex];

    state.getValueTuple(productId, field);
  }
  const end = performance.now();

  return {
    productCount,
    queryCount,
    time: end - start,
  };
}

// 运行过滤测试
async function runFilterTest(createState: () => IQuoteState, productCount: number, filterCount: number) {
  const fields = getAllFields();
  const state = createState();
  const initialData = generateTestData(productCount, fields);
  state.update(initialData);

  // 生成随机过滤条件
  const filters: { productIds: string[]; fields: IQuoteKey[]; updatedAt: number }[] = [];
  for (let i = 0; i < filterCount; i++) {
    const productIdsCount = Math.min(10, Math.max(1, Math.floor(Math.random() * productCount)));
    const productIds: string[] = [];
    for (let j = 0; j < productIdsCount; j++) {
      const productIndex = Math.floor(Math.random() * productCount);
      productIds.push(generateProductId(productIndex));
    }

    const fieldsCount = Math.min(5, Math.max(1, Math.floor(Math.random() * fields.length)));
    const selectedFields: IQuoteKey[] = [];
    for (let j = 0; j < fieldsCount; j++) {
      const fieldIndex = Math.floor(Math.random() * fields.length);
      selectedFields.push(fields[fieldIndex]);
    }

    filters.push({
      productIds,
      fields: selectedFields,
      updatedAt: Date.now() - Math.random() * 1000000,
    });
  }

  const start = performance.now();
  for (const filter of filters) {
    state.filter(filter.productIds, filter.fields, filter.updatedAt);
  }
  const end = performance.now();

  return {
    productCount,
    filterCount,
    time: end - start,
  };
}

// 运行转储测试
async function runDumpTest(createState: () => IQuoteState, productCount: number) {
  const fields = getAllFields();
  const state = createState();
  const initialData = generateTestData(productCount, fields);
  state.update(initialData);

  const start = performance.now();
  state.dumpAsObject();
  const end = performance.now();

  return {
    productCount,
    time: end - start,
  };
}

// 主函数
async function main() {
  const args = parseArgs();

  // 验证必要参数
  if (!args.impl) {
    console.error(JSON.stringify({ error: 'Missing required parameter: --impl' }));
    process.exit(1);
  }

  if (!args.test) {
    console.error(JSON.stringify({ error: 'Missing required parameter: --test' }));
    process.exit(1);
  }

  if (!args['product-count']) {
    console.error(JSON.stringify({ error: 'Missing required parameter: --product-count' }));
    process.exit(1);
  }

  const implName = args.impl;
  const testType = args.test;
  const productCount = parseInt(args['product-count'], 10);

  // 选择实现
  let createState: () => IQuoteState;
  if (implName === 'current') {
    createState = implementations.current;
  } else if (implName === 'baseline') {
    createState = implementations.baseline;
  } else {
    console.error(JSON.stringify({ error: `Unknown implementation: ${implName}` }));
    process.exit(1);
  }

  try {
    let result: any;

    switch (testType) {
      case 'init':
        const iterations = args.iterations ? parseInt(args.iterations, 10) : 1;
        result = await runInitializationTest(createState, productCount, iterations);
        break;

      case 'update':
        if (!args['update-count']) {
          console.error(
            JSON.stringify({ error: 'Missing required parameter: --update-count for update test' }),
          );
          process.exit(1);
        }
        const updateCount = parseInt(args['update-count'], 10);
        result = await runUpdateTest(createState, productCount, updateCount);
        break;

      case 'query':
        if (!args['query-count']) {
          console.error(
            JSON.stringify({ error: 'Missing required parameter: --query-count for query test' }),
          );
          process.exit(1);
        }
        const queryCount = parseInt(args['query-count'], 10);
        result = await runQueryTest(createState, productCount, queryCount);
        break;

      case 'filter':
        if (!args['filter-count']) {
          console.error(
            JSON.stringify({ error: 'Missing required parameter: --filter-count for filter test' }),
          );
          process.exit(1);
        }
        const filterCount = parseInt(args['filter-count'], 10);
        result = await runFilterTest(createState, productCount, filterCount);
        break;

      case 'dump':
        result = await runDumpTest(createState, productCount);
        break;

      default:
        console.error(JSON.stringify({ error: `Unknown test type: ${testType}` }));
        process.exit(1);
    }

    // 输出 JSON 结果
    const output = {
      success: true,
      impl: implName,
      test: testType,
      productCount,
      ...result,
      timestamp: Date.now(),
    };

    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    console.error(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        impl: implName,
        test: testType,
        productCount,
        timestamp: Date.now(),
      }),
    );
    process.exit(1);
  }
}

// 如果直接运行此文件，则执行测试
if (require.main === module) {
  main().catch((error) => {
    console.error(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      }),
    );
    process.exit(1);
  });
}

export {};
