import { encodePath } from '@yuants/utils';

jest.mock('../accountInfos/uid', () => ({
  accountConfigCache: {
    query: jest.fn(),
  },
}));

jest.mock('../api/private-api', () => ({
  postTradeOrder: jest.fn(),
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
import { postTradeOrder } from '../api/private-api';
import { mapOkxOrdTypeToOrderType } from './mapOkxOrdTypeToOrderType';
import { mapOrderTypeToOrdType } from './mapOrderTypeToOrdType';
import { submitOrder } from './submitOrder';

const mockedAccountConfigCache = jest.mocked(accountConfigCache);
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
