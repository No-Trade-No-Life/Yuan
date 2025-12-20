import { parseInterestRateServiceMetadataFromSchema } from './interest_rate';

describe('parseInterestRateServiceMetadataFromSchema', () => {
  it('parses interest rate service schema', () => {
    const schema = {
      type: 'object',
      required: ['product_id', 'direction', 'time'],
      properties: {
        product_id: { type: 'string', pattern: '^BINANCE/' },
        direction: { const: 'forward' },
        time: { type: 'string', format: 'date-time' },
      },
    };

    const meta = parseInterestRateServiceMetadataFromSchema(schema);
    expect(meta).toEqual({
      product_id_prefix: 'BINANCE/',
      direction: 'forward',
    });
  });

  it('throws when schema missing/invalid', () => {
    expect(() => parseInterestRateServiceMetadataFromSchema(undefined)).toThrow(
      'INTEREST_RATE_SERVICE_SCHEMA_MISSING',
    );
    expect(() => parseInterestRateServiceMetadataFromSchema({})).toThrow(
      'INTEREST_RATE_SERVICE_SCHEMA_INVALID',
    );
  });
});
