import { mapSwapOrderTypeToHuobi, mapUnionSwapOrderTypeToHuobi } from './mapSwapOrderTypeToHuobi';
import { mapHuobiSwapOrderToOrderType } from './mapHuobiSwapOrderToOrderType';

describe('Huobi swap order type mappings', () => {
  test('maps IOC and FOK for normal swap accounts', () => {
    expect(mapSwapOrderTypeToHuobi('IOC')).toEqual({ order_price_type: 'ioc' });
    expect(mapSwapOrderTypeToHuobi('FOK')).toEqual({ order_price_type: 'fok' });
  });

  test('maps IOC and FOK for unified swap accounts', () => {
    expect(mapUnionSwapOrderTypeToHuobi('IOC')).toEqual({ type: 'limit', time_in_force: 'ioc' });
    expect(mapUnionSwapOrderTypeToHuobi('FOK')).toEqual({ type: 'limit', time_in_force: 'fok' });
  });
});

describe('mapHuobiSwapOrderToOrderType', () => {
  test('maps Huobi order_price_type values back to Yuan order types', () => {
    expect(mapHuobiSwapOrderToOrderType('lightning')).toBe('MARKET');
    expect(mapHuobiSwapOrderToOrderType('limit')).toBe('LIMIT');
    expect(mapHuobiSwapOrderToOrderType('ioc')).toBe('IOC');
    expect(mapHuobiSwapOrderToOrderType('optimal_20_ioc')).toBe('IOC');
    expect(mapHuobiSwapOrderToOrderType('fok')).toBe('FOK');
  });
});
