import { parseQuoteServiceMetadataFromSchema } from './quote';

describe('parseQuoteServiceMetadataFromSchema', () => {
  it('parses quote service schema', () => {
    const schema = {
      type: 'object',
      required: ['product_ids', 'fields'],
      properties: {
        product_ids: {
          type: 'array',
          maxItems: 20,
          items: { type: 'string', pattern: '^BINANCE/USDT-FUTURE' },
        },
        fields: {
          type: 'array',
          const: ['last_price', 'bid_price'],
        },
      },
    };

    const meta = parseQuoteServiceMetadataFromSchema(schema);
    expect(meta).toEqual({
      product_id_prefix: 'BINANCE/USDT-FUTURE',
      fields: ['last_price', 'bid_price'],
      max_products_per_request: 20,
    });
  });

  it('throws when schema missing/invalid', () => {
    expect(() => parseQuoteServiceMetadataFromSchema(undefined)).toThrow('QUOTE_SERVICE_SCHEMA_MISSING');
    expect(() => parseQuoteServiceMetadataFromSchema({})).toThrow('QUOTE_SERVICE_SCHEMA_INVALID');
  });
});
