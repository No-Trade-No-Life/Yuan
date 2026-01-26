import { IServiceOptions, Terminal } from '@yuants/protocol';
import { ITradeHistory, encodeTradeHistorySeriesId } from '@yuants/data-trade';
import { ISeriesIngestResult } from './types';
import { buildInsertManyIntoTableSQL, requestSQL } from '@yuants/sql';
import { formatTime } from '@yuants/utils';

interface IExchangeCredential {
  type: string;
  payload: any;
}

interface IIngestInterestLedgerRequest {
  credential: IExchangeCredential;
  account_id: string;
  time: number;
  trade_type: string;
}

const computeInterestRatePageRange = (
  items: ITradeHistory[],
): { start_time: string; end_time: string } | undefined => {
  if (items.length === 0) return undefined;

  let start = items[0];
  let startMs = Date.parse(start.created_at);
  let end = items[0];
  let endMs = Date.parse(end.created_at);

  for (const item of items) {
    const createdAtMs = Date.parse(item.created_at);
    if (!isNaN(createdAtMs) && (isNaN(startMs) || createdAtMs < startMs)) {
      start = item;
      startMs = createdAtMs;
    }
    if (!isNaN(createdAtMs) && (isNaN(endMs) || createdAtMs > endMs)) {
      end = item;
      endMs = createdAtMs;
    }
  }

  return { start_time: start.created_at, end_time: end.created_at };
};

const TRADE_HISTORY_INSERT_COLUMNS: Array<keyof ITradeHistory> = [
  'id',
  'product_id',
  'account_id',
  'direction',
  'size',
  'price',
  'fee',
  'fee_currency',
  'pnl',
  'created_at',
  'origin',
];

/**
 * @public
 */
export const provideTradeHistoryService = (
  terminal: Terminal,
  metadata: { direction: string; type: string; trade_type: string[] },
  fetchPage: (request: IIngestInterestLedgerRequest) => Promise<ITradeHistory[]>,
  serviceOptions?: IServiceOptions,
) => {
  return terminal.server.provideService<IIngestInterestLedgerRequest, ISeriesIngestResult>(
    'IngestTradeHistory',
    {
      type: 'object',
      required: ['account_id', 'direction', 'time', 'credential', 'trade_type'],
      properties: {
        account_id: { type: 'string', pattern: `^${metadata.type}` },
        direction: { const: metadata.direction },
        time: { type: 'number' },
        trade_type: { type: 'string', enum: metadata.trade_type },
        credential: {
          type: 'object',
          required: ['type', 'payload'],
          properties: {
            type: { type: 'string', const: metadata.type },
            payload: { type: 'object' },
          },
        },
      },
    },
    async (msg) => {
      try {
        const tradeHistory = await fetchPage({ ...msg.req });
        const range = computeInterestRatePageRange(tradeHistory);
        // Atomic write: data rows + series_data_range in the same statement.
        if (tradeHistory.length > 0 && range) {
          const writeTradeHistory = `${buildInsertManyIntoTableSQL(tradeHistory, 'trade_history', {
            columns: TRADE_HISTORY_INSERT_COLUMNS,
            conflictKeys: ['id', 'account_id'],
          })} RETURNING 1`;

          const writeRange = `${buildInsertManyIntoTableSQL(
            [
              {
                series_id: encodeTradeHistorySeriesId(msg.req.account_id, msg.req.trade_type),
                table_name: 'trade_history',
                start_time: range.start_time,
                end_time: range.end_time,
              },
            ],
            'series_data_range',
            {
              columns: ['series_id', 'table_name', 'start_time', 'end_time'],
              ignoreConflict: true,
            },
          )} RETURNING 1`;

          await requestSQL(
            terminal,
            `
            WITH
              write_trade_history AS (
                ${writeTradeHistory}
              ),
              write_range AS (
                ${writeRange}
              )
            SELECT 1 as ok;
            `,
          );
        } else if (tradeHistory.length > 0) {
          await requestSQL(
            terminal,
            buildInsertManyIntoTableSQL(tradeHistory, 'trade_history', {
              columns: TRADE_HISTORY_INSERT_COLUMNS,
              conflictKeys: ['id', 'account_id'],
            }),
          );
        } else {
          if (
            (metadata.type === 'HTX' ||
              metadata.type === 'BITGET' ||
              metadata.type === 'ASTER' ||
              metadata.type === 'BINANCE') &&
            tradeHistory.length === 0
          ) {
            if (msg.req.time >= Date.now() - 3600_000 * 24 * 88 || msg.req.time === 0) {
              msg.req.time = Math.max(msg.req.time, Date.now() - 3600_000 * 24 * 88);
              await requestSQL(
                terminal,
                buildInsertManyIntoTableSQL(
                  [
                    {
                      series_id: encodeTradeHistorySeriesId(msg.req.account_id, msg.req.trade_type),
                      table_name: 'trade_history',
                      start_time:
                        metadata.direction === 'backward'
                          ? formatTime(msg.req.time - 48 * 3600_000)
                          : formatTime(msg.req.time),
                      end_time:
                        metadata.direction === 'backward'
                          ? formatTime(msg.req.time)
                          : formatTime(msg.req.time + 48 * 3600_000),
                    },
                  ],
                  'series_data_range',
                  {
                    columns: ['series_id', 'table_name', 'start_time', 'end_time'],
                    ignoreConflict: true,
                  },
                ),
              );
            }
          }
        }

        return {
          res: { code: 0, message: 'OK', data: { wrote_count: tradeHistory.length, range } },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : `${error}`;
        return { res: { code: 1, message } };
      }
    },
    serviceOptions,
  );
};
