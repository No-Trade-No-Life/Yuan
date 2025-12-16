import { IQuote } from '@yuants/data-quote';
import { IServiceOptions, Terminal } from '@yuants/protocol';
import { createValidator } from '@yuants/protocol/lib/schema';
import { newError } from '../../utils/lib';
import { IQuoteField, IQuoteServiceMetadata, IQuoteServiceRequestByVEX, IQuoteUpdateAction } from './types';

const schemaValidator = createValidator({
  type: 'object',
  required: ['type', 'properties'],
  properties: {
    type: { type: 'string', const: 'object' },
    required: { type: 'array', const: ['product_ids', 'fields'] },
    properties: {
      type: 'object',
      required: ['product_ids', 'fields'],
      properties: {
        product_ids: {
          type: 'object',
          required: ['type', 'items'],
          properties: {
            type: { type: 'string', const: 'array' },
            maxItems: { type: ['number', 'null'] },
            items: {
              type: 'object',
              required: ['type', 'pattern'],
              properties: {
                type: { type: 'string', const: 'string' },
                pattern: { type: 'string', pattern: '^\\^' },
              },
            },
          },
        },
        fields: {
          type: 'object',
          required: ['type', 'const'],
          properties: {
            type: { type: 'string', const: 'array' },
            const: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  },
});

/**
 * Extract Quote Service Metadata from JSON Schema
 * @public
 */
export const parseQuoteServiceMetadataFromSchema = (schema: any): IQuoteServiceMetadata => {
  if (!schema) throw newError('QUOTE_SERVICE_SCHEMA_MISSING', { schema });
  if (!schemaValidator(schema)) throw newError('QUOTE_SERVICE_SCHEMA_INVALID', { schema });

  return {
    product_id_prefix: schema.properties.product_ids.items.pattern.slice(1),
    fields: schema.properties.fields.const,
    max_products_per_request: schema.properties.product_ids.maxItems,
  };
};

/**
 * Provide Quote Service
 * @public
 */
export const provideQuoteService = <K extends IQuoteField>(
  terminal: Terminal,
  metadata: IQuoteServiceMetadata<K>,
  requestFunc: (
    request: IQuoteServiceRequestByVEX,
  ) => Promise<Array<Pick<IQuote, K> & { product_id: string; updated_at: number }>>,
  serviceOptions?: IServiceOptions,
) => {
  return terminal.server.provideService<IQuoteServiceRequestByVEX, IQuoteUpdateAction>(
    'GetQuotes',
    {
      type: 'object',
      required: ['product_ids', 'fields'],
      properties: {
        product_ids: {
          type: 'array',
          maxItems: metadata.max_products_per_request,
          items: { type: 'string', pattern: `^${metadata.product_id_prefix}` },
        },
        fields: {
          type: 'array',
          const: metadata.fields.sort(),
        },
      },
    },
    async (msg) => {
      const data = await requestFunc(msg.req);

      const action: IQuoteUpdateAction = {};
      for (const quote of data) {
        const { product_id, updated_at, ...fields } = quote;
        action[product_id] ??= {};
        for (const key of Object.keys(fields) as K[]) {
          const value = (fields as any)[key];
          if (value !== undefined) {
            action[product_id][key] = [value, updated_at];
          }
        }
      }

      return { res: { code: 0, message: 'OK', data: action } };
    },
    serviceOptions,
  );
};
