import assert from 'node:assert/strict';
import test from 'node:test';
import { encodePath } from '@yuants/utils';
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
  assert.equal(mapBitgetOrderToOrderType({ orderType: 'market', timeInForce: 'ioc' }), 'MARKET');
  assert.equal(mapBitgetOrderToOrderType({ orderType: 'limit' }), 'LIMIT');
  assert.equal(mapBitgetOrderToOrderType({ orderType: 'unknown', timeInForce: 'gtc' }), 'UNKNOWN');
});

test('submitOrder maps IOC and FOK to Bitget order params for futures and spot', async () => {
  const payloads: unknown[] = [];
  const privateApiPath = require.resolve('../../api/private-api');
  const submitOrderPath = require.resolve('./submitOrder');
  const originalPrivateApiModule = require.cache[privateApiPath];
  const originalSubmitOrderModule = require.cache[submitOrderPath];

  require.cache[privateApiPath] = {
    id: privateApiPath,
    filename: privateApiPath,
    loaded: true,
    exports: {
      postPlaceOrder: async (_credential: unknown, params: unknown) => {
        payloads.push(params);
        return {
          code: '00000',
          msg: 'success',
          requestTime: Date.now(),
          data: { orderId: `order-${payloads.length}`, clientOid: '' },
        };
      },
    },
    children: [],
    path: '',
    paths: [],
    isPreloading: false,
  } as unknown as NodeModule;

  delete require.cache[submitOrderPath];
  const { submitOrder } = require('./submitOrder') as typeof import('./submitOrder');

  try {
    await submitOrder(
      { access_key: 'ak', secret_key: 'sk', passphrase: 'pp' },
      {
        account_id: 'bitget/test/futures',
        product_id: encodePath('BITGET', 'USDT-FUTURES', 'BTCUSDT'),
        order_type: 'IOC',
        order_direction: 'OPEN_LONG',
        volume: 1,
        price: 12345,
      },
    );

    await submitOrder(
      { access_key: 'ak', secret_key: 'sk', passphrase: 'pp' },
      {
        account_id: 'bitget/test/spot',
        product_id: encodePath('BITGET', 'SPOT', 'ETHUSDT'),
        order_type: 'FOK',
        order_direction: 'OPEN_LONG',
        volume: 2,
        price: 23456,
      },
    );
  } finally {
    if (originalPrivateApiModule) {
      require.cache[privateApiPath] = originalPrivateApiModule;
    } else {
      delete require.cache[privateApiPath];
    }

    if (originalSubmitOrderModule) {
      require.cache[submitOrderPath] = originalSubmitOrderModule;
    } else {
      delete require.cache[submitOrderPath];
    }
  }

  assert.equal(payloads.length, 2);
  assert.partialDeepStrictEqual(payloads[0], {
    category: 'USDT-FUTURES',
    symbol: 'BTCUSDT',
    orderType: 'limit',
    timeInForce: 'ioc',
    price: '12345',
  });
  assert.partialDeepStrictEqual(payloads[1], {
    category: 'SPOT',
    symbol: 'ETHUSDT',
    orderType: 'limit',
    timeInForce: 'fok',
    price: '23456',
  });
});

test('submitOrder preserves legacy defaults when order_type is omitted', async () => {
  const payloads: unknown[] = [];
  const privateApiPath = require.resolve('../../api/private-api');
  const submitOrderPath = require.resolve('./submitOrder');
  const originalPrivateApiModule = require.cache[privateApiPath];
  const originalSubmitOrderModule = require.cache[submitOrderPath];

  require.cache[privateApiPath] = {
    id: privateApiPath,
    filename: privateApiPath,
    loaded: true,
    exports: {
      postPlaceOrder: async (_credential: unknown, params: unknown) => {
        payloads.push(params);
        return {
          code: '00000',
          msg: 'success',
          requestTime: Date.now(),
          data: { orderId: `order-${payloads.length}`, clientOid: '' },
        };
      },
    },
    children: [],
    path: '',
    paths: [],
    isPreloading: false,
  } as unknown as NodeModule;

  delete require.cache[submitOrderPath];
  const { submitOrder } = require('./submitOrder') as typeof import('./submitOrder');

  try {
    await submitOrder(
      { access_key: 'ak', secret_key: 'sk', passphrase: 'pp' },
      {
        account_id: 'bitget/test/futures',
        product_id: encodePath('BITGET', 'USDT-FUTURES', 'BTCUSDT'),
        order_direction: 'OPEN_LONG',
        volume: 1,
        price: 12345,
      },
    );

    await submitOrder(
      { access_key: 'ak', secret_key: 'sk', passphrase: 'pp' },
      {
        account_id: 'bitget/test/spot',
        product_id: encodePath('BITGET', 'SPOT', 'ETHUSDT'),
        order_direction: 'OPEN_LONG',
        volume: 2,
        price: 23456,
      },
    );
  } finally {
    if (originalPrivateApiModule) {
      require.cache[privateApiPath] = originalPrivateApiModule;
    } else {
      delete require.cache[privateApiPath];
    }

    if (originalSubmitOrderModule) {
      require.cache[submitOrderPath] = originalSubmitOrderModule;
    } else {
      delete require.cache[submitOrderPath];
    }
  }

  assert.equal(payloads.length, 2);
  assert.partialDeepStrictEqual(payloads[0], {
    category: 'USDT-FUTURES',
    symbol: 'BTCUSDT',
    orderType: 'market',
    timeInForce: undefined,
  });
  assert.partialDeepStrictEqual(payloads[1], {
    category: 'SPOT',
    symbol: 'ETHUSDT',
    orderType: 'limit',
    timeInForce: undefined,
  });
});

