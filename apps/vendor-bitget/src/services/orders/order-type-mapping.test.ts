import assert from 'node:assert/strict';
import test from 'node:test';
import { mapBitgetOrderToOrderType } from './mapBitgetOrderToOrderType';
import { mapOrderTypeToBitgetOrderParams } from './mapOrderTypeToBitgetOrderParams';

test('mapOrderTypeToBitgetOrderParams maps MARKET LIMIT MAKER IOC and FOK to Bitget order params', () => {
  assert.deepEqual(mapOrderTypeToBitgetOrderParams('MARKET'), { orderType: 'market' });
  assert.deepEqual(mapOrderTypeToBitgetOrderParams('LIMIT'), { orderType: 'limit' });
  assert.deepEqual(mapOrderTypeToBitgetOrderParams('MAKER'), {
    orderType: 'limit',
    timeInForce: 'post_only',
  });
  assert.deepEqual(mapOrderTypeToBitgetOrderParams('IOC'), { orderType: 'limit', timeInForce: 'ioc' });
  assert.deepEqual(mapOrderTypeToBitgetOrderParams('FOK'), { orderType: 'limit', timeInForce: 'fok' });
});

test('mapBitgetOrderToOrderType maps Bitget orderType and timeInForce back to Yuan order types', () => {
  assert.equal(mapBitgetOrderToOrderType({ timeInForce: 'post_only' }), 'MAKER');
  assert.equal(mapBitgetOrderToOrderType({ timeInForce: 'ioc' }), 'IOC');
  assert.equal(mapBitgetOrderToOrderType({ timeInForce: 'fok' }), 'FOK');
  assert.equal(mapBitgetOrderToOrderType({ orderType: 'market' }), 'MARKET');
  assert.equal(mapBitgetOrderToOrderType({ orderType: 'limit' }), 'LIMIT');
  assert.equal(mapBitgetOrderToOrderType({ orderType: 'unknown', timeInForce: 'gtc' }), 'UNKNOWN');
});
