import { TimeFrame } from './TimeFrame';
import { scan } from './scan';

describe('scan', () => {
  test('should perform cumulative sum', () => {
    const tf = new TimeFrame();
    const price = tf.createTimeSeries<number>({ id: 'price' });

    // Add time data
    tf.time[0] = 1000;
    tf.time[1] = 1001;
    tf.time[2] = 1002;

    price[0] = 100;
    price[1] = 102;
    price[2] = 101;

    const cumulativeSum = scan(
      { id: 'cumulativeSum' },
      () => 0,
      (acc, index) => acc + price[index],
      [price],
    );

    tf.commit();

    expect(cumulativeSum[0]).toBe(100);
    expect(cumulativeSum[1]).toBe(202); // 100 + 102
    expect(cumulativeSum[2]).toBe(303); // 202 + 101
  });

  test('should work with complex accumulator', () => {
    const tf = new TimeFrame();
    const price = tf.createTimeSeries<number>({ id: 'price' });
    const volume = tf.createTimeSeries<number>({ id: 'volume' });

    // Add time data
    tf.time[0] = 1000;
    tf.time[1] = 1001;

    price[0] = 100;
    price[1] = 102;
    volume[0] = 1000;
    volume[1] = 1200;

    const priceVolumeMap = scan(
      { id: 'priceVolumeMap' },
      () => new Map<number, number>(),
      (acc, index) => acc.set(price[index], volume[index]),
      [price, volume],
    );

    tf.commit();

    expect(priceVolumeMap[0].get(100)).toBe(1000);
    expect(priceVolumeMap[1].get(102)).toBe(1200);
    expect(priceVolumeMap[1].get(100)).toBe(1000); // Previous value should still be there
  });

  test('should handle empty series', () => {
    const tf = new TimeFrame();
    const price = tf.createTimeSeries<number>({ id: 'price' });

    const cumulativeSum = scan(
      { id: 'cumulativeSum' },
      () => 0,
      (acc, index) => acc + price[index],
      [price],
    );

    tf.commit();

    // No data added, should use initial value
    expect(cumulativeSum.length).toBe(0);
  });

  test('should handle incremental updates', () => {
    const tf = new TimeFrame();
    const price = tf.createTimeSeries<number>({ id: 'price' });

    // Add time data
    tf.time[0] = 1000;
    tf.time[1] = 1001;
    tf.time[2] = 1002;

    const cumulativeSum = scan(
      { id: 'cumulativeSum' },
      () => 0,
      (acc, index) => acc + price[index],
      [price],
    );

    // Add first data point
    price[0] = 100;
    tf.commit();
    expect(cumulativeSum[0]).toBe(100);

    // Add second data point
    price[1] = 102;
    tf.commit();
    expect(cumulativeSum[1]).toBe(202);

    // Add third data point
    price[2] = 101;
    tf.commit();
    expect(cumulativeSum[2]).toBe(303);
  });

  test('should work with array accumulator', () => {
    const tf = new TimeFrame();
    const price = tf.createTimeSeries<number>({ id: 'price' });

    // Add time data
    tf.time[0] = 1000;
    tf.time[1] = 1001;
    tf.time[2] = 1002;

    price[0] = 100;
    price[1] = 102;
    price[2] = 101;

    const priceHistory = scan(
      { id: 'priceHistory' },
      () => [] as number[],
      (acc, index) => [...acc, price[index]],
      [price],
    );

    tf.commit();

    expect(priceHistory[0]).toEqual([100]);
    expect(priceHistory[1]).toEqual([100, 102]);
    expect(priceHistory[2]).toEqual([100, 102, 101]);
  });
});
