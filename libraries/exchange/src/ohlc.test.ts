import { parseOHLCServiceMetadataFromSchema } from './ohlc';

describe('parseOHLCServiceMetadataFromSchema', () => {
  it('parses OHLC service schema', () => {
    const schema = {
      type: 'object',
      required: ['product_id', 'duration', 'direction', 'time'],
      properties: {
        product_id: { type: 'string', pattern: '^BINANCE/USDT-FUTURE' },
        duration: { type: 'string', enum: ['PT1M', 'PT5M'] },
        direction: { const: 'backward' },
        time: { type: 'string', format: 'date-time' },
      },
    };

    const meta = parseOHLCServiceMetadataFromSchema(schema);
    expect(meta).toEqual({
      product_id_prefix: 'BINANCE/USDT-FUTURE',
      duration_list: ['PT1M', 'PT5M'],
      direction: 'backward',
    });
  });

  it('throws when schema missing/invalid', () => {
    expect(() => parseOHLCServiceMetadataFromSchema(undefined)).toThrow('OHLC_SERVICE_SCHEMA_MISSING');
    expect(() => parseOHLCServiceMetadataFromSchema({})).toThrow('OHLC_SERVICE_SCHEMA_INVALID');
  });
});
