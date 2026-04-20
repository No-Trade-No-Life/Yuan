import { mapOkxOrdTypeToOrderType } from './mapOkxOrdTypeToOrderType';
import { mapOrderTypeToOrdType } from './mapOrderTypeToOrdType';

describe('mapOrderTypeToOrdType', () => {
  test('maps IOC and FOK to OKX ordType values', () => {
    expect(mapOrderTypeToOrdType('IOC')).toBe('ioc');
    expect(mapOrderTypeToOrdType('FOK')).toBe('fok');
  });
});

describe('mapOkxOrdTypeToOrderType', () => {
  test('maps OKX ordType values back to Yuan order types', () => {
    expect(mapOkxOrdTypeToOrderType('market')).toBe('MARKET');
    expect(mapOkxOrdTypeToOrderType('limit')).toBe('LIMIT');
    expect(mapOkxOrdTypeToOrderType('post_only')).toBe('MAKER');
    expect(mapOkxOrdTypeToOrderType('ioc')).toBe('IOC');
    expect(mapOkxOrdTypeToOrderType('fok')).toBe('FOK');
  });

  test('returns UNKNOWN for unsupported ordType', () => {
    expect(mapOkxOrdTypeToOrderType('not_a_real_okx_ord_type')).toBe('UNKNOWN');
  });
});
