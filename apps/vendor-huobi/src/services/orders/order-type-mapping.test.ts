import { mapSwapOrderTypeToHuobi, mapUnionSwapOrderTypeToHuobi } from './mapSwapOrderTypeToHuobi';
import { mapHuobiSwapOrderToOrderType } from './mapHuobiSwapOrderToOrderType';

describe('Huobi swap order type mappings', () => {
  test('maps MARKET LIMIT IOC and FOK for normal swap accounts', () => {
    expect(mapSwapOrderTypeToHuobi('MARKET')).toEqual({ order_price_type: 'market' });
    expect(mapSwapOrderTypeToHuobi('LIMIT')).toEqual({ order_price_type: 'limit' });
    expect(mapSwapOrderTypeToHuobi('IOC')).toEqual({ order_price_type: 'ioc' });
    expect(mapSwapOrderTypeToHuobi('FOK')).toEqual({ order_price_type: 'fok' });
  });

  test('maps MARKET LIMIT IOC and FOK for unified swap accounts', () => {
    expect(mapUnionSwapOrderTypeToHuobi('MARKET')).toEqual({ type: 'market', time_in_force: undefined });
    expect(mapUnionSwapOrderTypeToHuobi('LIMIT')).toEqual({ type: 'limit', time_in_force: undefined });
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
