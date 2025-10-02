import { Terminal } from '@yuants/protocol';

/**
 * Helper function to provide OHLC Duration service
 * 提供K线周期服务的辅助函数
 *
 * @remarks
 * 这是一个目录服务，用于提供支持的K线周期列表
 * 之后会结合 Product 和这个 duration list 合成出所有K线的 series_id
 *
 * @public
 */
export function provideOHLCDurationService(
  terminal: Terminal,
  datasource_id: string,
  queryDurations: () => Promise<string[]> | string[],
) {
  // Provide the service with proper generics
  terminal.server.provideService(
    'QueryOHLCDuration',
    {
      type: 'object',
      required: ['datasource_id'],
      properties: {
        datasource_id: {
          type: 'string',
          const: datasource_id,
          description: 'Data source ID to filter durations by',
        },
      },
    },
    async () => {
      return {
        res: {
          code: 0,
          message: 'OK',
          data: await Promise.resolve(queryDurations()),
        },
      };
    },
  );
}
