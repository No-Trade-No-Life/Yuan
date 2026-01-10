import { encodeInterestRateSeriesId, IInterestRate, IInterestLedger } from '@yuants/data-interest-rate';
import { IServiceOptions, Terminal } from '@yuants/protocol';
import { createValidator } from '@yuants/protocol/lib/schema';
import { buildInsertManyIntoTableSQL, requestSQL } from '@yuants/sql';
import { newError } from '../../utils/lib';
import { ISeriesIngestResult, SeriesFetchDirection } from './types';
import { IExchange } from '.';

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
  items: (IInterestRate | IInterestLedger)[],
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

        const range = computeInterestRatePageRange(normalized);

        // Atomic write: data rows + series_data_range in the same statement.
        if (normalized.length > 0 && range) {
          const writeInterestRate = `${buildInsertManyIntoTableSQL(normalized, 'interest_rate', {
            columns: INTEREST_RATE_INSERT_COLUMNS,
            conflictKeys: ['series_id', 'created_at'],
          })} RETURNING 1`;

          const writeRange = `${buildInsertManyIntoTableSQL(
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
          )} RETURNING 1`;

          await requestSQL(
            terminal,
            `
            WITH
              write_interest_rate AS (
                ${writeInterestRate}
              ),
              write_range AS (
                ${writeRange}
              )
            SELECT 1 as ok;
            `,
          );
        } else if (normalized.length > 0) {
          await requestSQL(
            terminal,
            buildInsertManyIntoTableSQL(normalized, 'interest_rate', {
              columns: INTEREST_RATE_INSERT_COLUMNS,
              conflictKeys: ['series_id', 'created_at'],
            }),
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
interface IExchangeCredential {
  type: string;
  payload: any;
}

interface IIngestInterestLedgerRequest {
  credential: IExchangeCredential;
  account_id: string;
  time: number;
  ledger_type: string;
}

const ACCOUNT_INTEREST_LEDGER_INSERT_COLUMNS: Array<keyof IInterestLedger> = [
  'created_at',
  'product_id',
  'account_id',
  'amount',
  'currency',
  'id',
];

/**
 * @public
 */
export const provideInterestLedgerService = (
  terminal: Terminal,
  metadata: { direction: string; type: string; ledger_type: string[] },
  fetchPage: (request: IIngestInterestLedgerRequest) => Promise<IInterestLedger[]>,
  serviceOptions?: IServiceOptions,
) => {
  return terminal.server.provideService<IIngestInterestLedgerRequest, ISeriesIngestResult>(
    'IngestInterestLedger',
    {
      type: 'object',
      required: ['account_id', 'direction', 'time', 'credential', 'ledger_type'],
      properties: {
        account_id: { type: 'string', pattern: `^${metadata.type}` },
        direction: { const: metadata.direction },
        time: { type: 'number' },
        ledger_type: { type: 'string', enum: metadata.ledger_type },
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
        const accountInterestLedgers = await fetchPage({ ...msg.req });

        const range = computeInterestRatePageRange(accountInterestLedgers);
        // Atomic write: data rows + series_data_range in the same statement.
        if (accountInterestLedgers.length > 0 && range) {
          const writeInterestRate = `${buildInsertManyIntoTableSQL(
            accountInterestLedgers,
            'account_interest_ledger',
            {
              columns: ACCOUNT_INTEREST_LEDGER_INSERT_COLUMNS,
              conflictKeys: ['id'],
            },
          )} RETURNING 1`;

          const writeRange = `${buildInsertManyIntoTableSQL(
            [
              {
                series_id: msg.req.account_id,
                table_name: 'account_interest_ledger',
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
              write_account_interest_ledger AS (
                ${writeInterestRate}
              ),
              write_range AS (
                ${writeRange}
              )
            SELECT 1 as ok;
            `,
          );
        } else if (accountInterestLedgers.length > 0) {
          await requestSQL(
            terminal,
            buildInsertManyIntoTableSQL(accountInterestLedgers, 'account_interest_ledger', {
              columns: ACCOUNT_INTEREST_LEDGER_INSERT_COLUMNS,
              conflictKeys: ['id'],
            }),
          );
        }

        return {
          res: { code: 0, message: 'OK', data: { wrote_count: accountInterestLedgers.length, range } },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : `${error}`;
        return { res: { code: 1, message } };
      }
    },
    serviceOptions,
  );
};
