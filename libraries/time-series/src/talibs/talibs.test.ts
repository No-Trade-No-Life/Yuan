import { TimeFrame } from '../TimeFrame';
import { SMA, EMA, RSI, MACD, BB, ATR, Stochastic } from './index';

describe('Technical Indicators', () => {
  describe('SMA', () => {
    test('should calculate simple moving average', () => {
      const tf = new TimeFrame();
      const price = tf.createTimeSeries<number>({ id: 'price' });

      // Add time data
      for (let i = 0; i < 10; i++) {
        tf.time[i] = 1000 + i;
      }

      // Add test data
      const testData = [100, 102, 101, 103, 105, 104, 106, 107, 108, 109];
      testData.forEach((value, i) => {
        price[i] = value;
      });

      const sma3 = SMA(price, 3);
      tf.commit();

      // SMA calculation for period 3
      expect(sma3[0]).toBeCloseTo(100); // First value
      expect(sma3[1]).toBeCloseTo(101); // (100 + 102) / 2
      expect(sma3[2]).toBeCloseTo(101); // (100 + 102 + 101) / 3
      expect(sma3[3]).toBeCloseTo(102); // (102 + 101 + 103) / 3
      expect(sma3[4]).toBeCloseTo(103); // (101 + 103 + 105) / 3
    });

    test('should handle single data point', () => {
      const tf = new TimeFrame();
      const price = tf.createTimeSeries<number>({ id: 'price' });

      tf.time[0] = 1000;
      price[0] = 100;

      const sma3 = SMA(price, 3);
      tf.commit();

      expect(sma3[0]).toBe(100);
    });
  });

  describe('EMA', () => {
    test('should calculate exponential moving average', () => {
      const tf = new TimeFrame();
      const price = tf.createTimeSeries<number>({ id: 'price' });

      // Add time data
      for (let i = 0; i < 5; i++) {
        tf.time[i] = 1000 + i;
      }

      // Add test data
      price[0] = 100;
      price[1] = 102;
      price[2] = 101;
      price[3] = 103;
      price[4] = 105;

      const ema3 = EMA(price, 3);
      tf.commit();

      // EMA calculation: alpha = 2/(3+1) = 0.5
      // EMA[0] = price[0] = 100
      // EMA[1] = 0.5 * 102 + 0.5 * 100 = 101
      // EMA[2] = 0.5 * 101 + 0.5 * 101 = 101
      // EMA[3] = 0.5 * 103 + 0.5 * 101 = 102
      // EMA[4] = 0.5 * 105 + 0.5 * 102 = 103.5
      expect(ema3[0]).toBe(100);
      expect(ema3[1]).toBe(101);
      expect(ema3[2]).toBe(101);
      expect(ema3[3]).toBe(102);
      expect(ema3[4]).toBe(103.5);
    });
  });

  describe('RSI', () => {
    test('should calculate relative strength index', () => {
      const tf = new TimeFrame();
      const price = tf.createTimeSeries<number>({ id: 'price' });

      // Add time data
      for (let i = 0; i < 10; i++) {
        tf.time[i] = 1000 + i;
      }

      // Test data with alternating gains and losses
      const testData = [100, 102, 101, 103, 102, 104, 103, 105, 104, 106];
      testData.forEach((value, i) => {
        price[i] = value;
      });

      const rsi3 = RSI(price, 3);
      tf.commit();

      // RSI should be calculated for index >= 3
      // With more gains than losses, RSI should be above 50
      expect(rsi3[3]).toBeGreaterThan(50);
      expect(rsi3[4]).toBeGreaterThan(0);
      expect(rsi3[4]).toBeLessThan(100);
      expect(rsi3[5]).toBeGreaterThan(0);
      expect(rsi3[5]).toBeLessThan(100);
    });
  });

  describe('MACD', () => {
    test('should calculate MACD components', () => {
      const tf = new TimeFrame();
      const price = tf.createTimeSeries<number>({ id: 'price' });

      // Add time data
      for (let i = 0; i < 10; i++) {
        tf.time[i] = 1000 + i;
      }

      // Add test data
      const testData = [100, 102, 101, 103, 105, 104, 106, 107, 108, 109];
      testData.forEach((value, i) => {
        price[i] = value;
      });

      const { macdLine, signalLine, histogram } = MACD(price, 2, 3, 2);
      tf.commit();

      expect(macdLine).toBeDefined();
      expect(signalLine).toBeDefined();
      expect(histogram).toBeDefined();
      expect(macdLine.length).toBe(price.length);
      expect(signalLine.length).toBe(price.length);
      expect(histogram.length).toBe(price.length);
    });
  });

  describe('BB', () => {
    test('should calculate Bollinger Bands', () => {
      const tf = new TimeFrame();
      const price = tf.createTimeSeries<number>({ id: 'price' });

      // Add time data
      for (let i = 0; i < 10; i++) {
        tf.time[i] = 1000 + i;
      }

      // Add test data
      const testData = [100, 102, 101, 103, 105, 104, 106, 107, 108, 109];
      testData.forEach((value, i) => {
        price[i] = value;
      });

      const { middleBand, upperBand, lowerBand } = BB(price, 3, 2);
      tf.commit();

      expect(middleBand).toBeDefined();
      expect(upperBand).toBeDefined();
      expect(lowerBand).toBeDefined();

      // Upper band should be higher than middle band
      expect(upperBand[5]).toBeGreaterThan(middleBand[5]);
      // Lower band should be lower than middle band
      expect(lowerBand[5]).toBeLessThan(middleBand[5]);
    });
  });

  describe('ATR', () => {
    test('should calculate average true range', () => {
      const tf = new TimeFrame();
      const high = tf.createTimeSeries<number>({ id: 'high' });
      const low = tf.createTimeSeries<number>({ id: 'low' });
      const close = tf.createTimeSeries<number>({ id: 'close' });

      // Add time data
      for (let i = 0; i < 5; i++) {
        tf.time[i] = 1000 + i;
      }

      // Test data: price movement
      high[0] = 102;
      low[0] = 98;
      close[0] = 100;

      high[1] = 103;
      low[1] = 99;
      close[1] = 101;

      high[2] = 104;
      low[2] = 100;
      close[2] = 102;

      high[3] = 105;
      low[3] = 101;
      close[3] = 103;

      high[4] = 106;
      low[4] = 102;
      close[4] = 104;

      const atr = ATR(high, low, close, 2);
      tf.commit();

      expect(atr).toBeDefined();
      expect(atr[3]).toBeGreaterThan(0); // Should have some range
      expect(atr[4]).toBeGreaterThan(0);
    });
  });

  describe('Stochastic', () => {
    test('should calculate stochastic oscillator', () => {
      const tf = new TimeFrame();
      const high = tf.createTimeSeries<number>({ id: 'high' });
      const low = tf.createTimeSeries<number>({ id: 'low' });
      const close = tf.createTimeSeries<number>({ id: 'close' });

      // Add time data
      for (let i = 0; i < 10; i++) {
        tf.time[i] = 1000 + i;
      }

      // Test data
      const highs = [102, 103, 104, 105, 106, 107, 108, 109, 110, 111];
      const lows = [98, 99, 100, 101, 102, 103, 104, 105, 106, 107];
      const closes = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109];

      highs.forEach((value, i) => (high[i] = value));
      lows.forEach((value, i) => (low[i] = value));
      closes.forEach((value, i) => (close[i] = value));

      const { kLine, dLine } = Stochastic(high, low, close, 3, 2);
      tf.commit();

      expect(kLine).toBeDefined();
      expect(dLine).toBeDefined();

      // Stochastic values should be between 0 and 100
      expect(kLine[5]).toBeGreaterThanOrEqual(0);
      expect(kLine[5]).toBeLessThanOrEqual(100);
      expect(dLine[6]).toBeGreaterThanOrEqual(0);
      expect(dLine[6]).toBeLessThanOrEqual(100);
    });
  });
});
