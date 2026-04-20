import { encodePath } from '@yuants/utils';

jest.mock('../accountInfos/uid', () => ({
  accountConfigCache: {
    query: jest.fn(),
  },
  getAccountIds: jest.fn(),
}));

jest.mock('../api/private-api', () => ({
  postTradeOrder: jest.fn(),
  getTradeOrdersPending: jest.fn(),
}));

jest.mock('../public-data/product', () => ({
  productService: {
    mapProductIdToProduct$: {
      pipe: jest.fn(),
    },
  },
}));

jest.mock('../public-data/quote', () => ({
  spotMarketTickers$: {
    pipe: jest.fn(),
  },
}));

import { accountConfigCache } from '../accountInfos/uid';
import { getAccountIds } from '../accountInfos/uid';
import { getTradeOrdersPending, postTradeOrder } from '../api/private-api';
import { getOrders } from '../experimental/getOrders';
import { listOrders } from './listOrders';
import { mapOkxOrdTypeToOrderType } from './mapOkxOrdTypeToOrderType';
import { mapOrderTypeToOrdType } from './mapOrderTypeToOrdType';
import { submitOrder } from './submitOrder';

const mockedAccountConfigCache = jest.mocked(accountConfigCache);
const mockedGetAccountIds = jest.mocked(getAccountIds);
const mockedGetTradeOrdersPending = jest.mocked(getTradeOrdersPending);
const mockedPostTradeOrder = jest.mocked(postTradeOrder);

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

describe('submitOrder', () => {
  beforeEach(() => {
    jest.resetAllMocks();

    mockedAccountConfigCache.query.mockResolvedValue({
      code: '0',
      msg: '',
      data: [{ acctLv: '1', posMode: 'net_mode' }],
    } as never);

    mockedPostTradeOrder.mockResolvedValue({
      code: '0',
      msg: '',
      data: [{ ordId: 'order-1', clOrdId: '', tag: '', sCode: '0', sMsg: '' }],
      inTime: '',
      outTime: '',
    });
  });

  test.each([
    ['IOC', 'ioc'],
    ['FOK', 'fok'],
  ])('maps %s orders to OKX ordType %s when submitting', async (orderType, ordType) => {
    await expect(
      submitOrder(
        { access_key: 'ak', secret_key: 'sk', passphrase: 'pp' },
        {
          account_id: 'okx/test/trading',
          product_id: encodePath('MARGIN', 'BTC-USDT'),
          order_type: orderType,
          order_direction: 'OPEN_LONG',
          volume: 1,
          price: 12345,
        },
      ),
    ).resolves.toEqual({ order_id: 'order-1' });

    expect(mockedPostTradeOrder).toHaveBeenCalledWith(
      { access_key: 'ak', secret_key: 'sk', passphrase: 'pp' },
      expect.objectContaining({ ordType, px: '12345', sz: '1' }),
    );
  });
});

describe('order readback mapping', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('listOrders maps IOC and FOK ordType values via shared readback mapping', async () => {
    mockedGetAccountIds.mockResolvedValue({ trading: 'okx/test/trading' } as never);
    mockedGetTradeOrdersPending.mockResolvedValue({
      code: '0',
      msg: '',
      data: [
        {
          ordId: 'ioc-order',
          ordType: 'ioc',
          side: 'buy',
          posSide: 'long',
          instType: 'SWAP',
          instId: 'BTC-USDT-SWAP',
          cTime: '1',
          fillTime: '0',
          sz: '2',
          accFillSz: '1',
          px: '100',
          avgPx: '101',
        },
        {
          ordId: 'fok-order',
          ordType: 'fok',
          side: 'sell',
          posSide: 'short',
          instType: 'SWAP',
          instId: 'ETH-USDT-SWAP',
          cTime: '2',
          fillTime: '0',
          sz: '3',
          accFillSz: '0',
          px: '200',
          avgPx: '0',
        },
      ],
    } as never);

    await expect(
      listOrders({ access_key: 'ak', secret_key: 'sk', passphrase: 'pp' }, 'okx/test/trading'),
    ).resolves.toMatchObject([
      { order_id: 'ioc-order', order_type: 'IOC' },
      { order_id: 'fok-order', order_type: 'FOK' },
    ]);
  });

  test('getOrders maps IOC and FOK ordType values via shared readback mapping', async () => {
    mockedGetTradeOrdersPending.mockResolvedValue({
      code: '0',
      msg: '',
      data: [
        {
          ordId: 'ioc-order',
          ordType: 'ioc',
          side: 'buy',
          posSide: 'long',
          instType: 'SWAP',
          instId: 'BTC-USDT-SWAP',
          cTime: '1',
          fillTime: '0',
          sz: '2',
          accFillSz: '1',
          px: '100',
          avgPx: '101',
        },
        {
          ordId: 'fok-order',
          ordType: 'fok',
          side: 'sell',
          posSide: 'short',
          instType: 'SWAP',
          instId: 'ETH-USDT-SWAP',
          cTime: '2',
          fillTime: '0',
          sz: '3',
          accFillSz: '0',
          px: '200',
          avgPx: '0',
        },
      ],
    } as never);

    await expect(getOrders({ access_key: 'ak', secret_key: 'sk', passphrase: 'pp' })).resolves.toMatchObject([
      { order_id: 'ioc-order', order_type: 'IOC' },
      { order_id: 'fok-order', order_type: 'FOK' },
    ]);
  });
});
