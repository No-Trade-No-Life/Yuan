import {
  calculatePositionVolumes,
  calculatePositionBounds,
  calculateDirectionalPositionVolumes,
  calculateOrdersVolume,
  sortOrdersByPrice,
  calculateSlippageProtectedPrice,
} from '../pure-functions';

// 测试用的简化类型
const createTestPosition = (
  product_id: string,
  direction: string,
  volume: number,
  position_price: number,
) => ({
  product_id,
  direction,
  volume,
  position_price,
  position_id: `${product_id}-${direction}`,
  free_volume: volume,
  closable_price: position_price,
  floating_profit: 0,
  valuation: volume * position_price,
});

const createTestOrder = (product_id: string, order_direction: string, volume: number, price: number) => ({
  product_id,
  order_direction,
  volume,
  price,
  account_id: 'test-account',
  order_type: 'MAKER' as const,
});

describe('Pure Functions', () => {
  describe('calculatePositionVolumes', () => {
    it('should calculate position volumes correctly', () => {
      const positions = [
        createTestPosition('BTC-USDT', 'LONG', 100, 50000),
        createTestPosition('BTC-USDT', 'LONG', 50, 51000),
        createTestPosition('BTC-USDT', 'SHORT', 30, 52000),
        createTestPosition('ETH-USDT', 'LONG', 200, 3000), // 不同产品
      ];

      const result = calculatePositionVolumes(positions, 'BTC-USDT');

      expect(result.longVolume).toBe(150); // 100 + 50
      expect(result.shortVolume).toBe(30);
      expect(result.netVolume).toBe(120); // 150 - 30
    });

    it('should return zeros for non-existent product', () => {
      const positions = [createTestPosition('BTC-USDT', 'LONG', 100, 50000)];

      const result = calculatePositionVolumes(positions, 'ETH-USDT');

      expect(result.longVolume).toBe(0);
      expect(result.shortVolume).toBe(0);
      expect(result.netVolume).toBe(0);
    });
  });

  describe('calculatePositionBounds', () => {
    it('should calculate bounds when actual is below lower bound', () => {
      const result = calculatePositionBounds(100, 200, 10);

      expect(result.lowerBound).toBe(200); // roundToStep(200, 10, Math.floor)
      expect(result.upperBound).toBe(200); // roundToStep(200, 10, Math.ceil)
      expect(result.deltaVolume).toBe(100); // 200 - 100
    });

    it('should calculate bounds when actual is above upper bound', () => {
      const result = calculatePositionBounds(300, 200, 10);

      expect(result.lowerBound).toBe(200);
      expect(result.upperBound).toBe(200);
      expect(result.deltaVolume).toBe(-100); // 200 - 300
    });

    it('should return zero delta when within bounds', () => {
      const result = calculatePositionBounds(200, 200, 10);

      expect(result.deltaVolume).toBe(0);
    });
  });

  describe('calculateDirectionalPositionVolumes', () => {
    it('should calculate directional volumes correctly', () => {
      const positions = [
        createTestPosition('BTC-USDT', 'LONG', 100, 50000),
        createTestPosition('BTC-USDT', 'LONG', 50, 51000),
        createTestPosition('BTC-USDT', 'SHORT', 30, 52000),
      ];

      const result = calculateDirectionalPositionVolumes(positions, 'BTC-USDT', 'LONG');

      expect(result.volume).toBe(150);
      expect(result.avgPositionPrice).toBeCloseTo(50333.33, 2); // (100*50000 + 50*51000) / 150
    });

    it('should return zero for empty positions', () => {
      const positions: any[] = [];
      const result = calculateDirectionalPositionVolumes(positions, 'BTC-USDT', 'LONG');

      expect(result.volume).toBe(0);
      expect(result.avgPositionPrice).toBe(0);
    });
  });

  describe('calculateOrdersVolume', () => {
    it('should calculate orders volume correctly', () => {
      const orders = [
        createTestOrder('BTC-USDT', 'OPEN_LONG', 100, 50000),
        createTestOrder('BTC-USDT', 'CLOSE_LONG', 50, 51000),
        createTestOrder('BTC-USDT', 'OPEN_SHORT', 30, 52000),
        createTestOrder('ETH-USDT', 'OPEN_LONG', 200, 3000), // 不同产品
      ];

      const result = calculateOrdersVolume(orders, 'BTC-USDT');

      // OPEN_LONG: +100, CLOSE_LONG: -50, OPEN_SHORT: -30
      expect(result).toBe(20); // 100 - 50 - 30
    });
  });

  describe('sortOrdersByPrice', () => {
    it('should sort LONG orders from low to high', () => {
      const orders = [
        createTestOrder('BTC-USDT', 'OPEN_LONG', 100, 51000),
        createTestOrder('BTC-USDT', 'OPEN_LONG', 50, 50000),
        createTestOrder('BTC-USDT', 'OPEN_LONG', 30, 52000),
      ];

      const result = sortOrdersByPrice(orders, 'LONG');

      expect(result[0].price).toBe(50000);
      expect(result[1].price).toBe(51000);
      expect(result[2].price).toBe(52000);
    });

    it('should sort SHORT orders from high to low', () => {
      const orders = [
        createTestOrder('BTC-USDT', 'OPEN_SHORT', 100, 51000),
        createTestOrder('BTC-USDT', 'OPEN_SHORT', 50, 50000),
        createTestOrder('BTC-USDT', 'OPEN_SHORT', 30, 52000),
      ];

      const result = sortOrdersByPrice(orders, 'SHORT');

      expect(result[0].price).toBe(52000);
      expect(result[1].price).toBe(51000);
      expect(result[2].price).toBe(50000);
    });
  });

  describe('calculateSlippageProtectedPrice', () => {
    it('should calculate slippage protected price for LONG', () => {
      const result = calculateSlippageProtectedPrice(
        'LONG',
        50000, // best price
        100, // actual volume
        49000, // actual avg price
        200, // expected volume
        49500, // expected avg price
        100, // delta volume
        0.01, // 1% slippage
      );

      // x = (200 * 49500 * (1 + 0.01) - 100 * 49000) / 100
      // x = (200 * 49500 * 1.01 - 100 * 49000) / 100
      // x = (9999000 - 4900000) / 100 = 50990
      // result = min(50000, 50990) = 50000
      expect(result).toBe(50000);
    });

    it('should calculate slippage protected price for SHORT', () => {
      const result = calculateSlippageProtectedPrice(
        'SHORT',
        50000, // best price
        100, // actual volume
        51000, // actual avg price
        200, // expected volume
        50500, // expected avg price
        100, // delta volume
        0.01, // 1% slippage
      );

      // x = (200 * 50500 * (1 - 0.01) - 100 * 51000) / 100
      // x = (200 * 50500 * 0.99 - 100 * 51000) / 100
      // x = (9999000 - 5100000) / 100 = 48990
      // result = max(50000, 48990) = 50000
      expect(result).toBe(50000);
    });

    it('should return best price for invalid calculation', () => {
      const result = calculateSlippageProtectedPrice(
        'LONG',
        50000,
        0,
        0,
        0,
        0,
        0, // delta volume = 0, will cause division by zero
        0.01,
      );

      expect(result).toBe(50000);
    });
  });
});