test('listOrders maps Bitget open orders back to MAKER IOC FOK MARKET and LIMIT', async () => {
  const privateApiPath = require.resolve('../../api/private-api');
  const listOrdersPath = require.resolve('./listOrders');
  const originalPrivateApiModule = require.cache[privateApiPath];
  const originalListOrdersModule = require.cache[listOrdersPath];

  require.cache[privateApiPath] = {
    id: privateApiPath,
    filename: privateApiPath,
    loaded: true,
    exports: {
      getUnfilledOrders: async () => ({
        code: '00000',
        msg: 'success',
        requestTime: Date.now(),
        data: {
          list: [
            {
              orderId: 'maker-order',
              symbol: 'BTCUSDT',
              orderType: 'limit',
              timeInForce: 'post_only',
              side: 'buy',
              posSide: 'long',
              price: '100',
              qty: '1',
              cumExecQty: '0',
              createdTime: '1',
            },
            {
              orderId: 'ioc-order',
              symbol: 'BTCUSDT',
              orderType: 'limit',
              timeInForce: 'ioc',
              side: 'buy',
              posSide: 'long',
              price: '101',
              qty: '2',
              cumExecQty: '1',
              createdTime: '2',
            },
            {
              orderId: 'fok-order',
              symbol: 'BTCUSDT',
              orderType: 'limit',
              timeInForce: 'fok',
              side: 'sell',
              posSide: 'short',
              price: '102',
              qty: '3',
              cumExecQty: '0',
              createdTime: '3',
            },
            {
              orderId: 'market-order',
              symbol: 'ETHUSDT',
              orderType: 'market',
              timeInForce: 'gtc',
              side: 'buy',
              price: '0',
              qty: '4',
              cumExecQty: '4',
              createdTime: '4',
            },
            {
              orderId: 'limit-order',
              symbol: 'ETHUSDT',
              orderType: 'limit',
              timeInForce: 'gtc',
              side: 'sell',
              price: '103',
              qty: '5',
              cumExecQty: '2',
              createdTime: '5',
            },
          ],
        },
      }),
    },
    children: [],
    path: '',
    paths: [],
    isPreloading: false,
  } as unknown as NodeModule;

  delete require.cache[listOrdersPath];
  const { listFuturesOrders, listSpotOrders } = require('./listOrders') as typeof import('./listOrders');

  try {
    const futuresOrders = await listFuturesOrders({ access_key: 'ak', secret_key: 'sk', passphrase: 'pp' });
    const spotOrders = await listSpotOrders({ access_key: 'ak', secret_key: 'sk', passphrase: 'pp' });

    assert.deepEqual(
      futuresOrders.slice(0, 3).map((order) => order.order_type),
      ['MAKER', 'IOC', 'FOK'],
    );
    assert.deepEqual(
      spotOrders.slice(3).map((order) => order.order_type),
      ['MARKET', 'LIMIT'],
    );
  } finally {
    if (originalPrivateApiModule) {
      require.cache[privateApiPath] = originalPrivateApiModule;
    } else {
      delete require.cache[privateApiPath];
    }

    if (originalListOrdersModule) {
      require.cache[listOrdersPath] = originalListOrdersModule;
    } else {
      delete require.cache[listOrdersPath];
    }
  }
});
