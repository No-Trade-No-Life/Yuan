import { IServiceOptions, Terminal } from '@yuants/protocol';
import { buildInsertManyIntoTableSQL, requestSQL } from '@yuants/sql';
import { encodePath, escapeRegExp } from '@yuants/utils';

/**
 * Provide series from time backward service
 *
 * 提供从时间点向前查询序列数据的服务
 *
 * @public
 */
export const provideSeriesFromTimeBackwardService = <
  T extends { series_id: string; created_at: string },
>(ctx: {
  terminal: Terminal;
  type: string;
  series_id_prefix_parts: string[];
  queryFn: (ctx: { series_id: string; time: string }) => Promise<T[]>;
  serviceOptions?: IServiceOptions;
}) => {
  interface IQuerySeriesFromTimeBackwardReq {
    time: string;
    type: string;
    series_id: string;
  }

  ctx.terminal.server.provideService<IQuerySeriesFromTimeBackwardReq, T[]>(
    'QuerySeriesFromTimeBackward',
    {
      type: 'object',
      required: ['type', 'series_id', 'time'],
      properties: {
        type: { const: ctx.type },
        series_id: { type: 'string', pattern: `^${escapeRegExp(encodePath(ctx.series_id_prefix_parts))}/` },
        time: { type: 'string', format: 'date-time' },
      },
    },
    async (msg) => {
      const { time, series_id } = msg.req;

      const data = await ctx.queryFn({ series_id, time });

      return {
        res: {
          code: 0,
          message: 'OK',
          data,
        },
      };
    },
    ctx.serviceOptions,
  );

  ctx.terminal.server.provideService<IQuerySeriesFromTimeBackwardReq, {}>(
    'UpdateSeriesFromTimeBackward',
    {
      type: 'object',
      required: ['type', 'series_id', 'time'],
      properties: {
        type: { const: ctx.type },
        series_id: { type: 'string' },
        time: { type: 'string', format: 'date-time' },
      },
    },
    async (msg) => {
      const data = await ctx.terminal.client.requestForResponseData<IQuerySeriesFromTimeBackwardReq, T[]>(
        'QuerySeriesFromTimeBackward',
        msg.req,
      );

      await requestSQL(
        ctx.terminal,
        buildInsertManyIntoTableSQL(data, 'ohlc', {
          conflictKeys: ['series_id', 'created_at'],
        }),
      );

      return {
        res: {
          code: 0,
          message: 'OK',
          data: {
            count: data.length,
          },
        },
      };
    },
  );
};
