import { mapGateOrderToOrderType } from './mapGateOrderToOrderType';
import { mapOrderTypeToTif } from './mapOrderTypeToTif';

describe('mapOrderTypeToTif', () => {
  test('maps IOC and FOK to Gate tif values', () => {
    expect(mapOrderTypeToTif('IOC')).toBe('ioc');
    expect(mapOrderTypeToTif('FOK')).toBe('fok');
  });
});

describe('mapGateOrderToOrderType', () => {
  test('maps Gate tif and price to Yuan order types', () => {
    expect(mapGateOrderToOrderType({ tif: 'ioc', price: '0' })).toBe('MARKET');
    expect(mapGateOrderToOrderType({ tif: 'ioc', price: '12345' })).toBe('IOC');
    expect(mapGateOrderToOrderType({ tif: 'fok', price: '12345' })).toBe('FOK');
  });
});
