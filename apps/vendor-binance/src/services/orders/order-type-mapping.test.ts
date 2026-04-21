import { mapBinanceOrderTypeToYuants, mapOrderTypeToOrdType, mapOrderTypeToTimeInForce } from './order-utils';

describe('Binance order type mappings', () => {
  test('maps IOC and FOK order types to Binance LIMIT orders', () => {
    expect(mapOrderTypeToOrdType('IOC')).toBe('LIMIT');
    expect(mapOrderTypeToOrdType('FOK')).toBe('LIMIT');
  });

  test('maps Yuan order types to Binance timeInForce values', () => {
    expect(mapOrderTypeToTimeInForce('LIMIT')).toBe('GTC');
    expect(mapOrderTypeToTimeInForce('MAKER')).toBe('GTX');
    expect(mapOrderTypeToTimeInForce('IOC')).toBe('IOC');
    expect(mapOrderTypeToTimeInForce('FOK')).toBe('FOK');
    expect(mapOrderTypeToTimeInForce('MARKET')).toBeUndefined();
  });

  test('maps Binance type and timeInForce back to Yuan order types', () => {
    expect(mapBinanceOrderTypeToYuants('MARKET')).toBe('MARKET');
    expect(mapBinanceOrderTypeToYuants('LIMIT', 'GTC')).toBe('LIMIT');
    expect(mapBinanceOrderTypeToYuants('LIMIT', 'GTX')).toBe('MAKER');
    expect(mapBinanceOrderTypeToYuants('LIMIT', 'IOC')).toBe('IOC');
    expect(mapBinanceOrderTypeToYuants('LIMIT', 'FOK')).toBe('FOK');
  });
});
