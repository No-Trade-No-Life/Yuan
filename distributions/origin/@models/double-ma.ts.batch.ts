import { ChinaFutureOHLCKeys } from '@libs';

// 2MA 的批量回测配置
// 需要在模块中 default 导出一个函数，该函数返回一个可迭代的配置 (数组, 生成函数, 异步生成函数均可，推荐使用生成函数)
export default function* () {
  for (const SomeKey of ChinaFutureOHLCKeys) {
    yield {
      // kernel_id 用以区分不同的回测结果
      kernel_id: `Model-2MA-${SomeKey}`,
      // 模型代码入口
      entry: '/@models/double-ma.ts',
      // 模型参数
      agent_params: {
        SomeKey,
      },
    };
  }
}
