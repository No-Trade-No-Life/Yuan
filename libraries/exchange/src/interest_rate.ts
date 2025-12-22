import { encodeInterestRateSeriesId, IInterestRate } from '@yuants/data-interest-rate';
import { IServiceOptions, Terminal } from '@yuants/protocol';
import { createValidator } from '@yuants/protocol/lib/schema';
import { buildInsertManyIntoTableSQL, requestSQL } from '@yuants/sql';
import { newError } from '../../utils/lib';
import { ISeriesIngestResult, SeriesFetchDirection } from './types';

/**
 * Interest Rate Service Metadata
 * @public
 */
export interface IInterestRateServiceMetadata {
  product_id_prefix: string;
  direction: SeriesFetchDirection;
}

/**
 * Interest Rate Service Request from VEX to Vendor
 * @public
 */
export interface IIngestInterestRateRequest {
  product_id: string;
  direction: SeriesFetchDirection;
  time: number;
}

const schemaValidator = createValidator({
  type: 'object',
  required: ['type', 'properties'],
  properties: {
    type: { type: 'string', const: 'object' },
    required: { type: 'array', const: ['product_id', 'direction', 'time'] },
    properties: {
      type: 'object',
      required: ['product_id', 'direction', 'time'],
      properties: {
        product_id: {
          type: 'object',
          required: ['type', 'pattern'],
          properties: {
            type: { type: 'string', const: 'string' },
            pattern: { type: 'string', pattern: '^\\^' },
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
export const parseInterestRateServiceMetadataFromSchema = (schema: any): IInterestRateServiceMetadata => {
  if (!schema) throw newError('INTEREST_RATE_SERVICE_SCHEMA_MISSING', { schema });
  if (!schemaValidator(schema)) throw newError('INTEREST_RATE_SERVICE_SCHEMA_INVALID', { schema });
  return {
    product_id_prefix: schema.properties.product_id.pattern.slice(1),
    direction: schema.properties.direction.const,
  };
};

const INTEREST_RATE_INSERT_COLUMNS: Array<keyof IInterestRate> = [
  'series_id',
  'created_at',
  'datasource_id',
  'product_id',
  'long_rate',
  'short_rate',
  'settlement_price',
];

const computeInterestRatePageRange = (
  items: IInterestRate[],
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

/**
 * @public
 */
export const provideInterestRateService = (
  terminal: Terminal,
  metadata: IInterestRateServiceMetadata,
  fetchPage: (request: IIngestInterestRateRequest & { series_id: string }) => Promise<IInterestRate[]>,
  serviceOptions?: IServiceOptions,
) => {
  return terminal.server.provideService<IIngestInterestRateRequest, ISeriesIngestResult>(
    'IngestInterestRate',
    {
      type: 'object',
      required: ['product_id', 'direction', 'time'],
      properties: {
        product_id: { type: 'string', pattern: `^${metadata.product_id_prefix}` },
        direction: { const: metadata.direction },
        time: { type: 'number' },
      },
    },
    async (msg) => {
      try {
        const series_id = encodeInterestRateSeriesId(msg.req.product_id);

        const items = await fetchPage({ ...msg.req, series_id });

        const normalized: IInterestRate[] = items.map((x) => ({
          ...x,
          series_id,
          datasource_id: '',
          product_id: msg.req.product_id,
        }));

        if (normalized.length > 0) {
          await requestSQL(
            terminal,
            buildInsertManyIntoTableSQL(normalized, 'interest_rate', {
              columns: INTEREST_RATE_INSERT_COLUMNS,
              conflictKeys: ['series_id', 'created_at'],
            }),
          );
        }

        const range = computeInterestRatePageRange(normalized);
        if (range) {
          await requestSQL(
            terminal,
            buildInsertManyIntoTableSQL(
              [
                {
                  series_id,
                  table_name: 'interest_rate',
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
        return { res: { code: 1, message } };
      }
    },
    serviceOptions,
  );
};
