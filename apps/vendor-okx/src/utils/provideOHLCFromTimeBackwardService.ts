import { IOHLC, provideOHLCDurationService } from '@yuants/data-ohlc';
import { IServiceOptions, Terminal } from '@yuants/protocol';
import { provideSeriesFromTimeBackwardService } from './provideSeriesFromTimeBackwardService';
import { convertDurationToOffset, decodePath } from '@yuants/utils';

/**
 * Provide OHLC from time backward service
 *
 * 提供 K线数据 按时间向后查询服务
 *
 * @public
 */
export const provideOHLCFromTimeBackwardService = (ctx: {
  terminal: Terminal;
  datasource_id: string;
  supported_durations: string[];
  queryFn: (ctx: {
    series_id: string;
    datasource_id: string;
    product_id: string;
    duration: string;
    offset: number;
    time: string;
  }) => Promise<IOHLC[]>;
  serviceOptions: IServiceOptions;
}) => {
  const supportedDurations = new Set(ctx.supported_durations);

  provideOHLCDurationService(ctx.terminal, ctx.datasource_id, () => ctx.supported_durations);

  provideSeriesFromTimeBackwardService<IOHLC>({
    terminal: ctx.terminal,
    type: 'ohlc',
    series_id_prefix_parts: [ctx.datasource_id],
    queryFn: async ({ series_id, time }) => {
      // series_id 格式: OKX/{product_id}/{duration}
      // 其中 product_id 可能包含转义的 /，如 SPOT\/BTC-USDT
      const [datasource_id, product_id, duration] = decodePath(series_id);

      if (supportedDurations && !supportedDurations.has(duration)) {
        throw `duration ${duration} is not supported`;
      }

      const offset = convertDurationToOffset(duration);
      if (!datasource_id) {
        throw 'datasource_id is required';
      }
      if (!product_id) {
        throw 'product_id is required';
      }
      if (isNaN(offset)) {
        throw 'duration is invalid';
      }
      const data = await ctx.queryFn({
        //
        series_id,
        datasource_id,
        product_id,
        duration,
        offset,
        time,
      });
      return data;
    },
    serviceOptions: ctx.serviceOptions,
  });
};
