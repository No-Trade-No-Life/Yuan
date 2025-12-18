import { implementations } from '../implementations';
import { IQuoteKey, IQuoteUpdateAction } from '../types';

// 测试所有实现的通用测试套件
describe('IQuoteState implementations', () => {
  // 测试每个实现
  Object.entries(implementations).forEach(([name, createQuoteState]) => {
    describe(`${name} implementation`, () => {
      let quoteState: ReturnType<typeof createQuoteState>;

      beforeEach(() => {
        quoteState = createQuoteState();
      });

      // 测试 1: 初始状态应该是空的
      it('should have empty initial state', () => {
        const dumped = quoteState.dumpAsObject();
        expect(dumped).toEqual({});
      });

      // 测试 2: 更新单个产品的单个字段
      it('should update single field for single product', () => {
        const updateAction: IQuoteUpdateAction = {
          product_001: {
            last_price: ['100.5', 1000],
          },
        };

        quoteState.update(updateAction);

        // 验证通过 getValueTuple 获取
        const tuple = quoteState.getValueTuple('product_001', 'last_price');
        expect(tuple).toEqual(['100.5', 1000]);

        // 验证 dumpAsObject
        const dumped = quoteState.dumpAsObject();
        expect(dumped).toEqual(updateAction);
      });

      // 测试 3: 更新多个产品和多个字段
      it('should update multiple fields for multiple products', () => {
        const updateAction: IQuoteUpdateAction = {
          product_001: {
            last_price: ['100.5', 1000],
            ask_price: ['101.0', 1001],
          },
          product_002: {
            bid_price: ['99.0', 1002],
            ask_volume: ['500', 1003],
          },
        };

        quoteState.update(updateAction);

        // 验证所有字段
        expect(quoteState.getValueTuple('product_001', 'last_price')).toEqual(['100.5', 1000]);
        expect(quoteState.getValueTuple('product_001', 'ask_price')).toEqual(['101.0', 1001]);
        expect(quoteState.getValueTuple('product_002', 'bid_price')).toEqual(['99.0', 1002]);
        expect(quoteState.getValueTuple('product_002', 'ask_volume')).toEqual(['500', 1003]);

        // 验证 dumpAsObject
        const dumped = quoteState.dumpAsObject();
        expect(dumped).toEqual(updateAction);
      });

      // 测试 4: 更新应该覆盖旧的时间戳，但忽略更旧的时间戳
      it('should overwrite with newer timestamp, ignore older timestamp', () => {
        // 初始更新
        quoteState.update({
          product_001: {
            last_price: ['100.0', 1000],
          },
        });

        // 用更新的时间戳覆盖
        quoteState.update({
          product_001: {
            last_price: ['200.0', 2000],
          },
        });

        expect(quoteState.getValueTuple('product_001', 'last_price')).toEqual(['200.0', 2000]);

        // 用更旧的时间戳尝试覆盖（应该被忽略）
        quoteState.update({
          product_001: {
            last_price: ['300.0', 1500], // 时间戳 1500 比 2000 旧
          },
        });

        // 应该仍然是旧的值
        expect(quoteState.getValueTuple('product_001', 'last_price')).toEqual(['200.0', 2000]);
      });

      // 测试 5: 获取不存在的产品或字段应该返回 undefined
      it('should return undefined for non-existent product or field', () => {
        expect(quoteState.getValueTuple('non_existent', 'last_price')).toBeUndefined();

        // 添加一个产品但不包含该字段
        quoteState.update({
          product_001: {
            ask_price: ['101.0', 1000],
          },
        });

        expect(quoteState.getValueTuple('product_001', 'last_price')).toBeUndefined();
        expect(quoteState.getValueTuple('product_002', 'last_price')).toBeUndefined();
      });

      // 测试 6: filter 方法应该返回符合条件的数据
      it('should filter data by product_ids, fields, and updated_at', () => {
        // 设置测试数据
        quoteState.update({
          product_001: {
            last_price: ['100.0', 1000],
            ask_price: ['101.0', 2000], // 较新的时间戳
            bid_price: ['99.0', 500], // 较旧的时间戳
          },
          product_002: {
            last_price: ['200.0', 1500],
            ask_price: ['201.0', 2500],
          },
          product_003: {
            last_price: ['300.0', 1200],
          },
        });

        // 测试 1: 过滤特定产品和字段，时间阈值 1000
        const result1 = quoteState.filter(['product_001', 'product_002'], ['last_price', 'ask_price'], 1000);

        expect(result1).toEqual({
          product_001: {
            last_price: ['100.0', 1000],
            ask_price: ['101.0', 2000],
          },
          product_002: {
            last_price: ['200.0', 1500],
            ask_price: ['201.0', 2500],
          },
        });

        // 测试 2: 过滤时间阈值 1500（排除较旧的数据）
        const result2 = quoteState.filter(
          ['product_001', 'product_002', 'product_003'],
          ['last_price', 'bid_price'],
          1500,
        );

        expect(result2).toEqual({
          product_001: {
            // last_price 时间戳 1000 < 1500，应该被排除
            // bid_price 时间戳 500 < 1500，应该被排除
          },
          product_002: {
            last_price: ['200.0', 1500],
          },
          product_003: {
            // last_price 时间戳 1200 < 1500，应该被排除
          },
        });

        // 测试 3: 过滤不存在的产品应该返回空对象
        const result3 = quoteState.filter(['non_existent'], ['last_price'], 0);

        expect(result3).toEqual({
          non_existent: {},
        });
      });

      // 测试 7: 空更新不应该改变状态
      it('should handle empty update action', () => {
        // 先添加一些数据
        quoteState.update({
          product_001: {
            last_price: ['100.0', 1000],
          },
        });

        const beforeDump = quoteState.dumpAsObject();

        // 空更新
        quoteState.update({});

        const afterDump = quoteState.dumpAsObject();
        expect(afterDump).toEqual(beforeDump);
      });

      // 测试 8: 更新时只提供部分字段，不应影响其他字段
      it('should not affect other fields when updating partial fields', () => {
        // 初始设置两个字段
        quoteState.update({
          product_001: {
            last_price: ['100.0', 1000],
            ask_price: ['101.0', 1001],
          },
        });

        // 只更新一个字段
        quoteState.update({
          product_001: {
            last_price: ['200.0', 2000],
          },
        });

        // last_price 应该更新，ask_price 应该保持不变
        expect(quoteState.getValueTuple('product_001', 'last_price')).toEqual(['200.0', 2000]);
        expect(quoteState.getValueTuple('product_001', 'ask_price')).toEqual(['101.0', 1001]);
      });

      // 测试 9: 重复的更新应该保持幂等性
      it('should be idempotent for duplicate updates', () => {
        const updateAction: IQuoteUpdateAction = {
          product_001: {
            last_price: ['100.0', 1000],
          },
        };

        // 多次执行相同的更新
        quoteState.update(updateAction);
        quoteState.update(updateAction);
        quoteState.update(updateAction);

        // 状态应该与单次更新相同
        expect(quoteState.dumpAsObject()).toEqual(updateAction);
      });

      // 测试 10: 字段名称应该是 IQuoteKey 类型
      it('should handle all IQuoteKey field types', () => {
        const allFields: IQuoteKey[] = [
          'last_price',
          'ask_price',
          'ask_volume',
          'bid_volume',
          'bid_price',
          'interest_rate_short',
          'open_interest',
          'interest_rate_prev_settled_at',
          'interest_rate_next_settled_at',
          'interest_rate_long',
        ];

        const updateAction: IQuoteUpdateAction = {
          product_001: {},
        };

        // 为每个字段设置值
        allFields.forEach((field, index) => {
          updateAction['product_001'][field] = [`value_${index}`, 1000 + index];
        });

        quoteState.update(updateAction);

        // 验证每个字段
        allFields.forEach((field, index) => {
          expect(quoteState.getValueTuple('product_001', field)).toEqual([`value_${index}`, 1000 + index]);
        });

        // 验证 dumpAsObject
        const dumped = quoteState.dumpAsObject();
        expect(dumped).toEqual(updateAction);
      });

      // 测试 11: filterValues 方法应该返回值（即使字段不存在）
      it('should return values via filterValues (even if field missing)', () => {
        // 设置测试数据
        quoteState.update({
          product_001: {
            last_price: ['100.0', 1000],
            ask_price: ['101.0', 2000],
            // bid_price not set
          },
          product_002: {
            last_price: ['200.0', 1500],
          },
        });

        // 测试 1: 获取存在的字段
        const result1 = quoteState.filterValues(['product_001', 'product_002'], ['last_price', 'ask_price']);
        expect(result1).toEqual({
          product_001: {
            last_price: '100.0',
            ask_price: '101.0',
          },
          product_002: {
            last_price: '200.0',
            ask_price: '',
          },
        });

        // 测试 2: 获取不存在的产品和字段
        const result2 = quoteState.filterValues(['product_001', 'non_existent'], ['last_price', 'bid_price']);
        expect(result2).toEqual({
          product_001: {
            last_price: '100.0',
            bid_price: '',
          },
          non_existent: {
            last_price: '',
            bid_price: '',
          },
        });

        // 测试 3: 空产品列表
        const result3 = quoteState.filterValues([], ['last_price']);
        expect(result3).toEqual({});

        // 测试 4: 空字段列表
        const result4 = quoteState.filterValues(['product_001'], []);
        expect(result4).toEqual({
          product_001: {},
        });

        // 测试 5: 所有字段类型
        const allFields: IQuoteKey[] = [
          'last_price',
          'ask_price',
          'ask_volume',
          'bid_volume',
          'bid_price',
          'interest_rate_short',
          'open_interest',
          'interest_rate_prev_settled_at',
          'interest_rate_next_settled_at',
          'interest_rate_long',
        ];
        const result5 = quoteState.filterValues(['product_001'], allFields);
        expect(Object.keys(result5.product_001)).toEqual(allFields);
        expect(result5.product_001.last_price).toBe('100.0');
        expect(result5.product_001.ask_price).toBe('101.0');
        // 其他字段应为空字符串
        expect(result5.product_001.bid_price).toBe('');
        expect(result5.product_001.ask_volume).toBe('');
      });
    });
  });
});
