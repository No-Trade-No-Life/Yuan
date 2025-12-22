import { encodeOHLCSeriesId, IOHLC } from '@yuants/data-ohlc';
import { IServiceOptions, Terminal } from '@yuants/protocol';
import { createValidator } from '@yuants/protocol/lib/schema';
import { buildInsertManyIntoTableSQL, requestSQL } from '@yuants/sql';
import { formatTime } from '@yuants/utils';
import { newError } from '../../utils/lib';
import { ISeriesIngestResult, SeriesFetchDirection } from './types';

/**
 * OHLC Service Metadata
 * @public
 */
export interface IOHLCServiceMetadata {
  product_id_prefix: string;
  duration_list: string[];
  direction: SeriesFetchDirection;
}

/**
 * OHLC Service Request from VEX to Vendor
 * @public
 */
export interface IIngestOHLCRequest {
  product_id: string;
  duration: string;
  direction: SeriesFetchDirection;
  time: number;
}

const schemaValidator = createValidator({
  type: 'object',
  required: ['type', 'properties'],
  properties: {
    type: { type: 'string', const: 'object' },
    required: { type: 'array', const: ['product_id', 'duration', 'direction', 'time'] },
    properties: {
      type: 'object',
      required: ['product_id', 'duration', 'direction', 'time'],
      properties: {
        product_id: {
          type: 'object',
          required: ['type', 'pattern'],
          properties: {
            type: { type: 'string', const: 'string' },
            pattern: { type: 'string', pattern: '^\\^' },
          },
        },
        duration: {
          type: 'object',
          required: ['type', 'enum'],
          properties: {
            type: { type: 'string', const: 'string' },
            enum: { type: 'array', items: { type: 'string' } },
          },
        },
        direction: {
          type: 'object',
          required: ['const'],
          properties: {
            const: { type: 'string', enum: ['backward', 'forward'] },
          },
        },
        time: {
          type: 'object',
          required: ['type'],
          properties: {
            type: { type: 'string', const: 'number' },
          },
        },
      },
    },
  },
});

/**
 * @public
 */
export const parseOHLCServiceMetadataFromSchema = (schema: any): IOHLCServiceMetadata => {
  if (!schema) throw newError('OHLC_SERVICE_SCHEMA_MISSING', { schema });
  if (!schemaValidator(schema)) throw newError('OHLC_SERVICE_SCHEMA_INVALID', { schema });
  return {
    product_id_prefix: schema.properties.product_id.pattern.slice(1),
    duration_list: schema.properties.duration.enum,
    direction: schema.properties.direction.const,
  };
};

const OHLC_INSERT_COLUMNS: Array<keyof IOHLC> = [
  'series_id',
  'created_at',
  'closed_at',
  'open',
  'high',
  'low',
  'close',
  'volume',
  'open_interest',
];

const computeOHLCPageRange = (items: IOHLC[]): { start_time: string; end_time: string } | undefined => {
  if (items.length === 0) return undefined;

  let start = items[0];
  let startMs = Date.parse(start.created_at);
  let end = items[0];
  let endMs = Date.parse(end.closed_at) || Date.parse(end.created_at);

  for (const item of items) {
    const createdAtMs = Date.parse(item.created_at);
    if (!isNaN(createdAtMs) && (isNaN(startMs) || createdAtMs < startMs)) {
      start = item;
      startMs = createdAtMs;
    }
    const closedAtMs = Date.parse(item.closed_at);
    const candidateEndMs = !isNaN(closedAtMs) ? closedAtMs : createdAtMs;
    if (!isNaN(candidateEndMs) && (isNaN(endMs) || candidateEndMs > endMs)) {
      end = item;
      endMs = candidateEndMs;
    }
  }

  return {
    start_time: start.created_at,
    end_time: end.closed_at || end.created_at,
  };
};

/**
 * @public
 */
export const provideOHLCService = (
  terminal: Terminal,
  metadata: IOHLCServiceMetadata,
  fetchPage: (request: IIngestOHLCRequest & { series_id: string }) => Promise<IOHLC[]>,
  serviceOptions?: IServiceOptions,
) => {
  return terminal.server.provideService<IIngestOHLCRequest, ISeriesIngestResult>(
    'IngestOHLC',
    {
      type: 'object',
      required: ['product_id', 'duration', 'direction', 'time'],
      properties: {
        product_id: { type: 'string', pattern: `^${metadata.product_id_prefix}` },
        duration: { type: 'string', enum: metadata.duration_list },
        direction: { const: metadata.direction },
        time: { type: 'number' },
      },
    },
    async (msg) => {
      try {
        const series_id = encodeOHLCSeriesId(msg.req.product_id, msg.req.duration);

        const items = await fetchPage({ ...msg.req, series_id });

        console.info(
          formatTime(Date.now()),
          'IngestOHLC',
          msg.req.product_id,
          msg.req.duration,
          'fetched',
          items.length,
          'bars',
        );

        const normalized: IOHLC[] = items.map((x) => ({
          ...x,
          series_id,
          datasource_id: '',
          product_id: msg.req.product_id,
          duration: msg.req.duration,
          open_interest: x.open_interest ?? '0',
        }));

        if (normalized.length > 0) {
          await requestSQL(
            terminal,
            buildInsertManyIntoTableSQL(normalized, 'ohlc_v2', {
              columns: OHLC_INSERT_COLUMNS,
              conflictKeys: ['series_id', 'created_at'],
            }),
          );
        }

        const range = computeOHLCPageRange(normalized);
        if (range) {
          await requestSQL(
            terminal,
            buildInsertManyIntoTableSQL(
              [
                {
                  series_id,
                  table_name: 'ohlc_v2',
                  start_time: range.start_time,
                  end_time: range.end_time,
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

        return { res: { code: 0, message: 'OK', data: { wrote_count: normalized.length, range } } };
      } catch (error) {
        const message = error instanceof Error ? error.message : `${error}`;
        console.error(formatTime(Date.now()), 'IngestOHLC error:', error);
        return { res: { code: 1, message } };
      }
    },
    serviceOptions,
  );
};
