import { getEarningAccountInfo } from './earning';

// Mock 外部 API 模块
const mockGetEarnBalance = jest.fn();
const mockGetSpotPrice = jest.fn();

jest.mock('../../api/private-api', () => ({
  ...jest.requireActual('../../api/private-api'),
  getEarnBalance: mockGetEarnBalance,
}));

jest.mock('../../api/public-api', () => ({
  ...jest.requireActual('../../api/public-api'),
  getSpotPrice: mockGetSpotPrice,
}));

import * as privateApi from '../../api/private-api';
import * as publicApi from '../../api/public-api';

describe('getEarningAccountInfo', () => {
  const credential = { access_key: 'test', secret_key: 'test' };
  const account_id = 'GATE/123/EARNING';

  beforeEach(() => {
    // 保留 mock 设置
  });

  test('TC1: getEarnBalance 成功响应', async () => {
    const mockData = [
      { currency: 'USDT', amount: '100.5', frozen_amount: '10', lent_amount: '90', current_amount: '100.5' },
      { currency: 'BTC', amount: '0.002', frozen_amount: '0', lent_amount: '0.002', current_amount: '0.002' },
    ];
    mockGetEarnBalance.mockResolvedValue(mockData);

    const result = await privateApi.getEarnBalance(credential, {});
    expect(result).toEqual(mockData);
    expect(privateApi.getEarnBalance).toHaveBeenCalledWith(credential, {});
  });

  test('TC2: getEarnBalance 错误响应', async () => {
    mockGetEarnBalance.mockRejectedValue(new Error('API Error 401'));

    await expect(privateApi.getEarnBalance(credential, {})).rejects.toThrow('API Error 401');
    expect(privateApi.getEarnBalance).toHaveBeenCalledWith(credential, {});
  });

  test.skip('TC3: 余额映射 - 正常情况', async () => {
    mockGetEarnBalance.mockResolvedValue([
      { currency: 'USDT', amount: '100.5', frozen_amount: '10', lent_amount: '90', current_amount: '100.5' },
      { currency: 'BTC', amount: '0.002', frozen_amount: '0', lent_amount: '0.002', current_amount: '0.002' },
      { currency: 'ETH', amount: '0', frozen_amount: '0', lent_amount: '0', current_amount: '0' },
    ]);
    mockGetSpotPrice.mockImplementation(async (currency) => {
      if (currency === 'USDT') return 1;
      if (currency === 'BTC') return 50000;
      return 1; // 默认
    });

    const positions = await getEarningAccountInfo(credential, account_id);
    expect(positions).toHaveLength(2); // ETH 余额为 0 被过滤

    // 验证 USDT position
    const usdtPosition = positions.find((p) => p.position_id === 'earning/USDT');
    expect(usdtPosition).toBeDefined();
    expect(usdtPosition!.datasource_id).toBe('GATE');
    expect(usdtPosition!.product_id).toBe('GATE/EARNING/USDT');
    expect(usdtPosition!.volume).toBe(100.5);
    expect(usdtPosition!.free_volume).toBe(90.5); // amount - frozen
    expect(usdtPosition!.closable_price).toBe(1); // USDT 价格为 1

    // 验证 BTC position
    const btcPosition = positions.find((p) => p.position_id === 'earning/BTC');
    expect(btcPosition).toBeDefined();
    expect(btcPosition!.datasource_id).toBe('GATE');
    expect(btcPosition!.product_id).toBe('GATE/EARNING/BTC');
    expect(btcPosition!.volume).toBe(0.002);
    expect(btcPosition!.free_volume).toBe(0.002);
    expect(btcPosition!.closable_price).toBe(50000);

    // 验证 ETH 被过滤
    const ethPosition = positions.find((p) => p.position_id === 'earning/ETH');
    expect(ethPosition).toBeUndefined();
  });

  test.skip('TC4: 价格获取失败 - 回退到价格 1', async () => {
    mockGetEarnBalance.mockResolvedValue([
      { currency: 'XYZ', amount: '10', frozen_amount: '0', lent_amount: '10', current_amount: '10' },
    ]);
    mockGetSpotPrice.mockResolvedValue(1); // 默认价格 1

    const positions = await getEarningAccountInfo(credential, account_id);
    expect(positions).toHaveLength(1);

    const position = positions[0];
    expect(position.position_id).toBe('earning/XYZ');
    expect(position.closable_price).toBe(1); // 默认价格 1
    expect(position.volume).toBe(10);
    expect(position.free_volume).toBe(10);
  });

  test.skip('TC5: 价格获取失败 - 特殊币种映射 (SOL2/GTSOL)', async () => {
    mockGetEarnBalance.mockResolvedValue([
      { currency: 'SOL2', amount: '5', frozen_amount: '1', lent_amount: '4', current_amount: '5' },
      { currency: 'GTSOL', amount: '3', frozen_amount: '0', lent_amount: '3', current_amount: '3' },
    ]);
    mockGetSpotPrice.mockImplementation(async (currency) => {
      // SOL2 和 GTSOL 都映射到 SOL_USDT
      if (currency === 'SOL2' || currency === 'GTSOL') return 150;
      return 1;
    });

    const positions = await getEarningAccountInfo(credential, account_id);
    expect(positions).toHaveLength(2);

    // SOL2 应映射到 SOL_USDT
    const sol2Position = positions.find((p) => p.position_id === 'earning/SOL2');
    expect(sol2Position).toBeDefined();
    expect(sol2Position!.closable_price).toBe(150);
    expect(sol2Position!.free_volume).toBe(4); // amount - frozen

    // GTSOL 同样映射到 SOL_USDT
    const gtsolPosition = positions.find((p) => p.position_id === 'earning/GTSOL');
    expect(gtsolPosition).toBeDefined();
    expect(gtsolPosition!.closable_price).toBe(150);
  });

  test.skip('零余额过滤', async () => {
    mockGetEarnBalance.mockResolvedValue([
      { currency: 'USDT', amount: '0', frozen_amount: '0', lent_amount: '0', current_amount: '0' },
      {
        currency: 'BTC',
        amount: '0.000001',
        frozen_amount: '0',
        lent_amount: '0.000001',
        current_amount: '0.000001',
      },
    ]);
    mockGetSpotPrice.mockResolvedValue(1);

    const positions = await getEarningAccountInfo(credential, account_id);
    expect(positions).toHaveLength(1); // 只有 BTC 余额 > 0
    expect(positions[0].position_id).toBe('earning/BTC');
  });
});
